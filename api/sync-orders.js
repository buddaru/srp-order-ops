// api/sync-orders.js
// Vercel serverless function — syncs Bento email orders into Supabase.
//
// Discovery uses Gmail's history API for incremental sync: we store the last-seen
// historyId in gmail_tokens.last_history_id. On each call we fetch only what's new.
// First run (or expired historyId) falls back to a sender-scoped search.
// Per-message parse/insert failures are persisted in failed_imports so they can be
// inspected and retried via ?retryFailed=1 instead of disappearing into logs.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
)

const BENTO_SENDER = 'noreply@notifications.getbento.com'
// Vercel hobby = 10s, pro = 60s. Leave a few seconds of headroom so we can
// still write last_history_id and respond before the platform kills us.
const SOFT_RUNTIME_BUDGET_MS = 50_000

// ── Gmail OAuth helpers ──
async function getAccessToken() {
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

  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await supabase.from('gmail_tokens')
      .update({ refresh_token: data.refresh_token, updated_at: new Date().toISOString() })
      .eq('id', 'default')
  }

  return data.access_token
}

async function gmailFetch(accessToken, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  return res.json()
}

async function getProfile(accessToken) {
  return gmailFetch(accessToken, 'https://gmail.googleapis.com/gmail/v1/users/me/profile')
}

async function gmailGetMessage(accessToken, messageId) {
  return gmailFetch(accessToken, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`)
}

// Incremental: pull all new messages since startHistoryId. Throws with .status=404
// if Gmail considers the historyId too old (~1 week).
async function historyListAll(accessToken, startHistoryId) {
  const ids = new Set()
  let pageToken = null
  let pages = 0
  do {
    const params = new URLSearchParams({
      startHistoryId,
      historyTypes: 'messageAdded',
      maxResults: '100',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const data = await gmailFetch(
      accessToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/history?${params}`
    )
    if (data.error) {
      const err = new Error(data.error.message || 'history list failed')
      err.status = data.error.code
      throw err
    }
    for (const h of data.history || []) {
      for (const m of h.messagesAdded || []) {
        if (m.message?.id) ids.add(m.message.id)
      }
    }
    pageToken = data.nextPageToken
    pages++
  } while (pageToken && pages < 20)
  return [...ids]
}

