// api/sync-orders.js
// Vercel serverless function — syncs Bento email orders into Supabase

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
)

// ── Gmail OAuth helpers ──
async function getAccessToken() {
  // Prefer token stored in Supabase (survives rotation); fall back to env var
  let refreshToken = process.env.GMAIL_REFRESH_TOKEN
  const { data: row } = await supabase
    .from('gmail_tokens')
    .select('refresh_token')
    .eq('id', 'default')
    .single()
  if (row?.refresh_token) refreshToken = row.refresh_token

  if (!refreshToken) throw new Error('No Gmail refresh token found — run /api/gmail-auth to authorize')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`Gmail auth failed: ${data.error} — ${data.error_description}. Visit /api/gmail-auth to re-authorize.`)
  }

  // If Google rotated the refresh token, persist the new one immediately
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await supabase.from('gmail_tokens').upsert({
      id:            'default',
      refresh_token: data.refresh_token,
      updated_at:    new Date().toISOString(),
    })
  }

  return data.access_token
}

async function getOrdersLabelId(accessToken) {
  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/labels',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  const data = await res.json()
  const label = (data.labels || []).find(l => l.name.toLowerCase() === 'orders')
  return label?.id || null
}

async function gmailListMessages(accessToken, params) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  return res.json()
}

async function gmailSearch(accessToken, labelId, afterDate) {
  // Fetch from two sources and merge so new emails are never missed:
  // 1. Orders label — covers all indexed Bento emails efficiently
  // 2. Recent INBOX (50 messages, no query) — reads directly from the mailbox store,
  //    catches emails that haven't propagated through Gmail's index yet
  const [labelData, inboxData] = await Promise.all([
    labelId
      ? gmailListMessages(accessToken, new URLSearchParams({ labelIds: labelId, maxResults: 500 }))
      : gmailListMessages(accessToken, new URLSearchParams({ q: `from:noreply@notifications.getbento.com after:${afterDate}`, maxResults: 500 })),
    gmailListMessages(accessToken, new URLSearchParams({ labelIds: 'INBOX', maxResults: 50 })),
  ])

  const seen = new Set()
  const messages = []
  for (const msg of [...(labelData.messages || []), ...(inboxData.messages || [])]) {
    if (!seen.has(msg.id)) { seen.add(msg.id); messages.push(msg) }
  }

  return { messages, error: labelData.error || inboxData.error }
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
    if (!orderNumMatch) { console.warn(`[${messageId}] parse fail: no order number`); return null }
    const bentoOrderId = orderNumMatch[1]

    // Pickup date + time — handle multiline: "Order for:\n  Thu\n  Apr 02 1:00pm"
    const dateMatch =
      text.match(/Order for:[^]*?(\w{3}\s+\w{3}\s+\d{1,2})\s+(\d{1,2}:\d{2}(?:am|pm))/i) ||
      text.match(/Order for:[^]*?(\w{3}\s+\d{1,2})\s+(\d{1,2}:\d{2}(?:am|pm))/i)
    if (!dateMatch) { console.warn(`[${messageId}] parse fail: no date match (order #${bentoOrderId})\nText snippet: ${text.slice(0,300)}`); return null }

    const pickupDate = parseBentoDate(dateMatch[1])
    const pickupTime = parseTime(dateMatch[2])

    // Customer details block
    const custIdx = lines.findIndex(l => l.includes('Customer Details'))
    if (custIdx === -1) { console.warn(`[${messageId}] parse fail: no Customer Details (order #${bentoOrderId})\nLines: ${lines.slice(0,20).join(' | ')}`); return null }

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

    if (!customer || items.length === 0) { console.warn(`[${messageId}] parse fail: no customer (${customer}) or no items (${items.length}) (order #${bentoOrderId})`); return null }

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
  // GET ?debug=1 → test OAuth + Gmail search without importing anything
  if (req.method === 'GET') {
    if (req.query?.debug !== '1') return res.status(405).json({ error: 'Use POST to sync, or GET?debug=1 to test' })
    try {
      const accessToken = await getAccessToken()

      // Identify which Gmail account is authenticated
      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const profile = await profileRes.json()

      // ?msgId=XXX — inspect a specific message and show why parse fails
      if (req.query.msgId) {
        const full  = await gmailGetMessage(accessToken, req.query.msgId)
        const html  = getBody(full)
        const lines = html ? stripHtml(html) : []
        const text  = lines.join('\n')
        const order = parseOrder(html, req.query.msgId)
        return res.status(200).json({
          parsed: !!order,
          order,
          subject: full.payload?.headers?.find(h => h.name === 'Subject')?.value,
          textPreview: text.slice(0, 800),
        })
      }

      const afterDate = '2026/04/04'
      const labelId = await getOrdersLabelId(accessToken)
      const gmailResponse = await gmailSearch(accessToken, labelId, afterDate)
      return res.status(200).json({
        oauthOk: true,
        authorizedAs: profile.emailAddress,
        ordersLabelId: labelId,
        messageCount: gmailResponse.messages?.length ?? 0,
        gmailResponse,
      })
    } catch (err) {
      return res.status(200).json({ oauthOk: false, error: err.message })
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 1. Get Gmail access token
    const accessToken = await getAccessToken()

    // 2. Fetch Bento order emails — use the Orders label for instant access without
    //    search index delay; fall back to sender+date query if the label isn't found.
    const afterDate = '2026/04/04'
    const labelId = await getOrdersLabelId(accessToken)
    const gmailResponse = await gmailSearch(accessToken, labelId, afterDate)

    // Surface any Gmail API errors for debugging
    if (gmailResponse.error) {
      return res.status(200).json({
        imported: 0, skipped: 0,
        message: 'Gmail API error — check debug field',
        debug: { gmailError: gmailResponse.error }
      })
    }

    const messages = gmailResponse.messages || []

    if (messages.length === 0) {
      return res.status(200).json({
        imported: 0, skipped: 0,
        message: 'No Bento orders found in Gmail',
        debug: { query, gmailRawResponse: gmailResponse }
      })
    }

    // 3. Build two dedup sets:
    //    - processedMsgIds: Gmail message IDs already stored (fast pre-filter, grows over time)
    //    - existingBentoIds: bento_order_ids already stored (fallback for orders imported before
    //      gmail_message_id was tracked — prevents duplicates during the transition period)
    const { data: existing } = await supabase
      .from('orders')
      .select('gmail_message_id, bento_order_id')

    const processedMsgIds  = new Set()
    const existingBentoIds = new Set()
    for (const r of existing || []) {
      if (r.gmail_message_id) processedMsgIds.add(r.gmail_message_id)
      if (r.bento_order_id)   existingBentoIds.add(r.bento_order_id)
    }

    // 4. Pre-filter by Gmail message ID, then import up to 20 per click.
    const unprocessed = messages.filter(m => !processedMsgIds.has(m.id))
    const batch = unprocessed.slice(0, 20)

    let imported = 0
    let skipped  = 0
    let errors   = 0
    const failedIds = []

    for (const msg of batch) {
      try {
        const full    = await gmailGetMessage(accessToken, msg.id)
        const subject = full.payload?.headers?.find(h => h.name === 'Subject')?.value || ''
        const html    = getBody(full)

        // Skip reply/forward threads — they're not new order confirmations
        if (/^(re|fwd?):/i.test(subject)) { skipped++; continue }

        if (!html) {
          console.warn(`No HTML body in message ${msg.id}`)
          failedIds.push(msg.id)
          errors++
          continue
        }

        const order = parseOrder(html, msg.id)

        if (!order) {
          console.warn(`Parse failed for message ${msg.id} subject="${subject}"`)
          failedIds.push(msg.id)
          errors++
          continue
        }

        // Fallback dedup: existing orders imported before gmail_message_id was tracked
        if (existingBentoIds.has(order.bento_order_id)) {
          // Backfill the gmail_message_id so this order won't be re-checked next time
          await supabase
            .from('orders')
            .update({ gmail_message_id: msg.id })
            .eq('bento_order_id', order.bento_order_id)
            .is('gmail_message_id', null)
          skipped++
          continue
        }

        const id = await nextOrderId()

        const { error } = await supabase.from('orders').insert({
          id,
          customer:          order.customer,
          initials:          order.initials,
          phone:             order.phone,
          email:             order.email,
          items:             order.items,
          pickup_date:       order.pickup_date,
          pickup_time:       order.pickup_time,
          notes:             order.notes,
          notifications:     order.notifications,
          stage:             order.stage,
          image:             order.image,
          bento_order_id:    order.bento_order_id,
          gmail_message_id:  msg.id,
        })

        if (error) {
          console.error(`Insert error for bento #${order.bento_order_id}:`, JSON.stringify(error))
          errors++
          continue
        } else {
          imported++
        }
      } catch (err) {
        console.error('Error processing message:', err.message)
        errors++
        continue
      }
    }

    const remaining = unprocessed.length - batch.length
    return res.status(200).json({
      imported,
      skipped: messages.length - unprocessed.length,
      errors,
      totalFound: messages.length,
      newFound: unprocessed.length,
      message: imported > 0
        ? `${imported} order${imported > 1 ? 's' : ''} added${remaining > 0 ? ' — click Sync again for more' : ''}`
        : errors === 0
          ? 'Already up to date'
          : `0 imported, ${errors} errors`,
      failedIds,
    })

  } catch (err) {
    console.error('Sync error:', err)
    return res.status(500).json({ error: err.message || 'Sync failed' })
  }
}
