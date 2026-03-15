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

// Run any Supabase query with a hard 8s timeout.
// Never throws — always returns { data, error }.
// Does NOT call ensureSession (autoRefreshToken handles that automatically).
export async function safeQuery(queryFn) {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 8000)
    )
    const result = await Promise.race([queryFn(), timeout])
    return result ?? { data: null, error: null }
  } catch (err) {
    console.warn('safeQuery failed:', err.message)
    return { data: null, error: err }
  }
}

// Legacy alias
export const withTimeout = safeQuery