// Backfill: list all Bento-sender messages, paginated. Used on first run and
// when the saved historyId has expired.
async function searchAllBento(accessToken, maxPages = 5) {
  const ids = new Set()
  let pageToken = null
  let pages = 0
  do {
    const params = new URLSearchParams({
      q: `from:${BENTO_SENDER}`,
      maxResults: '100',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const data = await gmailFetch(
      accessToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`
    )
    if (data.error) throw new Error(data.error.message || 'search failed')
    for (const m of data.messages || []) ids.add(m.id)
    pageToken = data.nextPageToken
    pages++
  } while (pageToken && pages < maxPages)
  return [...ids]
}

// ── HTML parser ──
function getBody(message) {
  function findHtmlPart(parts) {
    if (!parts) return null
    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
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

function getHeader(payload, name) {
  return payload?.headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''
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

    const orderNumMatch = text.match(/Order #(\d+)/)
    if (!orderNumMatch) return { error: 'no order number', snippet: text.slice(0, 300) }
    const bentoOrderId = orderNumMatch[1]

    const dateMatch =
      text.match(/Order for:[^]*?(\w{3}\s+\w{3}\s+\d{1,2})\s+(\d{1,2}:\d{2}(?:am|pm))/i) ||
      text.match(/Order for:[^]*?(\w{3}\s+\d{1,2})\s+(\d{1,2}:\d{2}(?:am|pm))/i)
    if (!dateMatch) return { error: `no date match for #${bentoOrderId}`, snippet: text.slice(0, 300) }

    const pickupDate = parseBentoDate(dateMatch[1])
    const pickupTime = parseTime(dateMatch[2])

    const custIdx = lines.findIndex(l => l.includes('Customer Details'))
    if (custIdx === -1) return { error: `no Customer Details for #${bentoOrderId}` }

    const customer = lines[custIdx + 1] || ''
    const rawPhone = lines[custIdx + 2] || ''
    const email    = lines[custIdx + 3] || ''

    const phone = formatPhone(rawPhone)
    const initials = mkInitials(customer)

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

    const items = parseItems(html)

    if (!customer)        return { error: `no customer name for #${bentoOrderId}` }
    if (items.length === 0) return { error: `no line items for #${bentoOrderId}` }

    const combinedNotes = buildNotes(items, notes)

    return {
      order: {
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
    }
  } catch (err) {
    return { error: `parser threw: ${err.message}` }
  }
}

function parseItems(html) {
  const items = []
  const chunks = html.split(/<tr class="lineItem"/i)
  chunks.shift()

  for (const chunk of chunks) {
    const qtyMatch = chunk.match(/(\d+)x<\/p>/)
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1

    const nameMatch = chunk.match(/font-weight:700[^>]*>\s*\n?\s*([^<\n]+?)\s*\n?\s*</)
    const name = nameMatch ? nameMatch[1].trim() : ''
    if (!name) continue

    const priceMatch = chunk.match(/class="itemTotal"[\s\S]*?\$(\d+\.\d{2})/)
    const price = priceMatch ? parseFloat(priceMatch[1]) : 0

    const fields = {}
    const fieldRegex = /class="fieldName"[^>]*>([\s\S]*?)<\/td>[\s\S]*?class="fieldDescription"[^>]*>([\s\S]*?)<\/td>/gi
    let fm
    while ((fm = fieldRegex.exec(chunk)) !== null) {
      const key = fm[1].replace(/<[^>]+>/g, '').replace(':', '').trim()
      const val = fm[2]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\$[\d.]+/g, '')
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

function parseBentoDate(str) {
  const cleaned = str.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, '').trim()
  const now     = new Date()
  const year    = now.getFullYear()
  const d       = new Date(`${cleaned} ${year}`)
  if (isNaN(d)) return null
  if (d < new Date(now - 180 * 86400 * 1000)) d.setFullYear(year + 1)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function parseTime(str) {
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

// ── Failure persistence ──
async function recordFailure(messageId, subject, sender, reason, html) {
  try {
    await supabase.from('failed_imports').upsert({
      gmail_message_id: messageId,
      subject:          subject || '',
      sender:           sender || '',
      reason,
      raw_html:         html ? html.slice(0, 50000) : null,
      attempted_at:     new Date().toISOString(),
      resolved_at:      null,
    })
  } catch (err) {
    console.error('failed_imports write failed (table may not exist yet):', err.message)
  }
}

async function clearFailure(messageId) {
  try {
    await supabase.from('failed_imports')
      .update({ resolved_at: new Date().toISOString() })
      .eq('gmail_message_id', messageId)
      .is('resolved_at', null)
  } catch (err) {
    console.error('failed_imports clear failed:', err.message)
  }
}

// ── Main handler ──
export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (req.query?.debug !== '1') return res.status(405).json({ error: 'Use POST to sync, or GET?debug=1 to inspect' })
    try {
      const accessToken = await getAccessToken()
      const profile = await getProfile(accessToken)

      if (req.query.msgId) {
        const full  = await gmailGetMessage(accessToken, req.query.msgId)
        const html  = getBody(full)
        const lines = html ? stripHtml(html) : []
        const text  = lines.join('\n')
        const result = parseOrder(html, req.query.msgId)
        return res.status(200).json({
          parsed: !!result.order,
          order: result.order,
          parseError: result.error,
          subject: getHeader(full.payload, 'Subject'),
          from: getHeader(full.payload, 'From'),
          textPreview: text.slice(0, 800),
        })
      }

      const { data: tokenRow } = await supabase.from('gmail_tokens').select('last_history_id').eq('id', 'default').single()
      const { count: failedCount } = await supabase.from('failed_imports').select('*', { count: 'exact', head: true }).is('resolved_at', null)

      return res.status(200).json({
        oauthOk: true,
        authorizedAs: profile.emailAddress,
        currentHistoryId: profile.historyId,
        lastHistoryId: tokenRow?.last_history_id || null,
        unresolvedFailures: failedCount ?? null,
      })
    } catch (err) {
      return res.status(200).json({ oauthOk: false, error: err.message })
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const startedAt = Date.now()
  const wantsBackfill   = req.query?.backfill === '1'
  const wantsRetryFailed = req.query?.retryFailed === '1'

  try {
    const accessToken = await getAccessToken()

    // 1. Discover candidate message IDs.
    const { data: tokenRow } = await supabase
      .from('gmail_tokens')
      .select('last_history_id')
      .eq('id', 'default')
      .single()
    const lastHistoryId = tokenRow?.last_history_id

    let candidateIds = []
    let mode = 'incremental'

    if (wantsBackfill || !lastHistoryId) {
      candidateIds = await searchAllBento(accessToken)
      mode = 'backfill'
    } else {
      try {
        candidateIds = await historyListAll(accessToken, lastHistoryId)
      } catch (err) {
        if (err.status === 404) {
          // Saved historyId expired (Gmail keeps history ~7 days). Recover by backfilling.
          candidateIds = await searchAllBento(accessToken)
          mode = 'backfill-recovered'
        } else {
          throw err
        }
      }
    }

    // 2. Optionally include unresolved failed messages (for retry after a parser fix).
    let failedSet = new Set()
    if (wantsRetryFailed) {
      const { data: failedRows } = await supabase
        .from('failed_imports')
        .select('gmail_message_id')
        .is('resolved_at', null)
      const failedIds = (failedRows || []).map(r => r.gmail_message_id)
      candidateIds = [...new Set([...candidateIds, ...failedIds])]
    } else {
      // Skip messages we've already failed on, so the user isn't stuck retrying broken parses.
      const { data: failedRows } = await supabase
        .from('failed_imports')
        .select('gmail_message_id')
        .is('resolved_at', null)
      failedSet = new Set((failedRows || []).map(r => r.gmail_message_id))
    }

    // 3. Build dedup sets from existing orders.
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('gmail_message_id, bento_order_id')

    const processedMsgIds  = new Set()
    const existingBentoIds = new Set()
    for (const r of existingOrders || []) {
      if (r.gmail_message_id) processedMsgIds.add(r.gmail_message_id)
      if (r.bento_order_id)   existingBentoIds.add(r.bento_order_id)
    }

    const toProcess = candidateIds.filter(id =>
      !processedMsgIds.has(id) && !failedSet.has(id)
    )

    // 4. Process every candidate (no batch cap). Bail only if we're about to hit
    //    Vercel's wall-clock limit; the next click resumes from the same historyId.
    let imported = 0, skipped = 0, errors = 0, processed = 0
    const failedNow = []

    for (const msgId of toProcess) {
      if (Date.now() - startedAt > SOFT_RUNTIME_BUDGET_MS) break
      processed++

      try {
        const full = await gmailGetMessage(accessToken, msgId)

        if (full.error) {
          // Message was deleted between discovery and fetch — count as skipped, don't fail.
          skipped++
          continue
        }

        const subject = getHeader(full.payload, 'Subject')
        const from    = getHeader(full.payload, 'From')
        const html    = getBody(full)

        // Sender-based filter (replaces brittle subject string match).
        if (!from.toLowerCase().includes(BENTO_SENDER)) { skipped++; continue }
        if (/^(re|fwd?):/i.test(subject))                { skipped++; continue }
        // Soft-skip Bento mail that clearly isn't an order (newsletters, account notices).
        if (!/order/i.test(subject))                     { skipped++; continue }

        if (!html) {
          await recordFailure(msgId, subject, from, 'no HTML body', null)
          failedNow.push(msgId); errors++
          continue
        }

        const result = parseOrder(html, msgId)
        if (!result.order) {
          await recordFailure(msgId, subject, from, result.error || 'parse failed', html)
          failedNow.push(msgId); errors++
          continue
        }

        const order = result.order

        // Fallback dedup: matching bento_order_id from a previous (pre-tracking) import.
        if (existingBentoIds.has(order.bento_order_id)) {
          await supabase.from('orders')
            .update({ gmail_message_id: msgId })
            .eq('bento_order_id', order.bento_order_id)
            .is('gmail_message_id', null)
          skipped++
          continue
        }

        const id = await nextOrderId()

        const { error } = await supabase.from('orders').insert({
          id,
          customer:         order.customer,
          initials:         order.initials,
          phone:            order.phone,
          email:            order.email,
          items:            order.items,
          pickup_date:      order.pickup_date,
          pickup_time:      order.pickup_time,
          notes:            order.notes,
          notifications:    order.notifications,
          stage:            order.stage,
          image:            order.image,
          bento_order_id:   order.bento_order_id,
          gmail_message_id: msgId,
        })

        if (error) {
          await recordFailure(msgId, subject, from, `insert failed: ${error.message}`, html)
          failedNow.push(msgId); errors++
          continue
        }

        // In-memory dedup for the rest of this run.
        processedMsgIds.add(msgId)
        existingBentoIds.add(order.bento_order_id)

        // If this was a retry, mark the failure resolved.
        if (wantsRetryFailed) await clearFailure(msgId)

        imported++
      } catch (err) {
        await recordFailure(msgId, '', '', `runtime error: ${err.message}`, null)
        failedNow.push(msgId); errors++
      }
    }

    // 5. Advance the historyId only if we drained the queue. If we bailed on the
    //    runtime budget, the next click picks up from the same point and dedup
    //    handles anything we already imported.
    const remaining = toProcess.length - processed
    if (remaining === 0) {
      try {
        const profile = await getProfile(accessToken)
        if (profile.historyId) {
          await supabase.from('gmail_tokens')
            .update({
              last_history_id: profile.historyId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', 'default')
        }
      } catch (err) {
        console.error('historyId update failed:', err.message)
      }
    }

    return res.status(200).json({
      imported,
      skipped,
      errors,
      processed,
      remaining,
      totalCandidates: candidateIds.length,
      mode,
      message:
        imported > 0
          ? `${imported} order${imported > 1 ? 's' : ''} added${remaining > 0 ? ` — ${remaining} more, click Sync again` : ''}`
          : remaining > 0
            ? `${remaining} more to process — click Sync again`
            : errors > 0
              ? `0 imported, ${errors} parse failure${errors > 1 ? 's' : ''} (see failed_imports)`
              : 'Already up to date',
      failedIds: failedNow,
    })
  } catch (err) {
    console.error('Sync error:', err)
    return res.status(500).json({ error: err.message || 'Sync failed' })
  }
}
