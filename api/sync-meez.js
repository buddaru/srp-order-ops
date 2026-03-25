// api/sync-meez.js
// Vercel serverless function — syncs recipes from Meez into Supabase

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
  'Accept': 'application/json',
  'Origin': 'https://app.getmeez.com',
  'Referer': 'https://app.getmeez.com/',
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
  return (detail.ingredients || []).map(ing => ({
    meez_id: ing.id,
    name:    ing.ingredient?.name || ing.name || '',
    qty:     ing.quantity || '',
    unit:    ing.unit?.name || ing.unit || '',
    note:    ing.note || '',
    type:    ing.sub_recipe ? 'sub_recipe' : 'item',
  }))
}

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

    for (const item of list) {
      try {
        const [detail, steps, data] = await Promise.all([
          fetchRecipeDetail(item.id),
          fetchRecipeSteps(item.id),
          fetchRecipeData(item.id),
        ])

        if (!detail) { errors++; continue }

        const ingredients = parseIngredients(detail)

        // Recipe books — array e.g. ["Cakes", "Cupcakes"]
        const recipeBooks = (data?.recipe_books_on || []).map(b => b.name)

        // Allergens — array e.g. ["Milk", "Eggs", "Wheat", "Soy"]
        const allergens = (data?.allergies || []).map(a => a.name)

        // Keep group_name as primary book for backwards compat
        const groupName = recipeBooks[0] || 'Uncategorized'

        const yieldQty  = detail.yield_qty || null
        const yieldUnit = detail.yield_unit?.name || detail.yield_unit || null

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
          image_url:    detail.image || detail.photo || null,
          notes:        detail.notes || null,
          synced_at:    new Date().toISOString(),
        }

        const { error } = await supabase
          .from('recipes')
          .upsert(record, { onConflict: 'meez_id' })

        if (error) {
          console.error(`Upsert error for ${item.id}:`, error.message)
          errors++
        } else {
          synced++
        }
      } catch (err) {
        console.error(`Error processing recipe ${item.id}:`, err.message)
        errors++
      }
    }

    return res.status(200).json({
      synced,
      errors,
      total: list.length,
      message: `${synced} recipes synced from Meez${errors > 0 ? `, ${errors} errors` : ''}`,
    })

  } catch (err) {
    console.error('Meez sync error:', err)
    return res.status(500).json({ error: err.message || 'Sync failed' })
  }
}
