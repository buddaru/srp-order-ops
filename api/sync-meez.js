// api/sync-meez.js
// Syncs recipes from Meez into Supabase in chunks of 10 per call.
// The frontend keeps calling until hasMore is false.
// Now pulls: images, videos, allergens, recipe history

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
)

const MEEZ_TOKEN  = process.env.MEEZ_API_TOKEN
const MEEZ_ORG    = process.env.MEEZ_ORG_ID || '6380'
const MEEZ_BASE   = 'https://api.getmeez.com/api/v1'
const CHUNK_SIZE  = 10

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
  const allRecipes = []
  let url = `https://api.getmeez.com/api/v2/table_page/recipes/?ordering=-last_viewed&page=1&per_page=25&query=&personal=false&adding_filters=false`

  while (url) {
    const res = await fetch(url, { headers: meezHeaders })
    if (!res.ok) throw new Error(`Meez list fetch failed: ${res.status}`)
    const data = await res.json()
    const results = data.results || []
    const srp = results.filter(r =>
      r.concepts && r.concepts.some(c => c.id === 864)
    )
    allRecipes.push(...srp)
    url = data.next || null
  }

  return allRecipes
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
      media:     s.media || s.step_media || s.image || s.photo || null,
    }))
}

async function fetchRecipeData(id) {
  const url = `${MEEZ_BASE}/recipes/${id}/data/?organization=${MEEZ_ORG}`
  const res  = await fetch(url, { headers: meezHeaders })
  if (!res.ok) return null
  return res.json()
}

// ── NEW: fetch all media (images + videos) for a recipe ──
async function fetchRecipeMedia(id) {
  const url = `${MEEZ_BASE}/recipes/${id}/media/?organization=${MEEZ_ORG}`
  const res  = await fetch(url, { headers: meezHeaders })
  if (!res.ok) return { images: [], videos: [] }
  const data = await res.json()
  const items = Array.isArray(data) ? data : data.results || []

  const images = []
  const videos = []

  for (const m of items) {
    const mediaType = (m.media_type || m.type || '').toLowerCase()
    const src = m.media || m.url || m.file || null
    if (!src) continue

    if (mediaType.includes('video')) {
      videos.push({
        url:       src,
        thumbnail: m.thumbnail || m.poster || null,
        label:     m.label || m.name || null,
        order:     m.order ?? videos.length,
      })
    } else {
      images.push({
        url:   src,
        label: m.label || m.name || null,
        order: m.order ?? images.length,
      })
    }
  }

  return { images, videos }
}

// ── NEW: fetch recipe revision history ──
async function fetchRecipeHistory(id) {
  const url = `${MEEZ_BASE}/recipes/${id}/history/?organization=${MEEZ_ORG}`
  const res  = await fetch(url, { headers: meezHeaders })
  if (!res.ok) return []
  const data = await res.json()
  const items = Array.isArray(data) ? data : data.results || []

  return items.map(h => ({
    version:    h.version || h.id || null,
    changed_by: h.changed_by?.username || h.user?.username || h.changed_by || null,
    changed_at: h.changed_at || h.created_at || null,
    summary:    h.change_summary || h.summary || h.description || null,
  }))
}

function parseIngredients(detail) {
  const subRecipeMap = {}
  for (const sr of (detail.sub_recipes || [])) {
    subRecipeMap[sr.id] = sr.name
  }

  return (detail.recipe_items || []).map(item => {
    if (item.is_header) {
      return { type: 'header', label: item.name || item.description || '' }
    }
    if (item.is_note) {
      return { type: 'note', text: item.description || item.name || '' }
    }
    const subrecipeId = item.subrecipe
    const name =
      (subrecipeId && subRecipeMap[subrecipeId]) ||
      item.ingredient?.name ||
      item.ingredient_name ||
      item.badingredient?.name ||
      item.invalid_subrecipe_name ||
      item.description ||
      item.name ||
      ''
    const qty  = item.quantity_str || String(item.quantity || '')
    const unit = item.unit?.name || ''
    const note = item.preparation_note || ''
    return { type: 'item', qty, unit, name, note }
  })
}

async function ensureGroup(name, groupCache) {
  if (groupCache.has(name)) return groupCache.get(name)

  const { data, error } = await supabase
    .from('recipe_groups')
    .upsert({ name }, { onConflict: 'name', ignoreDuplicates: false })
    .select('id')
    .single()

  if (data?.id) {
    groupCache.set(name, data.id)
    return data.id
  }

  const { data: existing } = await supabase
    .from('recipe_groups').select('id').eq('name', name).maybeSingle()
  if (existing?.id) {
    groupCache.set(name, existing.id)
    return existing.id
  }

  return null
}

