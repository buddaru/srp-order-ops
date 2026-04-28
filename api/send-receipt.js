const LOGO_URL = 'https://app.getcadro.com/srp-logo.png'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { order, locationName, locationContact } = req.body
  if (!order?.email) return res.status(400).json({ error: 'Customer email required' })

  const SENDGRID_KEY = process.env.SENDGRID_API_KEY
  if (!SENDGRID_KEY) return res.status(500).json({ error: 'SendGrid not configured' })

  const html = buildReceiptHtml({ order, locationName, locationContact: locationContact || {}, logoSrc: LOGO_URL })
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

function buildReceiptHtml({ order, locationName, locationContact = {}, logoSrc }) {
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

  const logoTag = logoSrc
    ? `<img src="${logoSrc}" alt="${esc(locationName || 'Sweet Red Peach')}" class="logo-img" style="height:80px;width:auto;">`
    : ''

  const notesSection = order.notes ? `
  <!-- Notes -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
    <tr>
      <td style="border-top:1px solid #E4D9C8;padding-top:20px;">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#9A8574;margin-bottom:8px;">Notes</div>
        <div style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:#6B5347;line-height:1.6;">${esc(order.notes)}</div>
      </td>
    </tr>
  </table>` : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Receipt ${esc(order.id)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#EDE4D4;font-family:Arial,sans-serif;padding:32px 16px;}
  @media only screen and (max-width:480px){
    body{padding:0 !important}
    .outer{padding:28px 20px !important}
    .logo-img{height:56px !important}
    .receipt-title{font-size:44px !important}
    .meta-td{display:block !important;width:100% !important;padding:6px 16px !important}
    .from-td,.billed-td{display:block !important;width:100% !important;padding-right:0 !important;padding-left:0 !important;padding-bottom:20px !important}
    .totals-spacer{display:none !important}
    .totals-amt{width:100% !important}
  }
</style>
</head>
<body>
<div class="outer" style="max-width:680px;margin:0 auto;background:#FFFFFF;color:#3B241C;padding:48px 52px;font-family:Arial,sans-serif;">

  <!-- Masthead -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
    <tr>
      <td style="vertical-align:bottom;">
        <div class="receipt-title" style="font-family:Georgia,serif;font-weight:700;font-style:italic;font-size:60px;line-height:0.9;color:#3B241C;">Receipt</div>
        <div style="margin-top:12px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6B5347;">${esc(locationName || 'Sweet Red Peach')}</div>
      </td>
      <td style="vertical-align:top;text-align:right;width:100px;">${logoTag}</td>
    </tr>
  </table>

  <!-- Meta band -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFEFEF;margin-bottom:32px;">
    <tr>
      <td class="meta-td" width="33%" style="padding:16px 20px;vertical-align:top;">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.65;margin-bottom:4px;">Receipt No.</div>
        <div style="font-size:13px;font-weight:600;">${esc(order.id)}</div>
      </td>
      <td class="meta-td" width="33%" style="padding:16px 20px;vertical-align:top;">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.65;margin-bottom:4px;">Issued</div>
        <div style="font-size:13px;font-weight:600;">${fmtIssued(order.createdAt)}</div>
      </td>
      <td class="meta-td" width="34%" style="padding:16px 20px;vertical-align:top;">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.65;margin-bottom:4px;">Pickup</div>
        <div style="font-size:13px;font-weight:600;">${fmtDateStr(order.pickupDate)}${order.pickupTime ? ' · ' + fmtTimeStr(order.pickupTime) : ''}</div>
      </td>
    </tr>
  </table>

  <!-- From / Billed to -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
    <tr>
      <td class="from-td" width="50%" style="vertical-align:top;padding-right:20px;">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#9A8574;margin-bottom:8px;">From</div>
        <div style="font-family:Georgia,serif;font-weight:700;font-size:17px;color:#3B241C;margin-bottom:6px;">${esc(locationName || 'Sweet Red Peach')}</div>
        <div style="font-size:11px;color:#6B5347;line-height:1.65;">${fromLines}</div>
      </td>
      <td class="billed-td" width="50%" style="vertical-align:top;padding-left:20px;">
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#9A8574;margin-bottom:8px;">Billed to</div>
        <div style="font-family:Georgia,serif;font-weight:700;font-size:17px;color:#3B241C;margin-bottom:6px;">${esc(order.customer)}</div>
        <div style="font-size:11px;color:#6B5347;line-height:1.65;">
          ${order.phone ? esc(order.phone) + '<br>' : ''}
          ${order.email ? esc(order.email) : ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- Items table -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
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
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
    <tr>
      <td class="totals-spacer"></td>
      <td class="totals-amt" width="200">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:12px;color:#6B5347;padding:4px 0;border-bottom:1px solid #E4D9C8;">Subtotal</td>
            <td style="font-size:12px;color:#6B5347;text-align:right;padding:4px 0;border-bottom:1px solid #E4D9C8;">${fmt$(total)}</td>
          </tr>
          <tr>
            <td style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:#3B241C;padding-top:10px;">Total</td>
            <td style="font-family:Georgia,serif;font-size:19px;font-weight:700;color:#3B241C;text-align:right;padding-top:10px;">${fmt$(total)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  ${notesSection}

</div>
</body>
</html>`
}
