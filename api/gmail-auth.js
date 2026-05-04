// api/gmail-auth.js
// One-time OAuth authorization endpoint — run this once to seed Gmail tokens in Supabase.
// After that, sync-orders.js handles everything automatically, including token rotation.
//
// Usage:
//   1. Visit https://your-app.vercel.app/api/gmail-auth  → redirects to Google consent
//   2. Approve access → Google redirects back with ?code=...
//   3. Tokens are saved to Supabase — done forever (until manually revoked)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
)

const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly'

export default async function handler(req, res) {
  const { code, error: oauthError, state } = req.query

  // Step 1 — no code yet: redirect to Google consent screen
  if (!code && !oauthError) {
    const redirectUri = buildRedirectUri(req)
    const params = new URLSearchParams({
      client_id:     process.env.GMAIL_CLIENT_ID,
      redirect_uri:  redirectUri,
      response_type: 'code',
      scope:         SCOPES,
      access_type:   'offline',
      prompt:        'consent',  // force consent so we always get a refresh token
    })
    return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  }

  // Step 2 — Google returned an error
  if (oauthError) {
    return res.status(400).send(`
      <h2>Gmail authorization failed</h2>
      <p><strong>Error:</strong> ${oauthError}</p>
      <p><a href="/api/gmail-auth">Try again</a></p>
    `)
  }

  // Step 3 — exchange code for tokens
  const redirectUri = buildRedirectUri(req)
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      code,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  })
  const tokens = await tokenRes.json()

  if (!tokens.refresh_token) {
    return res.status(400).send(`
      <h2>No refresh token returned</h2>
      <p>This usually means the account already authorized this app and Google didn't send a new refresh token.</p>
      <p><a href="/api/gmail-auth">Try again</a> — the consent page will force a new token.</p>
      <pre>${JSON.stringify(tokens, null, 2)}</pre>
    `)
  }

  // Save to Supabase — this is the permanent storage
  const { error: dbError } = await supabase.from('gmail_tokens').upsert({
    id:            'default',
    refresh_token: tokens.refresh_token,
    updated_at:    new Date().toISOString(),
  })

  if (dbError) {
    return res.status(500).send(`
      <h2>Failed to save token</h2>
      <pre>${JSON.stringify(dbError, null, 2)}</pre>
    `)
  }

  return res.status(200).send(`
    <h2>Gmail authorized successfully</h2>
    <p>Token saved to Supabase. Order syncing will now work permanently.</p>
    <p>You can close this tab and return to the app.</p>
  `)
}

function buildRedirectUri(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  return `${proto}://${host}/api/gmail-auth`
}
