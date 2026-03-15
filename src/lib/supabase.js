import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'srp-auth',
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }
})

// Ensure the session is fresh before running queries.
// If the token is expired or close to expiring, refreshes it first.
export async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const expiresAt = session.expires_at * 1000 // convert to ms
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000

  // Refresh if expiring within 5 minutes
  if (expiresAt - now < fiveMinutes) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) return null
    return data.session
  }
  return session
}

// Run a query with guaranteed session refresh + 6s timeout
// Returns { data, error } — never throws
export async function safeQuery(queryFn) {
  try {
    await ensureSession()
    
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 6000)
    )
    const result = await Promise.race([queryFn(), timeout])
    return result
  } catch (err) {
    console.warn('safeQuery failed:', err.message)
    return { data: null, error: err }
  }
}

// Simple alias for backward compat
export async function withTimeout(queryPromise, ms = 8000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Query timed out')), ms)
  )
  try {
    return await Promise.race([queryPromise, timeout])
  } catch(err) {
    console.warn('withTimeout failed:', err.message)
    return { data: null, error: err }
  }
}
