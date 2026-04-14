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

// ── Ingredient densities (grams per cup) ─────────────────────
// Used for cross-category conversions (volume ↔ weight), like Meez.
// Keys are lowercase, partial-match friendly.
const DENSITY_MAP = [
  // Flours
  { keys: ['all-purpose flour', 'all purpose flour', 'ap flour'],         gPerCup: 120 },
  { keys: ['bread flour'],                                                  gPerCup: 120 },
  { keys: ['cake flour'],                                                   gPerCup: 100 },
  { keys: ['whole wheat flour', 'wheat flour'],                             gPerCup: 120 },
  { keys: ['almond flour', 'almond meal'],                                  gPerCup: 96  },
  { keys: ['coconut flour'],                                                gPerCup: 112 },
  { keys: ['semolina'],                                                     gPerCup: 167 },
  { keys: ['flour'],                                                        gPerCup: 120 }, // fallback
  // Sugars
  { keys: ['granulated sugar', 'white sugar', 'cane sugar'],               gPerCup: 200 },
  { keys: ['powdered sugar', 'confectioners sugar', "confectioners' sugar", 'icing sugar'], gPerCup: 120 },
  { keys: ['light brown sugar', 'dark brown sugar', 'brown sugar'],        gPerCup: 220 },
  { keys: ['raw sugar', 'turbinado sugar'],                                 gPerCup: 200 },
  { keys: ['sugar'],                                                        gPerCup: 200 }, // fallback
  // Fats
  { keys: ['butter', 'unsalted butter', 'salted butter'],                  gPerCup: 227 },
  { keys: ['shortening', 'vegetable shortening'],                          gPerCup: 200 },
  { keys: ['vegetable oil', 'canola oil', 'sunflower oil', 'oil'],         gPerCup: 218 },
  { keys: ['coconut oil'],                                                  gPerCup: 218 },
  { keys: ['olive oil'],                                                    gPerCup: 216 },
  { keys: ['lard'],                                                         gPerCup: 205 },
  // Dairy
  { keys: ['whole milk', 'milk'],                                           gPerCup: 240 },
  { keys: ['buttermilk'],                                                   gPerCup: 240 },
  { keys: ['heavy cream', 'heavy whipping cream', 'whipping cream'],       gPerCup: 238 },
  { keys: ['half and half', 'half & half'],                                 gPerCup: 242 },
  { keys: ['sour cream'],                                                   gPerCup: 230 },
  { keys: ['cream cheese'],                                                 gPerCup: 232 },
  { keys: ['yogurt', 'plain yogurt'],                                       gPerCup: 245 },
  { keys: ['condensed milk', 'sweetened condensed milk'],                  gPerCup: 306 },
  { keys: ['evaporated milk'],                                              gPerCup: 252 },
  // Dry goods
  { keys: ['cocoa powder', 'unsweetened cocoa', 'cocoa'],                  gPerCup: 100 },
  { keys: ['baking powder'],                                                gPerCup: 230 },
  { keys: ['baking soda'],                                                  gPerCup: 230 },
  { keys: ['salt', 'table salt'],                                           gPerCup: 273 },
  { keys: ['kosher salt'],                                                  gPerCup: 130 },
  { keys: ['cornstarch', 'corn starch'],                                   gPerCup: 128 },
  { keys: ['rolled oats', 'oats', 'old-fashioned oats'],                  gPerCup: 90  },
  { keys: ['rice', 'white rice'],                                           gPerCup: 185 },
  { keys: ['breadcrumbs', 'bread crumbs'],                                 gPerCup: 108 },
  // Liquids
  { keys: ['water'],                                                        gPerCup: 240 },
  { keys: ['vanilla extract', 'vanilla'],                                  gPerCup: 208 },
  { keys: ['honey'],                                                        gPerCup: 340 },
  { keys: ['maple syrup', 'maple'],                                        gPerCup: 315 },
  { keys: ['corn syrup'],                                                   gPerCup: 328 },
  { keys: ['molasses'],                                                     gPerCup: 340 },
  { keys: ['lemon juice', 'lime juice', 'orange juice', 'juice'],          gPerCup: 240 },
  // Nuts & chips
  { keys: ['chocolate chips', 'mini chocolate chips'],                     gPerCup: 170 },
  { keys: ['chopped nuts', 'walnuts', 'pecans', 'almonds', 'nuts'],        gPerCup: 120 },
  { keys: ['shredded coconut', 'coconut flakes'],                          gPerCup: 93  },
  { keys: ['peanut butter'],                                                gPerCup: 258 },
]

function getDensityGPerCup(ingredientName) {
  const name = (ingredientName || '').toLowerCase().trim()
  if (!name) return null
  // Exact key match first
  for (const entry of DENSITY_MAP) {
    if (entry.keys.includes(name)) return entry.gPerCup
  }
  // Substring match (longest key wins)
  let best = null, bestLen = 0
  for (const entry of DENSITY_MAP) {
    for (const k of entry.keys) {
      if ((name.includes(k) || k.includes(name)) && k.length > bestLen) {
        best = entry.gPerCup
        bestLen = k.length
      }
    }
  }
  return best
}

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

const CUP_IN_ML = 236.588

// Convert qty from fromUnit to toUnit.
// Pass ingredientName for cross-category (volume ↔ weight) conversions via density.
// Returns null on incompatible/unknown units.
export function convertUnits(qty, fromUnit, toUnit, ingredientName = '') {
  const from = toBase(qty, fromUnit)
  if (!from) return null

  // Same-category conversion (weight↔weight, volume↔volume, count↔count)
  const direct = fromBase(from.base, toUnit, from.cat)
  if (direct !== null) return direct

  // Cross-category: volume ↔ weight via ingredient density
  const density = getDensityGPerCup(ingredientName)
  if (density !== null) {
    if (from.cat === 'volume') {
      // volume → weight: ml → cups → grams
      const grams = (from.base / CUP_IN_ML) * density
      const result = fromBase(grams, toUnit, 'weight')
      if (result !== null) return result
    }
    if (from.cat === 'weight') {
      // weight → volume: grams → cups → ml
      const ml = (from.base / density) * CUP_IN_ML
      const result = fromBase(ml, toUnit, 'volume')
      if (result !== null) return result
    }
  }

  return null
}

// Check if two units are compatible (same category, or cross-category via known density)
export function unitsCompatible(unitA, unitB, ingredientName = '') {
  const catA = getCategory(unitA)
  const catB = getCategory(unitB)
  if (catA === null || catB === null) return false
  if (catA === catB) return true
  // Cross-category ok if we have density data for this ingredient
  if ((catA === 'weight' && catB === 'volume') || (catA === 'volume' && catB === 'weight')) {
    return getDensityGPerCup(ingredientName) !== null
  }
  return false
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
    convertedQty = convertUnits(qty, recipeUnit, purchaseUnit, row.name)
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
