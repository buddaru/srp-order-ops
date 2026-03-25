// api/sync-meez.js
// Vercel serverless function — syncs recipes from Meez into Supabase
// Auto-creates recipe_groups and recipe_group_members from Meez recipe books

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
)

const MEEZ_TOKEN = process.env.MEEZ_API_TOKEN
const MEEZ_ORG   = process.env.MEEZ_ORG_ID || '6380'
const MEEZ_BASE  = 'https://api.getmeez.com/api/v1'

const meezHeaders = {
  'Authorization': `Token ${MEEZ_TOKEN}`,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://app.getmeez.com',
  'Referer': 'https://app.getmeez.com/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
}

async function fetchRecipeList() {
  const url = `${MEEZ_BASE}/recipes/?organization=${MEEZ_ORG}&is_public=false&page_size=500`
  const res  = await fetch(url, { headers: meezHeaders })
  if (!res.ok) throw new Error(`Meez list fetch failed: ${res.status}`)
  const data = await res.json()
  return data.results || data
}

async function fetchRecipeDetail(id) {
  const url = `${MEEZ_BASE}/recipes/${id}/v2/?expanded=true&is_public=false&organization=${MEEZ_ORG}`
  const res  = await fetch(url, { headers: meezHeaders })
  if (!res.ok) return null
  return res.json()
}

async function fetchRecipeSteps(id) {
  const url = `${MEEZ_BASE}/recipes/${id}/steps/?all=true&organization=${MEEZ_ORG}`
  const res  = await fetch(url, { headers: meezHeaders })
  if (!res.ok) return []
  const data = await res.json()
  return (Array.isArray(data) ? data : data.results || [])
    .sort((a, b) => a.order - b.order)
    .map(s => ({
      order:     s.order,
      text:      s.description || '',
      is_header: s.is_header || false,
      is_note:   s.is_note   || false,
    }))
}

async function fetchRecipeData(id) {
  const url = `${MEEZ_BASE}/recipes/${id}/data/?organization=${MEEZ_ORG}`
  const res  = await fetch(url, { headers: meezHeaders })
  if (!res.ok) return null
  return res.json()
}

function parseIngredients(detail) {
  return (detail.recipe_items || []).map(item => {
    if (item.is_header) return { type: 'header', label: item.name || '' }
    const name = item.ingredient?.name || item.badingredient?.name || item.name || ''
    const qty  = item.quantity_str || String(item.quantity || '')
    const unit = item.unit?.name || ''
    const note = item.preparation_note || ''
    return { type: 'item', qty, unit, name, note }
  })
}

// ── Ensure a recipe_group row exists for a given name, return its id ──
async function ensureGroup(name, groupCache) {
  if (groupCache.has(name)) return groupCache.get(name)

  // Check if already in DB
  const { data: existing } = await supabase
    .from('recipe_groups')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (existing?.id) {
    groupCache.set(name, existing.id)
    return existing.id
  }

  // Create it
  const { data: created } = await supabase
    .from('recipe_groups')
    .insert({ name })
    .select('id')
    .single()

  if (created?.id) {
    groupCache.set(name, created.id)
    return created.id
  }

  return null
}

// ── Link a recipe to a group, skipping if already linked ──
async function linkRecipeToGroup(recipeId, groupId) {
  await supabase
    .from('recipe_group_members')
    .upsert({ group_id: groupId, recipe_id: recipeId }, { onConflict: 'group_id,recipe_id' })
}

// ── Main handler ──
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!MEEZ_TOKEN) {
    return res.status(500).json({ error: 'MEEZ_API_TOKEN not set in environment variables' })
  }

  try {
    const list = await fetchRecipeList()
    if (!list || list.length === 0) {
      return res.status(200).json({ synced: 0, message: 'No recipes found in Meez' })
    }

    let synced = 0
    let errors = 0
    const groupCache = new Map() // name → id, avoids duplicate DB lookups

    const errors_detail = []

    // Process in batches of 5 concurrently to stay within Vercel's 5s timeout
    const BATCH_SIZE = 5
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const batch = list.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(async (item) => {
        try {
          const [detail, steps, data] = await Promise.all([
            fetchRecipeDetail(item.id),
            fetchRecipeSteps(item.id),
            fetchRecipeData(item.id),
          ])

          if (!detail) {
            errors++
            errors_detail.push(`Recipe ${item.id}: failed to fetch detail`)
            return
          }

          const ingredients = parseIngredients(detail)
          const recipeBooks = (data?.recipe_books_on || []).map(b => b.name)
          const allergens   = (data?.allergies || []).map(a => a.name)
          const groupName   = recipeBooks[0] || 'Uncategorized'
          const yieldQty    = detail.total_efficiency_str || detail.yield_qty || null
          const yieldUnit   = detail.total_efficiency_unit?.name || detail.yield_unit?.name || null
          const imageUrl    = detail.featured_media?.media || null

          const record = {
            meez_id:      String(item.id),
            name:         detail.name || item.name,
            group_name:   groupName,
            recipe_books: recipeBooks,
            allergens,
            yield_qty:    yieldQty ? String(yieldQty) : null,
            yield_unit:   yieldUnit || null,
            ingredients,
            steps,
            image_url:    imageUrl,
            notes:        detail.notes || null,
            synced_at:    new Date().toISOString(),
          }

          const { data: upserted, error } = await supabase
            .from('recipes')
            .upsert(record, { onConflict: 'meez_id' })
            .select('id')
            .single()

          if (error || !upserted) {
            console.error(`Upsert error for ${item.id}:`, error?.message)
            errors++
            return
          }

          for (const bookName of recipeBooks) {
            const groupId = await ensureGroup(bookName, groupCache)
            if (groupId) await linkRecipeToGroup(upserted.id, groupId)
          }

          if (recipeBooks.length === 0) {
            const groupId = await ensureGroup('Uncategorized', groupCache)
            if (groupId) await linkRecipeToGroup(upserted.id, groupId)
          }

          synced++
        } catch (err) {
          console.error(`Error processing recipe ${item.id}:`, err.message)
          errors++
        }
      }))
    }

    const groupsCreated = groupCache.size

    return res.status(200).json({
      synced,
      errors,
      total: list.length,
      groupsCreated,
      message: `${synced} recipes synced, ${groupsCreated} group${groupsCreated !== 1 ? 's' : ''} created/updated${errors > 0 ? `, ${errors} errors` : ''}`,
    })

  } catch (err) {
    console.error('Meez sync error:', err)
    return res.status(500).json({ error: err.message || 'Sync failed' })
  }
}
