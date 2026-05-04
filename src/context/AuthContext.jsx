import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]                   = useState(null)
  const [profile, setProfile]             = useState(null)
  const [orgMemberships, setOrgMemberships]   = useState([]) // [{organization_id, role}]
  const [locationMemberships, setLocationMemberships] = useState([]) // [{location_id, role}]
  const [loading, setLoading]             = useState(true)

  async function loadProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (data) {
        setProfile(data)
      } else if (error?.code === 'PGRST116') {
        setProfile(null)
        await supabase.auth.signOut()
      }
    } catch (e) {
      console.warn('loadProfile error:', e.message)
    }
  }

  // Load org and location memberships (with IDs) for isAdmin + LocationContext.
  // Runs in parallel with loadProfile; errors are non-fatal (new tables may not
  // exist yet on staging before the migration SQL is run).
  async function loadMemberships(userId) {
    try {
      const [orgRes, locRes] = await Promise.all([
        supabase.from('organization_members').select('organization_id, role').eq('user_id', userId),
        supabase.from('location_members').select('location_id, role').eq('user_id', userId),
      ])
      setOrgMemberships(orgRes.data || [])
      setLocationMemberships(locRes.data || [])
    } catch (e) {
      // Tables don't exist yet pre-migration — silently ignore.
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        Promise.all([
          loadProfile(session.user.id),
          loadMemberships(session.user.id),
        ]).finally(() => { if (mounted) setLoading(false) })
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        Promise.all([
          loadProfile(session.user.id),
          loadMemberships(session.user.id),
        ]).finally(() => { if (mounted) setLoading(false) })
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
      } else if (event === 'TOKEN_REFRESH_ERROR') {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (s?.user && mounted) setUser(s.user)
        })
      }
    })

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!mounted) return
          if (session?.user) setUser(session.user)
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      mounted = false
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    setUser(null)
    setProfile(null)
    setOrgMemberships([])
    setLocationMemberships([])
    await supabase.auth.signOut()
  }

  // isAdmin: true if user has any admin role in the new membership tables,
  // OR has profile.role = 'admin' (backward compat during migration period).
  const isAdmin =
    profile?.role === 'admin' ||
    orgMemberships.some(m => ['org_owner', 'org_admin'].includes(m.role))

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signOut, orgMemberships, locationMemberships }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
