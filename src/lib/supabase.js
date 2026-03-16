import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'srp-auth',
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    // 10-second fetch timeout for all requests
    fetch: (url, options = {}) => {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), 10000)
      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(id))
    }
  }
})

// Safe query wrapper — always resolves, never hangs
export async function safeQuery(queryFn) {
  try {
    const result = await queryFn()
    return result ?? { data: null, error: null }
  } catch (err) {
    console.warn('safeQuery error:', err.message)
    return { data: null, error: err }
  }
}

export const withTimeout = safeQuery
