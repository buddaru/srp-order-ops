// api/_auth.js
// Shared authentication/authorization guards for the serverless API.
//
// Every /api/* handler that touches customer data, sends messages, or spends
// money on a third-party API must call requireUser (or requireAdmin) first.
// The frontend attaches the Supabase access token via src/lib/api.js (apiFetch);
// here we validate that token against Supabase Auth and, where needed, check
// the caller's org/location role.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

// Service-role client — validates JWTs and reads membership tables (bypasses RLS).
// Lazily created so a missing env var surfaces as a clear 500 rather than a crash at import.
let _admin = null
function adminClient() {
  if (!_admin) {
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase service credentials not configured')
    _admin = createClient(supabaseUrl, serviceKey)
  }
  return _admin
}

function getBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : null
}

// Returns the authenticated Supabase user, or null if the token is missing/invalid.
export async function getUser(req) {
  const token = getBearer(req)
  if (!token) return null
  try {
    const { data, error } = await adminClient().auth.getUser(token)
    if (error || !data?.user) return null
    return data.user
  } catch {
    return null
  }
}

// Guard: responds 401 and returns null when the caller is not authenticated.
export async function requireUser(req, res) {
  const user = await getUser(req)
  if (!user) {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }
  return user
}

// True when the user is an org owner/admin, a location manager, or (backward-compat)
// has profiles.role = 'admin'. When locationId is provided, org/location scope is enforced.
export async function isAdmin(userId, locationId = null) {
  const admin = adminClient()

  // Legacy profile-based admin (mirrors AuthContext backward compat).
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (profile?.role === 'admin') return true

  // Org owner/admin — cascades to every location in the org.
  const { data: orgRows } = await admin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .in('role', ['org_owner', 'org_admin'])
  if (orgRows?.length) {
    if (!locationId) return true
    const orgIds = orgRows.map(r => r.organization_id)
    const { data: locs } = await admin
      .from('locations').select('id').eq('id', locationId).in('organization_id', orgIds)
    if (locs?.length) return true
  }

  // Location manager — scoped to that location.
  const { data: locRows } = await admin
    .from('location_members')
    .select('location_id, role')
    .eq('user_id', userId)
    .eq('role', 'manager')
  if (locRows?.length) {
    if (!locationId) return true
    if (locRows.some(r => r.location_id === locationId)) return true
  }

  return false
}

// Guard: responds 401/403 and returns null unless the caller is an authenticated admin.
export async function requireAdmin(req, res, locationId = null) {
  const user = await requireUser(req, res)
  if (!user) return null
  const ok = await isAdmin(user.id, locationId)
  if (!ok) {
    res.status(403).json({ error: 'Admin access required' })
    return null
  }
  return user
}
