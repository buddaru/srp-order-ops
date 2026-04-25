import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]                   = useState(null)
  const [profile, setProfile]             = useState(null)
  const [orgMemberRoles, setOrgMemberRoles] = useState([]) // ['org_owner', 'org_admin']
  const [locMemberRoles, setLocMemberRoles] = useState([]) // ['manager', 'employee']
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

  // Load org and location roles for isAdmin computation.
  // Runs in parallel with loadProfile; errors are non-fatal (new tables may not
  // exist yet on staging before the migration SQL is run).
  async function loadMemberRoles(userId) {
    try {
      const [orgRes, locRes] = await Promise.all([
        supabase.from('organization_members').select('role').eq('user_id', userId),
        supabase.from('location_members').select('role').eq('user_id', userId),
      ])
      setOrgMemberRoles((orgRes.data || []).map(m => m.role))
      setLocMemberRoles((locRes.data || []).map(m => m.role))
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
          loadMemberRoles(session.user.id),
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
          loadMemberRoles(session.user.id),
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
    setOrgMemberRoles([])
    setLocMemberRoles([])
    await supabase.auth.signOut()
  }

  // isAdmin: true if user has any admin role in the new membership tables,
  // OR has profile.role = 'admin' (backward compat during migration period).
  const isAdmin =
    profile?.role === 'admin' ||
    orgMemberRoles.some(r => ['org_owner', 'org_admin'].includes(r))

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
