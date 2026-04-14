import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { PURCHASE_UNITS, recalculateAffectedRecipes } from '../utils/costCalculator'
import styles from './Ingredients.module.css'

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

function IngredientRow({ ing, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)

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

  if (editing) {
    return (
      <div className={`${styles.row} ${styles.rowEditing}`}>
        <div className={styles.rowName}>
          <span className={styles.ingredientName}>{ing.name}</span>
        </div>

        <div className={styles.pricingExplainer}>
          Enter what you paid and how many you bought — we'll calculate the cost per unit automatically.
        </div>

        <div className={styles.editFields}>
          <div className={styles.editField}>
            <label className={styles.editLabel}>Total amount paid</label>
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
            <label className={styles.editLabel}>How many {draft.purchase_unit} did you buy?</label>
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
              placeholder="e.g. Restaurant Depot, Costco…"
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
          <button className={styles.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
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
        <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); onDelete(ing.id, ing.name) }} title="Remove ingredient">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

// Exported so Recipes.jsx New+ dropdown can open it
export function AddIngredientModal({ onClose, onSaved }) {
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
          <div className={styles.modalTitle}>Add Ingredient</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Ingredient Name</label>
            <input
              className="modal-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Bread Flour"
              autoFocus
            />
          </div>

          <div className={styles.pricingExplainer}>
            Enter what you paid and how many you got — we'll calculate the cost per unit for you.
          </div>

          <div className={styles.formRow2}>
            <div className={styles.formRow}>
              <label className={styles.flabel}>Total amount paid</label>
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
              <label className={styles.flabel}>Purchase unit</label>
              <select className="modal-input" value={unit} onChange={e => setUnit(e.target.value)}>
                {PURCHASE_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div className={styles.formRow}>
              <label className={styles.flabel}>How many {unit} did you buy?</label>
              <input
                className="modal-input"
                type="number" min="0" step="any"
                value={totalQty}
                onChange={e => setTotalQty(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
            {perUnit && (
              <div className={styles.perUnitPreview} style={{ padding: '4px 0' }}>
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
                placeholder="e.g. Restaurant Depot, Costco…"
              />
            </div>
          </div>
          {error && <div className={styles.errorMsg}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Adding…' : 'Add Ingredient'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Main embedded component — used inside Recipes.jsx ingredients tab
// externalSearch: search string passed from parent's search bar
export default function Ingredients({ externalSearch = '' }) {
  const [ingredients, setIngredients] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [delConfirm,  setDelConfirm]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('ingredients').select('*').order('name')
    setIngredients(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (id, updates, ingredientName) => {
    await supabase.from('ingredients').update(updates).eq('id', id)
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    await recalculateAffectedRecipes(supabase, ingredientName)
  }

  const handleDelete = async (id) => {
    await supabase.from('ingredients').delete().eq('id', id)
    setIngredients(prev => prev.filter(i => i.id !== id))
    setDelConfirm(null)
  }

  const filtered = ingredients.filter(i =>
    !externalSearch || i.name.toLowerCase().includes(externalSearch.toLowerCase())
  )
  const unpricedCount = ingredients.filter(i => !i.purchase_price || parseFloat(i.purchase_price) === 0).length
  const pricedCount   = ingredients.length - unpricedCount

  if (loading) {
    return (
      <div className={styles.embeddedWrap}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeletonRow">
            <div className="skeletonLine" style={{ width: `${45 + (i * 13) % 40}%` }} />
            <div style={{ flex: 1 }} />
            <div className="skeletonLine" style={{ width: 80 }} />
          </div>
        ))}
      </div>
    )
  }

  if (ingredients.length === 0) {
    return (
      <div className={styles.embeddedWrap}>
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>No ingredients yet</div>
          <div className={styles.emptyMsg}>
            Use <strong>New → Add Ingredient</strong> to build your ingredient library and enable cost tracking across recipes.
          </div>
        </div>
      </div>
    )
  }

  const showSections = !externalSearch.trim()

  return (
    <div className={styles.embeddedWrap}>
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

      <div className={styles.hint}>
        Click any ingredient to update its price. Recipe costs update automatically when prices change.
      </div>

      {/* Search results mode */}
      {!showSections && (
        <div className={styles.ingredientList}>
          {filtered.length === 0 ? (
            <div className={styles.noResults}>No ingredients match "{externalSearch}"</div>
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

      {/* Sectioned view */}
      {showSections && (
        <>
          {unpricedCount > 0 && (
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

          {pricedCount > 0 && (
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
                Remove <strong>{delConfirm.name}</strong> from the ingredient library?
                This won't affect your recipes — it just removes the pricing data.
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
    </div>
  )
}
