export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, message } = req.body

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message' })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio environment variables not configured' })
  }

  // Clean phone number — strip non-digits and ensure +1 prefix
  const digits = to.replace(/\D/g, '')
  const e164 = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To:   e164,
          From: fromNumber,
          Body: message,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Twilio error:', data)
      return res.status(400).json({ error: data.message || 'Failed to send SMS' })
    }

    return res.status(200).json({ success: true, sid: data.sid })
  } catch (err) {
    console.error('SMS send error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
