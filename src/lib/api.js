import { supabase } from './supabase'

// Wrapper around fetch that attaches the current Supabase access token so the
// serverless API can authenticate the caller (see api/_auth.js). Use this for
// every /api/* call instead of bare fetch().
export async function apiFetch(path, options = {}) {
  let token = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token || null
  } catch {
    // No session — the request will be rejected server-side with 401.
  }

  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  return fetch(path, { ...options, headers })
}