async function linkRecipeToGroup(recipeId, groupId) {
  await supabase.from('recipe_group_members')
    .upsert({ group_id: groupId, recipe_id: recipeId }, { onConflict: 'group_id,recipe_id' })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!MEEZ_TOKEN) return res.status(500).json({ error: 'MEEZ_API_TOKEN not set' })

  const locationId   = req.body?.location_id || null
  // Pass ?resync=true to force re-fetch all recipes (picks up new fields on existing recipes)
  const forceResync = req.query.resync === 'true' || req.body?.resync === true

  try {
    const list = await fetchRecipeList()
    if (!list || list.length === 0) {
      return res.status(200).json({ synced: 0, hasMore: false, message: 'No recipes found in Meez' })
    }

    const { data: existing } = await supabase
      .from('recipes').select('meez_id').not('meez_id', 'is', null)
    const syncedIds = new Set((existing || []).map(r => r.meez_id))

    // If resyncing, process all; otherwise only new ones
    const pending = forceResync ? list : list.filter(r => !syncedIds.has(String(r.id)))
    const chunk   = pending.slice(0, CHUNK_SIZE)

    if (chunk.length === 0) {
      return res.status(200).json({
        synced: 0,
        hasMore: false,
        total: list.length,
        message: 'All recipes already synced. Pass ?resync=true to force refresh.',
      })
    }

    let synced = 0
    let errors = 0
    const groupCache = new Map()

    await Promise.all(chunk.map(async (item) => {
      try {
        const [detail, steps, data, media, history] = await Promise.all([
          fetchRecipeDetail(item.id),
          fetchRecipeSteps(item.id),
          fetchRecipeData(item.id),
          fetchRecipeMedia(item.id),       // ── NEW
          fetchRecipeHistory(item.id),     // ── NEW
        ])

        if (!detail) { errors++; return }

        const ingredients = parseIngredients(detail)
        const recipeBooks = (data?.recipe_books_on || []).map(b => b.name)
        const allergens   = (data?.allergies || []).map(a => a.name)
        const groupName   = recipeBooks[0] || 'Uncategorized'
        const yieldQty    = detail.total_efficiency_str || null
        const yieldUnit   = detail.total_efficiency_unit?.name || null

        // Featured image: prefer explicit featured_media, fall back to first image
        const featuredImage = detail.featured_media?.media || media.images[0]?.url || null

        const record = {
          meez_id:        String(item.id),
          name:           detail.name || item.name,
          group_name:     groupName,
          recipe_books:   recipeBooks,
          allergens,
          yield_qty:      yieldQty ? String(yieldQty) : null,
          yield_unit:     yieldUnit || null,
          ingredients,
          steps,
          image_url:      featuredImage,
          images:         media.images,
          videos:         media.videos,
          recipe_history: history,
          notes:          detail.notes || null,
          last_viewed:    item.last_viewed || null,
          synced_at:      new Date().toISOString(),
          ...(locationId ? { location_id: locationId } : {}),
        }

        const { data: upserted, error } = await supabase
          .from('recipes')
          .upsert(record, { onConflict: locationId ? 'meez_id,location_id' : 'meez_id' })
          .select('id')
          .single()

        if (error || !upserted) { console.error(`Upsert error ${item.id}:`, error?.message); errors++; return }

        const books = recipeBooks.length > 0 ? recipeBooks : ['Uncategorized']
        for (const bookName of books) {
          const groupId = await ensureGroup(bookName, groupCache)
          if (groupId) await linkRecipeToGroup(upserted.id, groupId)
        }

        synced++
      } catch (err) {
        console.error(`Error processing ${item.id}:`, err.message)
        errors++
      }
    }))

    const remaining = pending.length - chunk.length
    const hasMore   = remaining > 0

    return res.status(200).json({
      synced,
      errors,
      hasMore,
      remaining,
      total: list.length,
      message: hasMore
        ? `${synced} synced — ${remaining} remaining, syncing…`
        : `All ${list.length} recipes synced`,
    })

  } catch (err) {
    console.error('Meez sync error:', err)
    return res.status(500).json({ error: err.message || 'Sync failed' })
  }
}
