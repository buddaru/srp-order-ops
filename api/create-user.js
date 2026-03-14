import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, full_name, role } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  // Use service role key — can create users server-side
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabase = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || '', role: role || 'employee' }
    })
    if (authErr) throw authErr

    // Insert profile
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      email,
      full_name: full_name || '',
      role: role || 'employee',
    })
    if (profileErr) throw profileErr

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
