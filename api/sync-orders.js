// api/sync-orders.js
// Vercel serverless function — syncs Bento email orders into Supabase

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
)

// ── Gmail OAuth helpers ──
async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to get Gmail access token')
  return data.access_token
}

async function gmailSearch(accessToken, query, maxResults = 500) {
  const params = new URLSearchParams({ q: query, maxResults })
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  return data.messages || []
}

async function gmailGetMessage(accessToken, messageId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  return res.json()
}

// ── HTML parser ──
function getBody(message) {
  // Recursively search all MIME parts for text/html
  function findHtmlPart(parts) {
    if (!parts) return null
    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
      // Recurse into nested multipart/* containers
      if (part.mimeType?.startsWith('multipart/') && part.parts) {
        const found = findHtmlPart(part.parts)
        if (found) return found
      }
    }
    return null
  }

  const fromParts = findHtmlPart(message.payload?.parts)
  if (fromParts) return fromParts

  if (message.payload?.body?.data) {
    return Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
  }
  return ''
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
}

// ── Order parser ──
function parseOrder(html, messageId) {
  try {
    const lines = stripHtml(html)
    const text  = lines.join('\n')

    // Bento order number
    const orderNumMatch = text.match(/Order #(\d+)/)
    if (!orderNumMatch) return null
    const bentoOrderId = orderNumMatch[1]

    // Pickup date + time — handle multiline: "Order for:\n  Thu\n  Apr 02 1:00pm"
    const dateMatch =
      text.match(/Order for:[^]*?(\w{3}\s+\w{3}\s+\d{1,2})\s+(\d{1,2}:\d{2}(?:am|pm))/i) ||
      text.match(/Order for:[^]*?(\w{3}\s+\d{1,2})\s+(\d{1,2}:\d{2}(?:am|pm))/i)
    if (!dateMatch) return null

    const pickupDate = parseBentoDate(dateMatch[1])
    const pickupTime = parseTime(dateMatch[2])

    // Customer details block
    const custIdx = lines.findIndex(l => l.includes('Customer Details'))
    if (custIdx === -1) return null

    const customer = lines[custIdx + 1] || ''
    const rawPhone = lines[custIdx + 2] || ''
    const email    = lines[custIdx + 3] || ''

    const phone = formatPhone(rawPhone)
    const initials = mkInitials(customer)

    // Special requests → notes
    let notes = ''
    const srIdx = lines.findIndex(l => l.includes('Special Requests'))
    if (srIdx !== -1) {
      const nextSection = ['Utensils', 'Customer Details', 'Order for']
      let i = srIdx + 1
      const noteParts = []
      while (i < lines.length && !nextSection.some(s => lines[i].includes(s))) {
        noteParts.push(lines[i])
        i++
      }
      notes = noteParts.join(' ').trim()
    }

    // Parse line items from HTML directly (more reliable than plain text)
    const items = parseItems(html)

    if (!customer || items.length === 0) return null

    // Build notes from item details + any special request
    const combinedNotes = buildNotes(items, notes)

    return {
      bento_order_id: bentoOrderId,
      customer:       titleCase(customer),
      initials,
      phone,
      email:          email.toLowerCase(),
      pickup_date:    pickupDate,
      pickup_time:    pickupTime,
      notes:          combinedNotes,
      stage:          'received',
      notifications:  [],
      image:          null,
      items,
    }
  } catch (err) {
    console.error('Parse error:', err.message)
    return null
  }
}

function parseItems(html) {
  const items = []

  // Split on each lineItem row start — avoids nested </tr> problem
  const chunks = html.split(/<tr class="lineItem"/i)
  chunks.shift() // drop content before first lineItem

  for (const chunk of chunks) {
    // Qty
    const qtyMatch = chunk.match(/(\d+)x<\/p>/)
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1

    // Product name
    const nameMatch = chunk.match(/font-weight:700[^>]*>\s*\n?\s*([^<\n]+?)\s*\n?\s*</)
    const name = nameMatch ? nameMatch[1].trim() : ''
    if (!name) continue

    // Price — from itemTotal cell (appears after productName cell)
    const priceMatch = chunk.match(/class="itemTotal"[\s\S]*?\$(\d+\.\d{2})/)
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0

    // Field key-value pairs
    const fields = {}
    const fieldRegex = /class="fieldName"[^>]*>([\s\S]*?)<\/td>[\s\S]*?class="fieldDescription"[^>]*>([\s\S]*?)<\/td>/gi
    let fm
    while ((fm = fieldRegex.exec(chunk)) !== null) {
      const key = fm[1].replace(/<[^>]+>/g, '').replace(':', '').trim()
      const val = fm[2]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\$[\d.]+/g, '')   // strip addon upcharges like "$15.00"
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .join(', ')
      if (key && val) fields[key] = val
    }

    const isCake = /cake/i.test(name)
    const flavors = fields['Flavor'] || fields['Flavors'] ||
                    fields['Mini Cupcake Flavors'] || fields['Cupcake Flavors'] ||
                    fields['Pound Cake Flavors'] || fields['Cake Flavors'] || ''

    let flavor1 = '', flavor2 = '', addonSummary = '', writingText = ''

    if (isCake) {
      const parts = flavors.split(',').map(s => s.trim()).filter(Boolean)
      flavor1 = parts[0] || ''
      flavor2 = parts[1] || ''
      const extras = []
      if (fields['Gender'])   extras.push(`Gender: ${fields['Gender']}`)
      if (fields['Made for']) extras.push(`Made for: ${fields['Made for']}`)
      addonSummary = extras.join(' · ')
      writingText  = fields['Cake Inscription'] || fields['Inscription'] || ''
    } else {
      const extras = []
      if (fields['Made for']) extras.push(`Made for: ${fields['Made for']}`)
      addonSummary = [flavors, ...extras].filter(Boolean).join(' · ')
    }

    items.push({ name, qty, price, flavor1, flavor2, writingText, addonSummary })
  }

  return items
}

