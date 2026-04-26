import fs from 'fs'
import path from 'path'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { order, locationName, locationContact } = req.body
  if (!order?.email) return res.status(400).json({ error: 'Customer email required' })

  const SENDGRID_KEY = process.env.SENDGRID_API_KEY
  if (!SENDGRID_KEY) return res.status(500).json({ error: 'SendGrid not configured' })

  let logoSrc = ''
  try {
    const logoPath = path.join(process.cwd(), 'public', 'srp-logo.png')
    const logoBuffer = fs.readFileSync(logoPath)
    logoSrc = 'data:image/png;base64,' + logoBuffer.toString('base64')
  } catch {
    // logo not critical — proceed without it
  }

  const html = buildInvoiceHtml({ order, locationName, locationContact: locationContact || {}, logoSrc })
  const subject = `Your order receipt — ${order.id}`

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: order.email, name: order.customer }] }],
        from: { email: 'sweetredpeachcarson@gmail.com', name: locationName || 'Sweet Red Peach' },
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
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function fmtTimeStr(ts) {
  if (!ts) return ''
  const [h, m] = ts.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtIssued(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function buildInvoiceHtml({ order, locationName, locationContact = {}, logoSrc }) {
  const total = (order.items || []).reduce(
    (s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 0), 0
  )

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
        <td style="padding:14px 0;vertical-align:top;border-bottom:1px solid #E4D9C8;padding-right:24px;">
          <div style="font-size:12px;font-weight:500;color:#3B241C;line-height:1.3;">${esc(item.name)}</div>
          ${desc ? `<div style="font-size:10.5px;color:#9A8574;margin-top:3px;font-style:italic;">${esc(desc)}</div>` : ''}
        </td>
        <td style="padding:14px 0;text-align:right;font-size:12px;color:#6B5347;border-bottom:1px solid #E4D9C8;font-variant-numeric:tabular-nums;white-space:nowrap;">${item.qty}</td>
        <td style="padding:14px 0 14px 16px;text-align:right;font-size:12px;color:#6B5347;border-bottom:1px solid #E4D9C8;font-variant-numeric:tabular-nums;white-space:nowrap;">${fmt$(item.price)}</td>
        <td style="padding:14px 0 14px 16px;text-align:right;font-size:12px;color:#6B5347;border-bottom:1px solid #E4D9C8;font-variant-numeric:tabular-nums;white-space:nowrap;">${lineTotal > 0 ? fmt$(lineTotal) : '—'}</td>
      </tr>`
  }).join('')

  const { address = '', phone = '', website = '' } = locationContact
  const fromLines = [
    ...address.split('\n').map(l => l.trim()).filter(Boolean),
    phone,
    website,
  ].filter(Boolean).map(l => `${esc(l)}<br>`).join('')

  const locLabel = locationContact.city || locationName || 'Carson, CA'
  const logoTag = logoSrc
    ? `<img src="${logoSrc}" alt="Sweet Red Peach" style="height:100px;width:auto;flex-shrink:0;">`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${esc(order.id)}</title>
<meta name="viewport" content="width=1200">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#EDE4D4;font-family:Arial,sans-serif;padding:48px 24px;}
</style>
</head>
<body>
<div style="width:720px;margin:0 auto;background:#FFFFFF;color:#3B241C;padding:48px 56px;font-family:Arial,sans-serif;">

  <!-- Masthead -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:34px;">
    <div>
      <div style="font-family:Georgia,serif;font-weight:700;font-style:italic;font-size:64px;line-height:0.88;color:#3B241C;letter-spacing:-0.01em;">Invoice</div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6B5347;">Sweet Red Peach · ${esc(locLabel)}</span>
      </div>
    </div>
    ${logoTag}
  </div>

  <!-- Meta band -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFEFEF;margin-bottom:36px;">
    <tr>
      <td style="padding:16px 22px;">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.65;margin-bottom:4px;">Invoice No.</div>
        <div style="font-size:13px;font-weight:600;">${esc(order.id)}</div>
      </td>
      <td style="padding:16px 22px;">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.65;margin-bottom:4px;">Issued</div>
        <div style="font-size:13px;font-weight:600;">${fmtIssued(order.createdAt)}</div>
      </td>
      <td style="padding:16px 22px;">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.65;margin-bottom:4px;">Pickup</div>
        <div style="font-size:13px;font-weight:600;">${fmtDateStr(order.pickupDate)}${order.pickupTime ? ' · ' + fmtTimeStr(order.pickupTime) : ''}</div>
      </td>
    </tr>
  </table>

  <!-- From / Billed to -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px;">
    <tr>
      <td width="50%" style="vertical-align:top;padding-right:24px;">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#9A8574;margin-bottom:10px;">From</div>
        <div style="font-family:Georgia,serif;font-weight:700;font-size:18px;color:#3B241C;margin-bottom:8px;">${esc(locationName || 'Sweet Red Peach')}</div>
        <div style="font-size:11px;color:#6B5347;line-height:1.65;">${fromLines}</div>
      </td>
      <td width="50%" style="vertical-align:top;padding-left:24px;">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#9A8574;margin-bottom:10px;">Billed to</div>
        <div style="font-family:Georgia,serif;font-weight:700;font-size:18px;color:#3B241C;margin-bottom:8px;">${esc(order.customer)}</div>
        <div style="font-size:11px;color:#6B5347;line-height:1.65;">
          ${order.phone ? esc(order.phone) + '<br>' : ''}
          ${order.email ? esc(order.email) : ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- Items table -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:4px;">
    <thead>
      <tr style="border-bottom:1px solid #E4D9C8;">
        <th style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#9A8574;font-weight:400;padding:0 0 8px;text-align:left;">Item</th>
        <th style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#9A8574;font-weight:400;padding:0 0 8px;text-align:right;white-space:nowrap;">Qty</th>
        <th style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#9A8574;font-weight:400;padding:0 0 8px 14px;text-align:right;white-space:nowrap;">Unit Price</th>
        <th style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:#9A8574;font-weight:400;padding:0 0 8px 14px;text-align:right;white-space:nowrap;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totals -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
    <tr>
      <td></td>
      <td width="220" style="border-top:1px solid #E4D9C8;padding-top:8px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:12px;color:#6B5347;padding:4px 0;border-bottom:1px solid #E4D9C8;">Subtotal</td>
            <td style="font-size:12px;color:#6B5347;text-align:right;padding:4px 0;border-bottom:1px solid #E4D9C8;">${fmt$(total)}</td>
          </tr>
          <tr>
            <td style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#3B241C;padding-top:10px;">Total</td>
            <td style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#3B241C;text-align:right;padding-top:10px;">${fmt$(total)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

</div>
</body>
</html>`
}
