import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { PURCHASE_UNITS, recalculateAffectedRecipes, fmtCost } from '../utils/costCalculator'
import PageHeader from './PageHeader'
import styles from './Ingredients.module.css'

// ── Icons ──
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)
const SyncIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)
const ChevronIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

// ── Single ingredient row (inline edit) ──
function IngredientRow({ ing, onSave, onDelete }) {
  const [editing,   setEditing]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [rdLoading, setRdLoading] = useState(false)
  const [rdResult,  setRdResult]  = useState(null)

  const [draft, setDraft] = useState({
    purchase_unit: ing.purchase_unit || 'oz',
    total_price:   '',
    total_qty:     '',
    yield_pct:     ing.yield_pct != null ? String(ing.yield_pct) : '100',
    supplier:      ing.supplier || '',
  })

  const isUnpriced = !ing.purchase_price || parseFloat(ing.purchase_price) === 0

  const perUnit = (() => {
    const t = parseFloat(draft.total_price)
    const q = parseFloat(draft.total_qty)
    if (t > 0 && q > 0) return (t / q).toFixed(4)
    return null
  })()

  const openEdit = () => {
    const price = parseFloat(ing.purchase_price)
    setDraft({
      purchase_unit: ing.purchase_unit || 'oz',
      total_price:   price > 0 ? String(price) : '',
      total_qty:     price > 0 ? '1' : '',
      yield_pct:     ing.yield_pct != null ? String(ing.yield_pct) : '100',
      supplier:      ing.supplier || '',
    })
    setRdResult(null)
    setEditing(true)
  }

  const handleSave = async () => {
    if (!draft.total_price || !draft.total_qty) return
    const totalP = parseFloat(draft.total_price)
    const totalQ = parseFloat(draft.total_qty)
    if (!totalP || !totalQ || totalQ <= 0) return
    setSaving(true)
    await onSave(ing.id, {
      purchase_unit:  draft.purchase_unit,
      purchase_price: parseFloat((totalP / totalQ).toFixed(6)),
      yield_pct:      parseFloat(draft.yield_pct) || 100,
      supplier:       draft.supplier.trim() || null,
      updated_at:     new Date().toISOString(),
    }, ing.name)
    setSaving(false)
    setEditing(false)
  }

  const fetchRDPrice = async () => {
    setRdLoading(true)
    setRdResult(null)
    try {
      const res  = await fetch(`/api/fetch-rd-price?q=${encodeURIComponent(ing.name)}`)
      const data = await res.json()
      setRdResult(data)
      if (data.price && data.unit) {
        setDraft(p => ({ ...p, total_price: String(data.price), total_qty: '1', purchase_unit: data.unit }))
      }
    } catch {
      setRdResult({ error: 'Could not reach Restaurant Depot.' })
    }
    setRdLoading(false)
  }

  if (editing) {
    return (
      <div className={`${styles.row} ${styles.rowEditing}`}>
        <div className={styles.rowName}>
          <span className={styles.ingredientName}>{ing.name}</span>
        </div>

        <div className={styles.rdRow}>
          <button className={styles.rdBtn} onClick={fetchRDPrice} disabled={rdLoading} type="button">
            {rdLoading ? '⟳ Looking up…' : '🏪 Fetch price from Restaurant Depot'}
          </button>
          {rdResult?.error && <span className={styles.rdError}>{rdResult.error}</span>}
          {rdResult?.name  && <span className={styles.rdFound}>Found: {rdResult.name} — pre-filled below</span>}
          {rdResult?.notFound && (
            <span className={styles.rdError}>
              Not found automatically —{' '}
              <a href={rdResult.searchUrl} target="_blank" rel="noreferrer" className={styles.rdLink}>
                search on Restaurant Depot ↗
              </a>
            </span>
          )}
        </div>

        <div className={styles.editFields}>
          <div className={styles.editField}>
            <label className={styles.editLabel}>Unit</label>
            <select
              className={styles.editSelect}
              value={draft.purchase_unit}
              onChange={e => setDraft(p => ({ ...p, purchase_unit: e.target.value }))}
            >
              {PURCHASE_UNITS.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.editField}>
            <label className={styles.editLabel}>Total paid ($)</label>
            <div className={styles.priceInputWrap}>
              <span className={styles.priceDollar}>$</span>
              <input
                type="number" min="0" step="0.01"
                className={styles.editInput}
                placeholder="e.g. 91.00"
                value={draft.total_price}
                onChange={e => setDraft(p => ({ ...p, total_price: e.target.value }))}
                autoFocus
              />
            </div>
          </div>
          <div className={styles.editField}>
            <label className={styles.editLabel}>Qty purchased</label>
            <input
              type="number" min="0" step="any"
              className={styles.editInput}
              placeholder="e.g. 30"
              value={draft.total_qty}
              onChange={e => setDraft(p => ({ ...p, total_qty: e.target.value }))}
            />
          </div>
          <div className={styles.editField}>
            <label className={styles.editLabel}>Yield %</label>
            <input
              type="number" min="1" max="100"
              className={styles.editInput}
              value={draft.yield_pct}
              onChange={e => setDraft(p => ({ ...p, yield_pct: e.target.value }))}
            />
          </div>
          <div className={`${styles.editField} ${styles.editFieldWide}`}>
            <label className={styles.editLabel}>Supplier (optional)</label>
            <input
              type="text"
              className={styles.editInput}
              placeholder="e.g. Restaurant Depot"
              value={draft.supplier}
              onChange={e => setDraft(p => ({ ...p, supplier: e.target.value }))}
            />
          </div>
        </div>

        {perUnit && (
          <div className={styles.perUnitPreview}>
            = <strong>${perUnit}</strong> per {draft.purchase_unit}
          </div>
        )}

        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={() => { setRdResult(null); setEditing(false) }}>Cancel</button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || !draft.total_price || !draft.total_qty}
          >
            {saving ? 'Saving…' : <><CheckIcon /> Save</>}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.row} ${isUnpriced ? styles.rowUnpriced : styles.rowPriced}`} onClick={openEdit}>
      <div className={styles.rowName}>
        <span className={styles.ingredientName}>{ing.name}</span>
        {isUnpriced && <span className={styles.unpricedBadge}>unpriced</span>}
      </div>
      <div className={styles.rowMeta}>
        {!isUnpriced && (
          <>
            <span className={styles.metaVal}>${parseFloat(ing.purchase_price).toFixed(4)}</span>
            <span className={styles.metaSep}>per</span>
            <span className={styles.metaVal}>{ing.purchase_unit}</span>
          </>
        )}
        {ing.yield_pct && parseFloat(ing.yield_pct) !== 100 && (
          <span className={styles.yieldBadge}>{ing.yield_pct}% yield</span>
        )}
        {ing.supplier && <span className={styles.supplierTag}>{ing.supplier}</span>}
      </div>
      <div className={styles.rowActions}>
        <button className={styles.editBtn} onClick={e => { e.stopPropagation(); openEdit() }}>Edit</button>
        <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); onDelete(ing.id, ing.name) }} title="Remove from library">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

// ── Add ingredient modal ──
function AddIngredientModal({ onClose, onSaved }) {
  const [name,       setName]       = useState('')
  const [unit,       setUnit]       = useState('oz')
  const [totalPrice, setTotalPrice] = useState('')
  const [totalQty,   setTotalQty]   = useState('')
  const [yield_pct,  setYield]      = useState('100')
  const [supplier,   setSupplier]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const perUnit = (() => {
    const t = parseFloat(totalPrice)
    const q = parseFloat(totalQty)
    if (t > 0 && q > 0) return (t / q).toFixed(4)
    return null
  })()

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    const t = parseFloat(totalPrice)
    const q = parseFloat(totalQty)
    const computedPrice = (t > 0 && q > 0) ? parseFloat((t / q).toFixed(6)) : 0
    setSaving(true)
    const { error: err } = await supabase.from('ingredients').insert({
      name:           name.trim(),
      purchase_unit:  unit,
      purchase_price: computedPrice,
      yield_pct:      parseFloat(yield_pct) || 100,
      supplier:       supplier.trim() || null,
    })
    if (err) {
      if (err.message?.includes('unique')) setError('An ingredient with this name already exists')
      else setError(err.message)
      setSaving(false)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Add ingredient</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Name</label>
            <input
              className="modal-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Bread Flour"
              autoFocus
            />
          </div>
          <div className={styles.formRow2}>
            <div className={styles.formRow}>
              <label className={styles.flabel}>Purchase unit</label>
              <select className="modal-input" value={unit} onChange={e => setUnit(e.target.value)}>
                {PURCHASE_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div className={styles.formRow}>
              <label className={styles.flabel}>Total paid ($)</label>
              <div className={styles.priceInputWrap}>
                <span className={styles.priceDollar}>$</span>
                <input
                  className="modal-input"
                  type="number" min="0" step="0.01"
                  value={totalPrice}
                  onChange={e => setTotalPrice(e.target.value)}
                  placeholder="e.g. 91.00"
                />
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.flabel}>Qty purchased</label>
              <input
                className="modal-input"
                type="number" min="0" step="any"
                value={totalQty}
                onChange={e => setTotalQty(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
            {perUnit && (
              <div className={styles.perUnitPreview} style={{padding:'4px 0'}}>
                = <strong>${perUnit}</strong> per {unit}
              </div>
            )}
          </div>
          <div className={styles.formRow2}>
            <div className={styles.formRow}>
              <label className={styles.flabel}>Yield %</label>
              <input
                className="modal-input"
                type="number" min="1" max="100"
                value={yield_pct}
                onChange={e => setYield(e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.flabel}>Supplier (optional)</label>
              <input
                className="modal-input"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                placeholder="e.g. Restaurant Depot"
              />
            </div>
          </div>
          {error && <div className={styles.errorMsg}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Adding…' : 'Add ingredient'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──
export default function Ingredients({ embedded = false }) {
  const [ingredients, setIngredients] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [syncMsg,     setSyncMsg]     = useState('')
  const [showAdd,     setShowAdd]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [delConfirm,  setDelConfirm]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('ingredients').select('*').order('name')
    setIngredients(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Sync: scan all recipes, seed ingredient names not yet in library ──
  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const { data: recipes } = await supabase.from('recipes').select('ingredients')
      const namesFromRecipes  = new Set()

      for (const r of (recipes || [])) {
        for (const item of (r.ingredients || [])) {
          if (item.type === 'item' && item.name?.trim()) {
            namesFromRecipes.add(item.name.trim())
          }
        }
      }

      // Only insert names not already in library (case-insensitive check)
      const existingNames = new Set(ingredients.map(i => i.name.toLowerCase()))
      const toInsert = [...namesFromRecipes].filter(
        n => !existingNames.has(n.toLowerCase())
      )

      if (toInsert.length === 0) {
        setSyncMsg('Library is already up to date — no new ingredients found.')
        setSyncing(false)
        return
      }

      const rows = toInsert.map(name => ({
        name,
        purchase_unit:  'oz',
        purchase_price: 0,
        yield_pct:      100,
      }))

      const { error } = await supabase.from('ingredients').insert(rows)
      if (error) { setSyncMsg('Error: ' + error.message) }
      else {
        setSyncMsg(`Added ${toInsert.length} ingredient${toInsert.length !== 1 ? 's' : ''} from your recipes. Set their prices below.`)
        load()
      }
    } catch (e) {
      setSyncMsg('Error: ' + e.message)
    }
    setSyncing(false)
  }

  const handleSave = async (id, updates, ingredientName) => {
    await supabase.from('ingredients').update(updates).eq('id', id)
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    // Reactively recalculate all recipes that use this ingredient
    await recalculateAffectedRecipes(supabase, ingredientName)
  }

  const handleDelete = async (id, name) => {
    await supabase.from('ingredients').delete().eq('id', id)
    setIngredients(prev => prev.filter(i => i.id !== id))
    setDelConfirm(null)
  }

  const filtered = ingredients.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  )
  const unpricedCount = ingredients.filter(i => !i.purchase_price || parseFloat(i.purchase_price) === 0).length
  const pricedCount   = ingredients.length - unpricedCount

  return (
    <div className={embedded ? styles.embeddedWrap : styles.page}>
      {!embedded && (
        <PageHeader title="Ingredients">
          <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
            <SyncIcon /> {syncing ? 'Syncing…' : 'Sync from recipes'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add ingredient</button>
        </PageHeader>
      )}
      {embedded && (
        <div className={styles.embeddedHeader}>
          <div className={styles.embeddedTitle}>Ingredient Library</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
              <SyncIcon /> {syncing ? 'Syncing…' : 'Sync from recipes'}
            </button>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add ingredient</button>
          </div>
        </div>
      )}

      {syncMsg && (
        <div className={styles.syncBanner}>
          {syncMsg}
          <button className={styles.syncBannerClose} onClick={() => setSyncMsg('')}>✕</button>
        </div>
      )}

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statNum}>{ingredients.length}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum} style={{ color: 'var(--brand)' }}>{pricedCount}</span>
          <span className={styles.statLabel}>Priced</span>
        </div>
        {unpricedCount > 0 && (
          <div className={styles.stat}>
            <span className={styles.statNum} style={{ color: '#c47b1a' }}>{unpricedCount}</span>
            <span className={styles.statLabel}>Need price</span>
          </div>
        )}
      </div>

      {ingredients.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>No ingredients yet</div>
          <div className={styles.emptyMsg}>
            Click <strong>Sync from recipes</strong> to automatically pull all ingredient names from your existing recipes.
            Then set purchase prices for each one to enable cost tracking.
          </div>
          <button className={styles.seedBtn} onClick={handleSync} disabled={syncing}>
            <SyncIcon /> {syncing ? 'Syncing…' : 'Sync from recipes'}
          </button>
        </div>
      )}

      {ingredients.length > 0 && (
        <>
          <div className={styles.hint}>
            Click any ingredient to set its price and purchase unit. Costs on recipes update automatically when prices change.
          </div>

          <div className={styles.searchWrap}>
            <SearchIcon />
            <input
              className={styles.searchInput}
              placeholder="Search ingredients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          {/* Unpriced section */}
          {!search && unpricedCount > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Needs pricing</span>
                <span className={styles.sectionCount}>{unpricedCount}</span>
              </div>
              <div className={styles.ingredientList}>
                {ingredients
                  .filter(i => !i.purchase_price || parseFloat(i.purchase_price) === 0)
                  .map(ing => (
                    <IngredientRow
                      key={ing.id}
                      ing={ing}
                      onSave={handleSave}
                      onDelete={(id, name) => setDelConfirm({ id, name })}
                    />
                  ))
                }
              </div>
            </div>
          )}

          {/* Priced section */}
          {!search && pricedCount > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Priced</span>
                <span className={styles.sectionCount}>{pricedCount}</span>
              </div>
              <div className={styles.ingredientList}>
                {ingredients
                  .filter(i => i.purchase_price && parseFloat(i.purchase_price) > 0)
                  .map(ing => (
                    <IngredientRow
                      key={ing.id}
                      ing={ing}
                      onSave={handleSave}
                      onDelete={(id, name) => setDelConfirm({ id, name })}
                    />
                  ))
                }
              </div>
            </div>
          )}

          {/* Search results */}
          {search && (
            <div className={styles.ingredientList}>
              {filtered.length === 0 ? (
                <div className={styles.noResults}>No ingredients match "{search}"</div>
              ) : (
                filtered.map(ing => (
                  <IngredientRow
                    key={ing.id}
                    ing={ing}
                    onSave={handleSave}
                    onDelete={(id, name) => setDelConfirm({ id, name })}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Delete confirm */}
      {delConfirm && (
        <div className={styles.overlay} onClick={() => setDelConfirm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Remove ingredient?</div>
            </div>
            <div className={styles.modalBody}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
                Remove <strong>{delConfirm.name}</strong> from the ingredients library?
                This won't affect your recipes — it just removes the pricing info.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setDelConfirm(null)}>Cancel</button>
              <button
                className={styles.deleteConfirmBtn}
                onClick={() => handleDelete(delConfirm.id, delConfirm.name)}
              >Remove</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <AddIngredientModal
          onClose={() => setShowAdd(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
