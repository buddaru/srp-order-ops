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

export function buildInvoiceHtml({ order, locationName, locationContact = {}, logoSrc }) {
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
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#EDE4D4;font-family:'Inter',Arial,sans-serif;-webkit-font-smoothing:antialiased;padding:48px 24px;}
  @media print{
    body{background:#fff !important;padding:0 !important}
    .no-print{display:none !important}
    .page{box-shadow:none !important;margin:0 !important;min-height:auto !important}
  }
</style>
</head>
<body>

<div class="no-print" style="text-align:center;margin-bottom:20px;">
  <button onclick="window.print()" style="background:#8A1F24;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',Arial,sans-serif;">Save as PDF / Print</button>
</div>

<div class="page" style="width:8.5in;min-height:11in;margin:0 auto;background:#FFFFFF;color:#3B241C;padding:0.65in 0.7in 0.6in;display:flex;flex-direction:column;box-shadow:0 4px 40px rgba(59,36,28,0.15);">

  <!-- Masthead -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:34px;">
    <div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-style:italic;font-size:92px;line-height:0.88;color:#3B241C;letter-spacing:-0.02em;">Invoice</div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:10px;">
        <span style="width:24px;height:1px;background:#8A1F24;display:inline-block;flex-shrink:0;"></span>
        <span style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#6B5347;">Sweet Red Peach · ${esc(locLabel)}</span>
      </div>
    </div>
    ${logoTag}
  </div>

  <!-- Meta band -->
  <div style="background:#EFEFEF;padding:20px 26px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-bottom:36px;">
    <div>
      <div style="font-size:9.5px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.65;margin-bottom:5px;">Invoice No.</div>
      <div style="font-size:14px;font-weight:500;">${esc(order.id)}</div>
    </div>
    <div>
      <div style="font-size:9.5px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.65;margin-bottom:5px;">Issued</div>
      <div style="font-size:14px;font-weight:500;">${fmtIssued(order.createdAt)}</div>
    </div>
    <div>
      <div style="font-size:9.5px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.65;margin-bottom:5px;">Pickup</div>
      <div style="font-size:14px;font-weight:500;">${fmtDateStr(order.pickupDate)}${order.pickupTime ? ' · ' + fmtTimeStr(order.pickupTime) : ''}</div>
    </div>
  </div>

  <!-- From / Billed to -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-bottom:38px;">
    <div>
      <div style="font-size:9.5px;letter-spacing:0.2em;text-transform:uppercase;color:#9A8574;margin-bottom:12px;">From</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:22px;color:#3B241C;line-height:1.1;margin-bottom:10px;">${esc(locationName || 'Sweet Red Peach')}</div>
      <div style="font-size:11px;color:#6B5347;line-height:1.65;">${fromLines}</div>
    </div>
    <div>
      <div style="font-size:9.5px;letter-spacing:0.2em;text-transform:uppercase;color:#9A8574;margin-bottom:12px;">Billed to</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:22px;color:#3B241C;line-height:1.1;margin-bottom:10px;">${esc(order.customer)}</div>
      <div style="font-size:11px;color:#6B5347;line-height:1.65;">
        ${order.phone ? esc(order.phone) + '<br>' : ''}
        ${order.email ? esc(order.email) : ''}
      </div>
    </div>
  </div>

  <!-- Items table -->
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="border-bottom:1px solid #E4D9C8;">
        <th style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#9A8574;font-weight:400;padding:0 0 10px;text-align:left;">Item</th>
        <th style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#9A8574;font-weight:400;padding:0 0 10px;text-align:right;white-space:nowrap;">Qty</th>
        <th style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#9A8574;font-weight:400;padding:0 0 10px 16px;text-align:right;white-space:nowrap;">Unit Price</th>
        <th style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#9A8574;font-weight:400;padding:0 0 10px 16px;text-align:right;white-space:nowrap;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-top:28px;">
    <div style="width:260px;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#6B5347;border-bottom:1px solid #E4D9C8;">
        <span>Subtotal</span><span>${fmt$(total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding-top:12px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:22px;color:#3B241C;">
        <span style="font-size:14px;align-self:flex-end;padding-bottom:2px;">Total</span>
        <span>${fmt$(total)}</span>
      </div>
    </div>
  </div>

</div>
</body>
</html>`
}
