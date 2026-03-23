// api/sync-orders.js
// Vercel serverless function — syncs Bento email orders into Supabase

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // use service key for server-side inserts
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
  const parts = message.payload?.parts
  if (parts) {
    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
    }
  }
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

    // Pickup date + time: "Thu Apr 02 1:00pm" or "Dec 11 1:00pm"
    const dateMatch = text.match(/Order for:.*?(\w{3}\s+\w{3}\s+\d{1,2})\s+(\d{1,2}:\d{2}(?:am|pm))/i)
      || text.match(/Order for:.*?(\w{3}\s+\d{1,2})\s+(\d{1,2}:\d{2}(?:am|pm))/i)
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

    return {
      bento_order_id: bentoOrderId,
      customer:       titleCase(customer),
      initials,
      phone,
      email:          email.toLowerCase(),
      pickup_date:    pickupDate,
      pickup_time:    pickupTime,
      notes,
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
  // Match each lineItem table row
  const lineItemRegex = /<tr class="lineItem"[\s\S]*?<\/tr>/gi
  const lineItems = html.match(lineItemRegex) || []

  for (const block of lineItems) {
    const lines = stripHtml(block)
    const text  = lines.join('\n')

    // Qty: "1x"
    const qtyMatch = text.match(/^(\d+)x/)
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1

    // Product name (first bold-ish line after qty)
    const nameMatch = block.match(/font-weight:700[^>]*>\s*\n?\s*([^<\n]+?)\s*\n?\s*</)
    const name = nameMatch ? nameMatch[1].trim() : ''

    // Price
    const priceMatch = text.match(/\$(\d+\.\d{2})$/)
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0

    // Field rows (Flavor, Flavors, Cake Inscription, Gender, Made for)
    const fields = {}
    const fieldRegex = /(<td class="fieldName"[\s\S]*?<\/td>)\s*(<td class="fieldDescription"[\s\S]*?<\/td>)/gi
    let fieldMatch
    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      const fieldName = stripHtml(fieldMatch[1]).join('').replace(':', '').trim()
      const fieldVal  = stripHtml(fieldMatch[2]).join(', ').trim()
      fields[fieldName] = fieldVal
    }

    // Build item object
    const isCake    = /cake/i.test(name)
    const isWriting = fields['Cake Inscription'] || fields['Inscription']
    const flavors   = fields['Flavor'] || fields['Flavors'] ||
                      fields['Mini Cupcake Flavors'] || fields['Cupcake Flavors'] ||
                      fields['Pound Cake Flavors'] || fields['Cake Flavors'] || ''

    let flavor1 = '', flavor2 = '', addonSummary = ''

    if (isCake) {
      // Cakes: flavor1 = base, flavor2 = filling/frosting if present
      const flavorParts = flavors.split(',').map(f => f.trim()).filter(Boolean)
      flavor1 = flavorParts[0] || ''
      flavor2 = flavorParts[1] || ''

      // addonSummary: Gender + Made for
      const extras = []
      if (fields['Gender'])   extras.push(`Gender: ${fields['Gender']}`)
      if (fields['Made for']) extras.push(`Made for: ${fields['Made for']}`)
      addonSummary = extras.join(' · ')
    } else {
      // Cupcakes/Pound Cakes/Other: all flavors go into addonSummary
      addonSummary = flavors

      // Made for
      if (fields['Made for']) {
        addonSummary = addonSummary
          ? `${addonSummary} · Made for: ${fields['Made for']}`
          : `Made for: ${fields['Made for']}`
      }
    }

    const writingText = isWriting
      ? (fields['Cake Inscription'] || fields['Inscription'] || '')
      : ''

    if (name) {
      items.push({ name, qty, price, flavor1, flavor2, writingText, addonSummary })
    }
  }

  return items
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

    // 2. Fetch all Bento order emails
    const messages = await gmailSearch(
      accessToken,
      'from:noreply@notifications.getbento.com subject:"New Pickup Order"'
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

    let imported = 0
    let skipped  = 0
    let errors   = 0

    // 4. Process each email
    for (const msg of messages) {
      try {
        const full  = await gmailGetMessage(accessToken, msg.id)
        const html  = getBody(full)
        const order = parseOrder(html, msg.id)

        if (!order) { errors++; continue }
        if (existingIds.has(order.bento_order_id)) { skipped++; continue }

        // Generate next SRP ID
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
          console.error(`Insert error for bento #${order.bento_order_id}:`, error)
          errors++
        } else {
          existingIds.add(order.bento_order_id)
          imported++
        }
      } catch (err) {
        console.error('Error processing message:', err.message)
        errors++
      }
    }

    return res.status(200).json({
      imported,
      skipped,
      errors,
      message: imported > 0
        ? `${imported} new order${imported === 1 ? '' : 's'} added`
        : 'Already up to date',
    })

  } catch (err) {
    console.error('Sync error:', err)
    return res.status(500).json({ error: err.message || 'Sync failed' })
  }
}
