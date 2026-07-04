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

export function buildInvoiceHtml({ order, locationName, locationContact = {}, logoSrc }) {
  const total = (order.items || []).reduce(
    (s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 0), 0
  )

  const cell = 'border:1px solid #000;padding:6px 8px;font-size:11px;color:#000;vertical-align:top;'
  const cellRight = cell + 'text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;'

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
          ${desc ? `<div style="font-size:10px;color:#333;margin-top:2px;">${esc(desc)}</div>` : ''}
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

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${esc(order.id)}</title>
<meta name="viewport" content="width=1200">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#F2F2F2;font-family:Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;padding:48px 24px;color:#000;}
  @media print{
    body{background:#fff !important;padding:0 !important}
    .no-print{display:none !important}
    .page{box-shadow:none !important;margin:0 !important;min-height:auto !important}
  }
</style>
</head>
<body>

<div class="no-print" style="text-align:center;margin-bottom:20px;">
  <button onclick="window.print()" style="background:#000;color:#fff;border:none;border-radius:6px;padding:10px 24px;font-size:13px;font-weight:600;cursor:pointer;font-family:Helvetica,Arial,sans-serif;">Save as PDF / Print</button>
</div>

<div class="page" style="width:8.5in;min-height:11in;margin:0 auto;background:#FFFFFF;color:#000;padding:0.7in 0.65in;box-shadow:0 4px 40px rgba(0,0,0,0.15);">

  <!-- Masthead -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:36px;">
    <tr>
      <td style="vertical-align:top;">
        <div style="font-size:17px;font-weight:400;color:#000;">Invoice</div>
      </td>
      <td style="vertical-align:top;text-align:right;">
        <div style="font-size:28px;font-weight:400;letter-spacing:0.45em;color:#000;white-space:nowrap;">SWEET RED PEACH</div>
      </td>
    </tr>
  </table>

  <!-- From / Ship To / Meta -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
    <tr>
      <td style="vertical-align:top;width:36%;font-size:11px;line-height:1.6;color:#000;">
        <strong>${esc(locationName || 'Sweet Red Peach')}</strong><br>
        ${fromLines}
      </td>
      <td style="vertical-align:top;width:36%;font-size:11px;line-height:1.6;color:#000;">
        <strong>Bill To</strong><br>
        ${esc(order.customer)}<br>
        ${order.phone ? esc(order.phone) + '<br>' : ''}
        ${order.email ? esc(order.email) : ''}
      </td>
      <td style="vertical-align:top;text-align:right;font-size:11px;line-height:1.7;color:#000;white-space:nowrap;">
        <strong>Date:</strong> ${fmtIssued(order.createdAt)}<br>
        <strong>Invoice Number:</strong> ${esc(order.id)}<br>
        <strong>Pickup:</strong> ${fmtDateStr(order.pickupDate)}${order.pickupTime ? ' · ' + fmtTimeStr(order.pickupTime) : ''}
      </td>
    </tr>
  </table>

  <!-- Items table -->
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="${cell}font-weight:700;text-align:left;">Item</th>
        <th style="${cell}font-weight:700;text-align:right;width:60px;">Qty</th>
        <th style="${cell}font-weight:700;text-align:right;width:80px;">Price</th>
        <th style="${cell}font-weight:700;text-align:right;width:90px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr>
        <td style="${cell}font-weight:400;" colspan="3">Item Subtotal</td>
        <td style="${cellRight}">${fmt$(total)}</td>
      </tr>
      <tr>
        <td style="border:none;" colspan="2"></td>
        <td style="${cell}font-weight:700;text-align:right;">Total</td>
        <td style="${cellRight}font-weight:700;">${fmt$(total)}</td>
      </tr>
    </tbody>
  </table>

  ${order.notes ? `<!-- Notes -->
  <div style="margin-top:28px;">
    <div style="font-size:11px;font-weight:700;margin-bottom:6px;">Notes</div>
    <div style="font-size:11px;color:#000;line-height:1.6;">${esc(order.notes)}</div>
  </div>` : ''}

  <div style="margin-top:48px;font-size:10px;color:#333;">Page 1 of 1</div>

</div>
</body>
</html>`
}
