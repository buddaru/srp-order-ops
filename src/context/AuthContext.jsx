import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

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
        // No profile row — genuine missing profile, sign out
        setProfile(null)
        await supabase.auth.signOut()
      }
      // Any other error (network, timeout) — keep user logged in, profile stays null
    } catch (e) {
      console.warn('loadProfile error:', e.message)
      // Don't sign out on network errors
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id).finally(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') {
        // Only sign out if there's no existing session — prevents blank screen on token refresh failure
        supabase.auth.getSession().then(({ data: { session: existing } }) => {
          if (!existing?.user) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
        })
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        loadProfile(session.user.id).finally(() => {
          if (mounted) setLoading(false)
        })
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
      } else if (event === 'TOKEN_REFRESH_ERROR') {
        // Don't blank the screen — keep user logged in, session will retry
        console.warn('Token refresh failed — keeping user logged in')
      }
    })

    // Re-check session when user comes back to the tab after idle
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!mounted) return
          if (session?.user) {
            setUser(session.user)
          }
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
    await supabase.auth.signOut()
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