// ── Build notes from item details + special request ──
function buildNotes(items, specialRequest) {
  const lines = []
  items.forEach(item => {
    const details = []
    if (item.flavor1)      details.push(item.flavor1)
    if (item.flavor2)      details.push(item.flavor2)
    if (item.addonSummary) details.push(item.addonSummary)
    if (item.writingText)  details.push(`Inscription: "${item.writingText}"`)
    if (details.length > 0) lines.push(`${item.name}: ${details.join(', ')}`)
  })
  if (specialRequest) lines.push(`Special request: ${specialRequest}`)
  return lines.join('\n')
}

// ── Date/time helpers ──
function parseBentoDate(str) {
  // "Apr 02", "Mar 21", "Dec 11", "Thu Apr 02"
  const cleaned = str.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, '').trim()
  const now     = new Date()
  const year    = now.getFullYear()
  const d       = new Date(`${cleaned} ${year}`)
  // If parsed date is more than 6 months in the past, assume next year
  if (isNaN(d)) return null
  if (d < new Date(now - 180 * 86400 * 1000)) d.setFullYear(year + 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function parseTime(str) {
  // "1:00pm" → "13:00"
  const m = str.match(/(\d{1,2}):(\d{2})(am|pm)/i)
  if (!m) return '12:00'
  let h = parseInt(m[1])
  const min = m[2]
  const ap  = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return `${String(h).padStart(2,'0')}:${min}`
}

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(-10)
  if (digits.length < 10) return raw
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
}

function mkInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ── Generate SRP order ID ──
async function nextOrderId() {
  const { data } = await supabase
    .from('orders')
    .select('id')
    .like('id', 'SRP-%')
    .order('created_at', { ascending: false })
    .limit(100)

  const nums = (data || [])
    .map(r => parseInt(r.id.replace('SRP-', '')))
    .filter(n => !isNaN(n))

  const max = nums.length > 0 ? Math.max(...nums) : 100
  return `SRP-${String(max + 1).padStart(3, '0')}`
}

// ── Main handler ──
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 1. Get Gmail access token
    const accessToken = await getAccessToken()

    // 2. Fetch Bento order emails from 2026/03/21 onward
    const messages = await gmailSearch(
      accessToken,
      'from:noreply@notifications.getbento.com subject:"New Pickup Order" after:2026/03/08'
    )

    if (messages.length === 0) {
      return res.status(200).json({ imported: 0, skipped: 0, message: 'No Bento orders found in Gmail' })
    }

    // 3. Get existing bento_order_ids to deduplicate
    const { data: existing } = await supabase
      .from('orders')
      .select('bento_order_id')
      .not('bento_order_id', 'is', null)

    const existingIds = new Set((existing || []).map(r => r.bento_order_id))

    // 4. Process up to 20 emails per click — skips already-imported ones, imports new ones
    const batch = messages.slice(0, 20)

    let imported = 0
    let skipped  = 0
    let errors   = 0

    for (const msg of batch) {
      try {
        const full  = await gmailGetMessage(accessToken, msg.id)
        const html  = getBody(full)

        if (!html) {
          console.warn(`No HTML body in message ${msg.id}`)
          errors++
          continue
        }

        const order = parseOrder(html, msg.id)

        if (!order) {
          console.warn(`Parse failed for message ${msg.id}`)
          errors++
          continue
        }
        if (existingIds.has(order.bento_order_id)) { skipped++; continue }

        const id = await nextOrderId()

        const { error } = await supabase.from('orders').insert({
          id,
          customer:       order.customer,
          initials:       order.initials,
          phone:          order.phone,
          email:          order.email,
          items:          order.items,
          pickup_date:    order.pickup_date,
          pickup_time:    order.pickup_time,
          notes:          order.notes,
          notifications:  order.notifications,
          stage:          order.stage,
          image:          order.image,
          bento_order_id: order.bento_order_id,
        })

        if (error) {
          console.error(`Insert error for bento #${order.bento_order_id}:`, JSON.stringify(error))
          errors++
          continue
        } else {
          existingIds.add(order.bento_order_id)
          imported++
        }
      } catch (err) {
        console.error('Error processing message:', err.message)
        errors++
        continue
      }
    }

    const remaining = messages.length - existingIds.size - errors
    return res.status(200).json({
      imported,
      skipped,
      errors,
      totalFound: messages.length,
      message: imported > 0
        ? `${imported} orders added — click Sync again for more`
        : skipped === batch.length
          ? 'Already up to date'
          : `0 imported, ${errors} errors of ${batch.length} processed`,
    })

  } catch (err) {
    console.error('Sync error:', err)
    return res.status(500).json({ error: err.message || 'Sync failed' })
  }
}
