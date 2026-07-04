import { requireUser } from './_auth.js'
import { rateLimit } from './_rateLimit.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!(await requireUser(req, res))) return
  if (!rateLimit(req, { limit: 30, windowMs: 60_000 }).allowed) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' })
  }

  const { order, locationName, locationContact } = req.body
  if (!order?.email) return res.status(400).json({ error: 'Customer email required' })

  const SENDGRID_KEY = process.env.SENDGRID_API_KEY
  if (!SENDGRID_KEY) return res.status(500).json({ error: 'SendGrid not configured' })

  const html = buildReceiptHtml({ order, locationName, locationContact: locationContact || {} })
  const subject = `Your receipt from ${locationName || 'Sweet Red Peach'} — ${order.id}`

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: order.email, name: order.customer }] }],
        from: { email: 'receipts@getcadro.com', name: locationName || 'Sweet Red Peach' },
        subject,
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

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmt$(n) {
  return '$' + parseFloat(n || 0).toFixed(2)
}

function fmtDateStr(ds) {
  if (!ds) return '—'
  const d = new Date(ds + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: '2-digit', day: '2-digit', year: 'numeric' })
}

function fmtTimeStr(ts) {
  if (!ts) return ''
  const [h, m] = ts.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtIssued(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: '2-digit', day: '2-digit', year: 'numeric' })
}

function buildReceiptHtml({ order, locationName, locationContact = {} }) {
  const total = (order.items || []).reduce(
    (s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 0), 0
  )

  const cell = 'border:1px solid #000;padding:6px 8px;font-size:12px;color:#000;vertical-align:top;font-family:Helvetica,Arial,sans-serif;'
  const cellRight = cell + 'text-align:right;white-space:nowrap;'

  const itemRows = (order.items || []).map(item => {
    const lineTotal = (parseFloat(item.price) || 0) * (parseInt(item.qty) || 0)
    const nameHasFlavors = item.name && item.name.includes('—')
    const flavors = nameHasFlavors ? '' : [item.flavor1, item.flavor2].filter(Boolean).join(' / ')
    const addonRaw = item.addonSummary
    const addon = Array.isArray(addonRaw) ? addonRaw.join(' · ') : (addonRaw || '')
    const parts = [flavors, addon].filter(Boolean)
    if (item.writingText) parts.push(`Writing: ${item.writingText}`)
    const desc = parts.join(' · ')
    return `
      <tr>
        <td style="${cell}">
          ${esc(item.name)}
          ${desc ? `<div style="font-size:11px;color:#333;margin-top:2px;">${esc(desc)}</div>` : ''}
        </td>
        <td style="${cellRight}">${item.qty}</td>
        <td style="${cellRight}">${fmt$(item.price)}</td>
        <td style="${cellRight}">${lineTotal > 0 ? fmt$(lineTotal) : '—'}</td>
      </tr>`
  }).join('')

  const { address = '', phone = '', website = '' } = locationContact
  const fromLines = [
    ...address.split('\n').map(l => l.trim()).filter(Boolean),
    phone,
    website,
  ].filter(Boolean).map(l => `${esc(l)}<br>`).join('')

  const notesSection = order.notes ? `
  <!-- Notes -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
    <tr>
      <td style="font-family:Helvetica,Arial,sans-serif;">
        <div style="font-size:12px;font-weight:700;color:#000;margin-bottom:6px;">Notes</div>
        <div style="font-size:12px;color:#000;line-height:1.6;">${esc(order.notes)}</div>
      </td>
    </tr>
  </table>` : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${esc(order.id)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#F2F2F2;font-family:Helvetica,Arial,sans-serif;padding:32px 16px;}
</style>
</head>
<body>
<div style="max-width:680px;margin:0 auto;background:#FFFFFF;color:#000;padding:48px 52px;font-family:Helvetica,Arial,sans-serif;">

  <!-- Masthead -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
    <tr>
      <td style="vertical-align:top;font-family:Helvetica,Arial,sans-serif;">
        <div style="font-size:16px;color:#000;">Invoice</div>
      </td>
      <td style="vertical-align:top;text-align:right;font-family:Helvetica,Arial,sans-serif;">
        <div style="font-size:22px;letter-spacing:0.4em;color:#000;white-space:nowrap;">SWEET RED PEACH</div>
      </td>
    </tr>
  </table>

  <!-- From / Bill To / Meta -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr>
      <td width="34%" style="vertical-align:top;font-size:12px;line-height:1.6;color:#000;font-family:Helvetica,Arial,sans-serif;">
        <strong>${esc(locationName || 'Sweet Red Peach')}</strong><br>
        ${fromLines}
      </td>
      <td width="33%" style="vertical-align:top;font-size:12px;line-height:1.6;color:#000;font-family:Helvetica,Arial,sans-serif;">
        <strong>Bill To</strong><br>
        ${esc(order.customer)}<br>
        ${order.phone ? esc(order.phone) + '<br>' : ''}
        ${order.email ? esc(order.email) : ''}
      </td>
      <td style="vertical-align:top;text-align:right;font-size:12px;line-height:1.7;color:#000;white-space:nowrap;font-family:Helvetica,Arial,sans-serif;">
        <strong>Date:</strong> ${fmtIssued(order.createdAt)}<br>
        <strong>Invoice Number:</strong> ${esc(order.id)}<br>
        <strong>Pickup:</strong> ${fmtDateStr(order.pickupDate)}${order.pickupTime ? ' · ' + fmtTimeStr(order.pickupTime) : ''}
      </td>
    </tr>
  </table>

  <!-- Items table -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <thead>
      <tr>
        <th style="${cell}font-weight:700;text-align:left;">Item</th>
        <th style="${cell}font-weight:700;text-align:right;width:50px;">Qty</th>
        <th style="${cell}font-weight:700;text-align:right;width:70px;">Price</th>
        <th style="${cell}font-weight:700;text-align:right;width:80px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr>
        <td style="${cell}" colspan="3">Item Subtotal</td>
        <td style="${cellRight}">${fmt$(total)}</td>
      </tr>
      <tr>
        <td style="border:none;" colspan="2"></td>
        <td style="${cell}font-weight:700;text-align:right;">Total</td>
        <td style="${cellRight}font-weight:700;">${fmt$(total)}</td>
      </tr>
    </tbody>
  </table>

  ${notesSection}

</div>
</body>
</html>`
}
