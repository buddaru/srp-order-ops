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
      // Never auto-sign-out from a state change event — only from explicit signOut() call
      // This prevents the blank screen when tabs wake from sleep
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        loadProfile(session.user.id).finally(() => {
          if (mounted) setLoading(false)
        })
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
      } else if (event === 'TOKEN_REFRESH_ERROR') {
        // Re-attempt session fetch — don't blank the screen
        supabase.auth.getSession().then(({ data: { session: s } }) => {
          if (s?.user && mounted) setUser(s.user)
        })
      }
      // SIGNED_OUT is intentionally ignored here — signOut() sets user to null directly
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
