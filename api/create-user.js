import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, full_name, role, location_id } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || '', role: role || 'employee' }
    })
    if (authErr) throw authErr

    const userId = authData.user.id

    // Create profile row (backward compat — keeps existing profile-based checks working)
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id:        userId,
      email,
      full_name: full_name || '',
      role:      role || 'employee',
    })
    if (profileErr) throw profileErr

    // Create location_members row if a location was specified
    if (location_id) {
      const memberRole = role === 'admin' ? 'manager' : 'employee'
      const { error: memberErr } = await supabase.from('location_members').upsert({
        user_id:     userId,
        location_id,
        role:        memberRole,
      })
      if (memberErr) {
        // Non-fatal: new tables may not exist pre-migration; log and continue.
        console.warn('location_members insert warning:', memberErr.message)
      }
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Create user error:', JSON.stringify(err))
    return res.status(500).json({ error: err.message, details: JSON.stringify(err) })
  }
}
