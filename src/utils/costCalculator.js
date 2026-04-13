// ── Unit Conversion & Recipe Cost Calculator ──────────────────

// Weight conversions — base unit: grams
const WEIGHT_TO_G = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
}

// Volume conversions — base unit: ml
const VOL_TO_ML = {
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000,
  cup: 236.588, cups: 236.588,
  tbsp: 14.787, tablespoon: 14.787, tablespoons: 14.787,
  tsp: 4.929, teaspoon: 4.929, teaspoons: 4.929,
  'fl oz': 29.574, fl_oz: 29.574, 'fluid oz': 29.574,
}

// Count units — just pass through numerically
const COUNT_UNITS = new Set(['each', 'piece', 'pieces', 'whole', 'unit', 'units', ''])

function getCategory(unit) {
  const u = (unit || '').toLowerCase().trim()
  if (WEIGHT_TO_G[u] !== undefined) return 'weight'
  if (VOL_TO_ML[u] !== undefined) return 'volume'
  if (COUNT_UNITS.has(u)) return 'count'
  return null
}

function toBase(qty, unit) {
  const u = (unit || '').toLowerCase().trim()
  if (WEIGHT_TO_G[u] !== undefined) return { base: qty * WEIGHT_TO_G[u], cat: 'weight' }
  if (VOL_TO_ML[u] !== undefined)  return { base: qty * VOL_TO_ML[u],  cat: 'volume' }
  if (COUNT_UNITS.has(u))           return { base: qty,                  cat: 'count'  }
  return null
}

function fromBase(baseQty, unit, cat) {
  const u = (unit || '').toLowerCase().trim()
  if (cat === 'weight' && WEIGHT_TO_G[u] !== undefined) return baseQty / WEIGHT_TO_G[u]
  if (cat === 'volume' && VOL_TO_ML[u]   !== undefined) return baseQty / VOL_TO_ML[u]
  if (cat === 'count'  && COUNT_UNITS.has(u))           return baseQty
  return null
}

// Convert qty from fromUnit to toUnit. Returns null on mismatch/unknown.
export function convertUnits(qty, fromUnit, toUnit) {
  const from = toBase(qty, fromUnit)
  if (!from) return null
  return fromBase(from.base, toUnit, from.cat)
}

// Check if two units are compatible (same category)
export function unitsCompatible(unitA, unitB) {
  return getCategory(unitA) !== null && getCategory(unitA) === getCategory(unitB)
}

// ── Normalize ingredient name for matching ──
export function normalizeName(name) {
  return (name || '').toLowerCase().trim()
}

// ── Build a lookup map from ingredients array ──
// Returns Map<normalizedName, ingredient>
export function buildIngredientMap(ingredients) {
  const map = new Map()
  for (const ing of (ingredients || [])) {
    map.set(normalizeName(ing.name), ing)
  }
  return map
}

// ── Calculate cost for a single ingredient row ──
// Returns { cost: number|null, reason: string }
export function calcIngredientCost(row, ingredientMap) {
  if (!row || row.type !== 'item') return { cost: null, reason: 'not_item' }

  const libraryEntry = ingredientMap.get(normalizeName(row.name))
  if (!libraryEntry) return { cost: null, reason: 'not_in_library' }

  const price = parseFloat(libraryEntry.purchase_price)
  if (!price || price <= 0) return { cost: null, reason: 'unpriced' }

  const qty = parseFloat(row.qty)
  if (!qty || isNaN(qty)) return { cost: null, reason: 'no_qty' }

  const recipeUnit   = (row.unit || '').toLowerCase().trim()
  const purchaseUnit = (libraryEntry.purchase_unit || '').toLowerCase().trim()

  // If same unit, no conversion needed
  let convertedQty
  if (recipeUnit === purchaseUnit) {
    convertedQty = qty
  } else {
    convertedQty = convertUnits(qty, recipeUnit, purchaseUnit)
    if (convertedQty === null) return { cost: null, reason: 'unit_mismatch' }
  }

  const yieldFactor  = (parseFloat(libraryEntry.yield_pct) || 100) / 100
  const effectiveQty = convertedQty / yieldFactor

  return { cost: effectiveQty * price, reason: 'ok' }
}

// ── Calculate full recipe cost ──
// Returns { totalCost, costPerServing, unpriced, breakdown }
export function calculateRecipeCost(recipe, ingredientMap) {
  const items    = (recipe.ingredients || []).filter(r => r.type === 'item')
  const servings = parseInt(recipe.yield_qty) || parseInt(recipe.servings) || 1

  let totalCost   = 0
  let hasUnpriced = false
  const breakdown = []

  for (const row of items) {
    const { cost, reason } = calcIngredientCost(row, ingredientMap)
    breakdown.push({ name: row.name, qty: row.qty, unit: row.unit, cost, reason })
    if (cost !== null) {
      totalCost += cost
    } else {
      hasUnpriced = true
    }
  }

  const costPerServing = servings > 0 ? totalCost / servings : totalCost

  return {
    totalCost:      hasUnpriced ? null : totalCost,
    partialCost:    totalCost, // always the sum of priced items
    costPerServing: hasUnpriced ? null : costPerServing,
    partialCostPerServing: servings > 0 ? totalCost / servings : totalCost,
    unpricedCount:  breakdown.filter(b => b.cost === null).length,
    pricedCount:    breakdown.filter(b => b.cost !== null).length,
    breakdown,
  }
}

// ── Recalculate all recipes that use a given ingredient ──
// Call this after saving an ingredient in the library
export async function recalculateAffectedRecipes(supabase, changedIngredientName) {
  try {
    // Fetch all ingredients for the map
    const { data: allIngredients } = await supabase.from('ingredients').select('*')
    if (!allIngredients) return

    const ingredientMap = buildIngredientMap(allIngredients)

    // Fetch all recipes
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, name, ingredients, yield_qty, servings')

    if (!recipes) return

    const normalizedChanged = normalizeName(changedIngredientName)

    const affected = recipes.filter(r =>
      (r.ingredients || [])
        .filter(i => i.type === 'item')
        .some(i => normalizeName(i.name) === normalizedChanged)
    )

    for (const recipe of affected) {
      const { partialCost, partialCostPerServing } = calculateRecipeCost(recipe, ingredientMap)
      await supabase.from('recipes').update({
        cached_cost:      partialCost,
        cost_per_serving: partialCostPerServing,
        cost_updated_at:  new Date().toISOString(),
      }).eq('id', recipe.id)
    }
  } catch (e) {
    console.warn('recalculateAffectedRecipes error:', e.message)
  }
}

// ── Format currency ──
export function fmtCost(val) {
  if (val === null || val === undefined) return '—'
  return '$' + Number(val).toFixed(2)
}

// ── All available purchase units ──
export const PURCHASE_UNITS = [
  { value: 'oz',   label: 'oz (ounce)' },
  { value: 'lb',   label: 'lb (pound)' },
  { value: 'g',    label: 'g (gram)' },
  { value: 'kg',   label: 'kg (kilogram)' },
  { value: 'cup',  label: 'cup' },
  { value: 'tbsp', label: 'tbsp (tablespoon)' },
  { value: 'tsp',  label: 'tsp (teaspoon)' },
  { value: 'ml',   label: 'ml (milliliter)' },
  { value: 'l',    label: 'l (liter)' },
  { value: 'each', label: 'each / piece' },
  { value: 'fl oz', label: 'fl oz' },
]
