export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { employee, weekLabel, shifts } = req.body
  if (!employee?.email) return res.status(400).json({ error: 'Employee email required' })

  const SENDGRID_KEY = process.env.SENDGRID_API_KEY

  const ROLE_COLORS = {
    Baker:     { bg: '#FEF3C7', text: '#92400E', border: '#D97706' },
    Decorator: { bg: '#EDE9FE', text: '#5B21B6', border: '#7C3AED' },
    Cashier:   { bg: '#DCFCE7', text: '#166534', border: '#16A34A' },
    Lead:      { bg: '#DBEAFE', text: '#1E40AF', border: '#2563EB' },
  }

  function fmt12(t) {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }

  function fmtDate(ds) {
    const d = new Date(ds + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  const shiftsHtml = shifts
    .sort((a, b) => a.shift_date.localeCompare(b.shift_date))
    .map(s => {
      const c = ROLE_COLORS[s.role] || { bg: '#F1F5F9', text: '#475569', border: '#94A3B8' }
      return `
        <tr>
          <td style="padding:14px 16px; border-bottom:1px solid #f0ece6; font-family:'Georgia',serif; font-size:14px; color:#1C1612;">
            ${fmtDate(s.shift_date)}
          </td>
          <td style="padding:14px 16px; border-bottom:1px solid #f0ece6; font-size:14px; color:#4A4039; font-family:Arial,sans-serif;">
            ${fmt12(s.start_time)} – ${fmt12(s.end_time)}
          </td>
          <td style="padding:14px 16px; border-bottom:1px solid #f0ece6;">
            <span style="display:inline-block; background:${c.bg}; color:${c.text}; border:1px solid ${c.border}; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; font-family:Arial,sans-serif;">${s.role}</span>
          </td>
          ${s.notes ? `<td style="padding:14px 16px; border-bottom:1px solid #f0ece6; font-size:12px; color:#8A7E74; font-style:italic; font-family:Arial,sans-serif;">${s.notes}</td>` : '<td style="border-bottom:1px solid #f0ece6;"></td>'}
        </tr>
      `
    }).join('')

  const totalHours = shifts.reduce((sum, s) => {
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    return sum + (eh * 60 + em - sh * 60 - sm) / 60
  }, 0)

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EE;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#B5D8E6;padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
            <div style="font-family:'Georgia',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#1C3040;margin-bottom:8px;">Sweet Red Peach</div>
            <div style="font-family:'Georgia',serif;font-size:28px;color:#0F1E28;font-weight:normal;margin-bottom:4px;">Carson Operations</div>
            <div style="width:40px;height:2px;background:#C4784A;margin:12px auto;"></div>
            <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#1C3040;opacity:0.7;">Weekly Schedule</div>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="background:#ffffff;padding:32px 40px 24px;">
            <p style="font-family:'Georgia',serif;font-size:22px;color:#1C1612;margin:0 0 8px;">Hello, ${employee.name.split(' ')[0]}.</p>
            <p style="font-size:14px;color:#4A4039;line-height:1.7;margin:0;">Your schedule for <strong>${weekLabel}</strong> is ready. Please review the details below and reach out if you have any questions.</p>
          </td>
        </tr>

        <!-- Summary cards -->
        <tr>
          <td style="background:#ffffff;padding:0 40px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="48%" style="background:#F7F3EE;border-radius:8px;padding:16px 20px;text-align:center;">
                  <div style="font-size:28px;font-family:'Georgia',serif;color:#1C1612;font-weight:normal;">${shifts.length}</div>
                  <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8A7E74;margin-top:4px;">Shift${shifts.length !== 1 ? 's' : ''} This Week</div>
                </td>
                <td width="4%"></td>
                <td width="48%" style="background:#F7F3EE;border-radius:8px;padding:16px 20px;text-align:center;">
                  <div style="font-size:28px;font-family:'Georgia',serif;color:#1C1612;font-weight:normal;">${totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}</div>
                  <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8A7E74;margin-top:4px;">Total Hours</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Schedule table -->
        <tr>
          <td style="background:#ffffff;padding:0 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4DDD6;border-radius:8px;overflow:hidden;">
              <tr style="background:#F7F3EE;">
                <th style="padding:10px 16px;text-align:left;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#8A7E74;font-weight:600;font-family:Arial,sans-serif;">Date</th>
                <th style="padding:10px 16px;text-align:left;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#8A7E74;font-weight:600;font-family:Arial,sans-serif;">Time</th>
                <th style="padding:10px 16px;text-align:left;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#8A7E74;font-weight:600;font-family:Arial,sans-serif;">Role</th>
                <th style="padding:10px 16px;text-align:left;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#8A7E74;font-weight:600;font-family:Arial,sans-serif;">Notes</th>
              </tr>
              ${shiftsHtml}
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="background:#ffffff;padding:0 40px;">
            <div style="height:1px;background:#E4DDD6;"></div>
          </td>
        </tr>

        <!-- Footer message -->
        <tr>
          <td style="background:#ffffff;padding:24px 40px 32px;text-align:center;">
            <p style="font-size:13px;color:#8A7E74;line-height:1.7;margin:0 0 16px;">If you have any scheduling conflicts or questions,<br>please contact your manager as soon as possible.</p>
            <p style="font-family:'Georgia',serif;font-size:15px;color:#1C1612;margin:0;">Thank you for being part of the Sweet Red Peach team.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1C1612;padding:24px 40px;border-radius:0 0 12px 12px;text-align:center;">
            <div style="font-family:'Georgia',serif;font-size:16px;color:#F7F3EE;margin-bottom:4px;">Sweet Red Peach</div>
            <div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#8A7E74;">Carson, California</div>
            <div style="width:30px;height:1px;background:#C4784A;margin:12px auto;"></div>
            <div style="font-size:11px;color:#8A7E74;">This schedule was sent from Carson Operations</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: employee.email, name: employee.name }] }],
        from: { email: 'sweetredpeachcarson@gmail.com', name: 'Sweet Red Peach Bakery' },
        subject: `Your schedule for ${weekLabel} — Sweet Red Peach`,
        content: [{ type: 'text/html', value: html }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(err)
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
