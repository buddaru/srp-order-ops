import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCurrentLocation } from '../context/LocationContext'
import { MENU, CATEGORIES } from '../data/menuData'
import { invalidateMenuCache } from '../hooks/useMenuItems'
import { fmtCost } from '../utils/costCalculator'
import PageHeader from './PageHeader'
import styles from './MenuManager.module.css'

const ChevronIcon = () => (<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>)
const PlusIcon    = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>)
const TrashIcon   = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>)
const LinkIcon    = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>)

function PriceCell({ price, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(price))

  const commit = async () => {
    const p = parseInt(draft)
    if (isNaN(p) || p < 0) { setDraft(String(price)); setEditing(false); return }
    if (p === price) { setEditing(false); return }
    await onSave(p)
    setEditing(false)
  }

  if (editing) return (
    <div className={styles.priceEdit}>
      <span className={styles.priceDollar}>$</span>
      <input className={styles.priceInput} type="number" min="0" value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key==='Enter') commit(); if (e.key==='Escape') { setDraft(String(price)); setEditing(false) } }}
        autoFocus />
    </div>
  )
  return (
    <button className={styles.priceBtn} onClick={() => { setDraft(String(price)); setEditing(true) }}>
      ${price}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{marginLeft:3,opacity:0.45}}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  )
}

function VariantsTab({ itemId }) {
  const [variants, setVariants] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [newName,  setNewName]  = useState('')
  const [newDelta, setNewDelta] = useState('')
  const [adding,   setAdding]   = useState(false)

  useEffect(() => {
    supabase.from('menu_item_variants').select('*').eq('menu_item_id', itemId).order('sort_order')
      .then(({ data }) => { setVariants(data || []); setLoading(false) })
  }, [itemId])

  const add = async () => {
    if (!newName.trim()) return
    setAdding(true)
    const { data } = await supabase.from('menu_item_variants').insert({
      menu_item_id: itemId, name: newName.trim(), price_delta: parseFloat(newDelta) || 0, sort_order: variants.length,
    }).select().single()
    if (data) setVariants(v => [...v, data])
    setNewName(''); setNewDelta(''); setAdding(false)
  }

  const remove = async (id) => {
    await supabase.from('menu_item_variants').delete().eq('id', id)
    setVariants(v => v.filter(x => x.id !== id))
  }

  const update = async (id, field, val) => {
    await supabase.from('menu_item_variants').update({ [field]: val }).eq('id', id)
    setVariants(v => v.map(x => x.id === id ? { ...x, [field]: val } : x))
  }

  if (loading) return <div className={styles.tabLoading}>Loading…</div>

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHint}>Variants are options a customer picks from — e.g. cupcake flavors. Each can have a price delta.</div>
      {variants.length > 0 && (
        <div className={styles.variantList}>
          <div className={styles.variantHeader}><span>Option name</span><span>Price delta</span><span/></div>
          {variants.map(v => (
            <div key={v.id} className={styles.variantRow}>
              <input className={styles.inlineInput} value={v.name} onChange={e => update(v.id, 'name', e.target.value)} />
              <div className={styles.deltaWrap}>
                <span className={styles.deltaSign}>+$</span>
                <input className={styles.inlineInputSm} type="number" step="0.01" value={v.price_delta}
                  onChange={e => update(v.id, 'price_delta', parseFloat(e.target.value) || 0)} />
              </div>
              <button className={styles.removeBtn} onClick={() => remove(v.id)}><TrashIcon /></button>
            </div>
          ))}
        </div>
      )}
      <div className={styles.addRow}>
        <input className={styles.inlineInput} placeholder="Variant name (e.g. Red Velvet)" value={newName}
          onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <div className={styles.deltaWrap}>
          <span className={styles.deltaSign}>+$</span>
          <input className={styles.inlineInputSm} type="number" step="0.01" placeholder="0" value={newDelta}
            onChange={e => setNewDelta(e.target.value)} />
        </div>
        <button className={styles.addSmBtn} onClick={add} disabled={adding || !newName.trim()}><PlusIcon /> Add</button>
      </div>
    </div>
  )
}

function AddonsTab({ itemId }) {
  const [addons,   setAddons]  = useState([])
  const [loading,  setLoading] = useState(true)
  const [newName,  setNewName] = useState('')
  const [newPrice, setNewPrice]= useState('')
  const [newCat,   setNewCat]  = useState('')
  const [adding,   setAdding]  = useState(false)

  useEffect(() => {
    supabase.from('menu_item_addons').select('*').eq('menu_item_id', itemId).order('sort_order')
      .then(({ data }) => { setAddons(data || []); setLoading(false) })
  }, [itemId])

  const add = async () => {
    if (!newName.trim()) return
    setAdding(true)
    const { data } = await supabase.from('menu_item_addons').insert({
      menu_item_id: itemId, name: newName.trim(), price: parseFloat(newPrice) || 0,
      category: newCat.trim() || null, sort_order: addons.length,
    }).select().single()
    if (data) setAddons(a => [...a, data])
    setNewName(''); setNewPrice(''); setNewCat(''); setAdding(false)
  }

  const remove = async (id) => {
    await supabase.from('menu_item_addons').delete().eq('id', id)
    setAddons(a => a.filter(x => x.id !== id))
  }

  const update = async (id, field, val) => {
    await supabase.from('menu_item_addons').update({ [field]: val }).eq('id', id)
    setAddons(a => a.map(x => x.id === id ? { ...x, [field]: val } : x))
  }

  if (loading) return <div className={styles.tabLoading}>Loading…</div>

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHint}>Add-ons are customizations customers can request — e.g. Edible Glitter, Frosting Color, Printed Image.</div>
      {addons.length > 0 && (
        <div className={styles.variantList}>
          <div className={styles.addonHeader}><span>Add-on name</span><span>Category</span><span>Price</span><span/></div>
          {addons.map(a => (
            <div key={a.id} className={styles.addonRow}>
              <input className={styles.inlineInput} value={a.name} onChange={e => update(a.id, 'name', e.target.value)} />
              <input className={styles.inlineInputSm} placeholder="Category" value={a.category || ''}
                onChange={e => update(a.id, 'category', e.target.value)} />
              <div className={styles.deltaWrap}>
                <span className={styles.deltaSign}>+$</span>
                <input className={styles.inlineInputSm} type="number" step="0.01" value={a.price}
                  onChange={e => update(a.id, 'price', parseFloat(e.target.value) || 0)} />
              </div>
              <button className={styles.removeBtn} onClick={() => remove(a.id)}><TrashIcon /></button>
            </div>
          ))}
        </div>
      )}
      <div className={styles.addRow}>
        <input className={styles.inlineInput} placeholder="Add-on name (e.g. Edible Glitter)" value={newName}
          onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <input className={styles.inlineInputSm} placeholder="Category" value={newCat}
          onChange={e => setNewCat(e.target.value)} />
        <div className={styles.deltaWrap}>
          <span className={styles.deltaSign}>+$</span>
          <input className={styles.inlineInputSm} type="number" step="0.01" placeholder="0" value={newPrice}
            onChange={e => setNewPrice(e.target.value)} />
        </div>
        <button className={styles.addSmBtn} onClick={add} disabled={adding || !newName.trim()}><PlusIcon /> Add</button>
      </div>
    </div>
  )
}

function CostTab({ itemId, itemPrice }) {
  const [links,     setLinks]     = useState([])
  const [recipes,   setRecipes]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [selRecipe, setSelRecipe] = useState('')
  const [portions,  setPortions]  = useState('1')
  const [adding,    setAdding]    = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('menu_item_recipes')
        .select('*, recipe:recipes(id, name, cached_cost, cost_per_serving, yield_qty, yield_unit)')
        .eq('menu_item_id', itemId).order('sort_order'),
      supabase.from('recipes').select('id, name, cached_cost, yield_qty, yield_unit').order('name'),
    ]).then(([{ data: l }, { data: r }]) => { setLinks(l || []); setRecipes(r || []); setLoading(false) })
  }, [itemId])

  const add = async () => {
    if (!selRecipe) return
    setAdding(true)
    const { data } = await supabase.from('menu_item_recipes').insert({
      menu_item_id: itemId, recipe_id: selRecipe, portions: parseFloat(portions) || 1, sort_order: links.length,
    }).select('*, recipe:recipes(id, name, cached_cost, cost_per_serving, yield_qty, yield_unit)').single()
    if (data) setLinks(l => [...l, data])
    setSelRecipe(''); setPortions('1'); setAdding(false)
  }

  const remove = async (id) => {
    await supabase.from('menu_item_recipes').delete().eq('id', id)
    setLinks(l => l.filter(x => x.id !== id))
  }

  const updatePortions = async (id, val) => {
    const p = parseFloat(val) || 1
    await supabase.from('menu_item_recipes').update({ portions: p }).eq('id', id)
    setLinks(l => l.map(x => x.id === id ? { ...x, portions: p } : x))
  }

  const totalCost = links.reduce((sum, link) => {
    const cps = link.recipe?.cost_per_serving
    return cps != null ? sum + parseFloat(cps) * (parseFloat(link.portions) || 1) : sum
  }, 0)

  const hasAllCosts = links.length > 0 && links.every(l => l.recipe?.cost_per_serving != null)
  const margin = hasAllCosts && itemPrice > 0
    ? ((itemPrice - totalCost) / itemPrice * 100).toFixed(1) : null

  if (loading) return <div className={styles.tabLoading}>Loading…</div>

  return (
    <div className={styles.tabContent}>
      <div className={styles.tabHint}>
        Link recipes that make up this menu item. Set how many portions of each go into one unit sold.
        Cost per serving on each recipe must be set first (via Ingredients page).
      </div>
      {links.length > 0 && (
        <div className={styles.costLinks}>
          {links.map(link => {
            const r = link.recipe
            const cps = r?.cost_per_serving
            const lineCost = cps != null ? parseFloat(cps) * (parseFloat(link.portions) || 1) : null
            return (
              <div key={link.id} className={styles.costLinkRow}>
                <div className={styles.costLinkName}>
                  {r?.name || 'Unknown'}
                  {r?.yield_qty && <span className={styles.costLinkYield}>yields {r.yield_qty}{r.yield_unit ? ' ' + r.yield_unit : ''}</span>}
                </div>
                <div className={styles.costLinkPortion}>
                  <label className={styles.portionLabel}>Portions</label>
                  <input className={styles.portionInput} type="number" min="0.1" step="0.5"
                    value={link.portions} onChange={e => updatePortions(link.id, e.target.value)} />
                </div>
                <div className={styles.costLinkCost}>
                  {lineCost != null
                    ? <span className={styles.costLinkVal}>${lineCost.toFixed(2)}</span>
                    : <span className={styles.costLinkNone}>unpriced</span>}
                </div>
                <button className={styles.removeBtn} onClick={() => remove(link.id)}><TrashIcon /></button>
              </div>
            )
          })}
          <div className={styles.costTotal}>
            <span className={styles.costTotalLabel}>Total cost to produce</span>
            <span className={styles.costTotalVal}>{hasAllCosts ? `$${totalCost.toFixed(2)}` : '—'}</span>
          </div>
          {margin != null && (
            <div className={styles.costMargin}>
              <span>Sells for ${itemPrice} · Gross margin</span>
              <span className={styles.marginVal}>{margin}%</span>
            </div>
          )}
        </div>
      )}
      <div className={styles.addLinkRow}>
        <select className={styles.recipeSelect} value={selRecipe} onChange={e => setSelRecipe(e.target.value)}>
          <option value="">Select a recipe…</option>
          {recipes.filter(r => !links.find(l => l.recipe_id === r.id)).map(r => (
            <option key={r.id} value={r.id}>
              {r.name}{r.cached_cost != null ? ` ($${parseFloat(r.cached_cost).toFixed(2)} total)` : ''}
            </option>
          ))}
        </select>
        <div className={styles.portionAddWrap}>
          <label className={styles.portionLabel}>Portions</label>
          <input className={styles.portionInput} type="number" min="0.1" step="0.5" placeholder="1"
            value={portions} onChange={e => setPortions(e.target.value)} />
        </div>
        <button className={styles.addSmBtn} onClick={add} disabled={adding || !selRecipe}>
          <LinkIcon /> Link
        </button>
      </div>
    </div>
  )
}

function ItemModal({ item, onClose, onUpdated }) {
  const [tab,    setTab]    = useState('details')
  const [active, setActive] = useState(item.active)
  const [price,  setPrice]  = useState(item.price)

  const savePrice = async (p) => {
    await supabase.from('menu_items').update({ price: p }).eq('id', item.id)
    setPrice(p); invalidateMenuCache(); onUpdated({ ...item, price: p })
  }

  const toggleActive = async () => {
    const next = !active; setActive(next)
    await supabase.from('menu_items').update({ active: next }).eq('id', item.id)
    invalidateMenuCache(); onUpdated({ ...item, active: next })
  }

  const TABS = [
    { id: 'details', label: 'Details' },
    { id: 'cost',    label: 'Cost' },
  ]

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.itemModal}>
        <div className={styles.itemModalHeader}>
          <div>
            <div className={styles.itemModalName}>{item.name}</div>
            <div className={styles.itemModalCat}>{item.category}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.tabBar}>
          {TABS.map(t => (
            <button key={t.id} className={`${styles.tabBtn} ${tab === t.id ? styles.tabBtnActive : ''}`}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className={styles.itemModalBody}>
          {tab === 'details' && (
            <div className={styles.tabContent}>
              <div className={styles.detailRow}>
                <label className={styles.detailLabel}>Base price</label>
                <PriceCell price={price} onSave={savePrice} />
              </div>
              <div className={styles.detailRow}>
                <label className={styles.detailLabel}>Status</label>
                <div className={styles.toggleRow}>
                  <button className={`${styles.toggle} ${active ? styles.toggleOn : ''}`} onClick={toggleActive}>
                    <span className={styles.toggleThumb} />
                  </button>
                  <span className={styles.toggleLabel}>{active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            </div>
          )}
          {tab === 'cost'    && <CostTab     itemId={item.id} itemPrice={price} />}
        </div>
      </div>
    </div>
  )
}

function AddItemModal({ categories, onClose, onSaved, locationId }) {
  const [name,    setName]    = useState('')
  const [cat,     setCat]     = useState(categories[0] || '')
  const [newCat,  setNewCat]  = useState('')
  const [useNew,  setUseNew]  = useState(false)
  const [price,   setPrice]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const finalCat = useNew ? newCat.trim() : cat

  const handleSave = async () => {
    if (!name.trim() || !price || !finalCat) { setError('Name, category, and price are required'); return }
    setSaving(true)
    const { error: err } = await supabase.from('menu_items').insert({
      name: name.trim(), category: finalCat, price: parseInt(price), active: true, sort_order: 999,
      ...(locationId ? { location_id: locationId } : {}),
    })
    if (err) { setError(err.message); setSaving(false); return }
    await supabase.from('menu_categories').upsert({ name: finalCat }, { onConflict: 'name' })
    invalidateMenuCache(); onSaved(); onClose()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Add menu item</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Item name</label>
            <input className="modal-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lemon Pound Cake" autoFocus />
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Category</label>
            {!useNew ? (
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <select className="modal-input" value={cat} onChange={e => setCat(e.target.value)} style={{ flex:1 }}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
                <button type="button" className={styles.newCatBtn} onClick={() => setUseNew(true)}>+ New</button>
              </div>
            ) : (
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input className="modal-input" style={{ flex:1 }} value={newCat}
                  onChange={e => setNewCat(e.target.value)} placeholder="New category name" autoFocus />
                <button type="button" className={styles.newCatBtn} onClick={() => setUseNew(false)}>← Back</button>
              </div>
            )}
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Base price ($)</label>
            <input className="modal-input" type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
          </div>
          {error && <div className={styles.errorMsg}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Adding…' : 'Add item'}</button>
        </div>
      </div>
    </div>
  )
}

function ManageCategoriesModal({ categories, onClose, onUpdated }) {
  const [cats,    setCats]   = useState(categories)
  const [newName, setNewName]= useState('')
  const [adding,  setAdding] = useState(false)

  const addCat = async () => {
    if (!newName.trim()) return
    setAdding(true)
    await supabase.from('menu_categories').insert({ name: newName.trim(), sort_order: cats.length })
    setCats(c => [...c, newName.trim()]); setNewName(''); setAdding(false)
  }

  const removeCat = async (name) => {
    await supabase.from('menu_categories').delete().eq('name', name)
    setCats(c => c.filter(x => x !== name))
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Manage categories</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.catList}>
            {cats.map(c => (
              <div key={c} className={styles.catManageRow}>
                <span>{c}</span>
                <button className={styles.removeBtn} onClick={() => removeCat(c)}><TrashIcon /></button>
              </div>
            ))}
          </div>
          <div className={styles.addRow} style={{ marginTop:8 }}>
            <input className={styles.inlineInput} placeholder="New category name" value={newName}
              onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCat()} />
            <button className={styles.addSmBtn} onClick={addCat} disabled={adding || !newName.trim()}>
              <PlusIcon /> Add
            </button>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.saveBtn} onClick={() => { onUpdated(cats); onClose() }}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Category-level add-ons (stored with menu_item_id = null, category = catName) ──
function CategoryAddonsSection({ catName }) {
  const [open,     setOpen]    = useState(false)
  const [addons,   setAddons]  = useState([])
  const [loading,  setLoading] = useState(false)
  const [newName,  setNewName] = useState('')
  const [newPrice, setNewPrice]= useState('')
  const [adding,   setAdding]  = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    supabase
      .from('menu_item_addons')
      .select('*')
      .is('menu_item_id', null)
      .eq('category', catName)
      .order('sort_order')
      .then(({ data }) => { setAddons(data || []); setLoading(false) })
  }, [open, catName])

  const addAddon = async () => {
    if (!newName.trim()) return
    setAdding(true)
    const { data } = await supabase.from('menu_item_addons').insert({
      menu_item_id: null,
      name:         newName.trim(),
      price:        parseFloat(newPrice) || 0,
      category:     catName,
      sort_order:   addons.length,
    }).select().single()
    if (data) setAddons(a => [...a, data])
    setNewName(''); setNewPrice(''); setAdding(false)
  }

  const removeAddon = async (id) => {
    await supabase.from('menu_item_addons').delete().eq('id', id)
    setAddons(a => a.filter(x => x.id !== id))
  }

  const updateAddon = async (id, field, val) => {
    await supabase.from('menu_item_addons').update({ [field]: val }).eq('id', id)
    setAddons(a => a.map(x => x.id === id ? { ...x, [field]: val } : x))
  }

  return (
    <div className={styles.catAddonsWrap}>
      <button className={styles.catAddonsToggle} onClick={() => setOpen(o => !o)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        <span>Add-ons for {catName}</span>
        {addons.length > 0 && !open && <span className={styles.addonCount}>{addons.length}</span>}
      </button>

      {open && (
        <div className={styles.catAddonsBody}>
          {loading ? (
            <div className={styles.tabLoading}>Loading…</div>
          ) : (
            <>
              <div className={styles.catAddonsHint}>
                Add-ons apply to all items in this category — e.g. Edible Glitter, Frosting Color, Printed Image.
              </div>
              {addons.length > 0 && (
                <div className={styles.variantList}>
                  <div className={styles.addonHeader}><span>Add-on name</span><span>Price</span><span/></div>
                  {addons.map(a => (
                    <div key={a.id} className={styles.addonRow}>
                      <input
                        className={styles.inlineInput}
                        value={a.name}
                        onChange={e => updateAddon(a.id, 'name', e.target.value)}
                      />
                      <div className={styles.deltaWrap}>
                        <span className={styles.deltaSign}>+$</span>
                        <input
                          className={styles.inlineInputSm}
                          type="number" step="0.01"
                          value={a.price}
                          onChange={e => updateAddon(a.id, 'price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <button className={styles.removeBtn} onClick={() => removeAddon(a.id)}><TrashIcon /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.addRow}>
                <input
                  className={styles.inlineInput}
                  placeholder="Add-on name (e.g. Edible Glitter)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addAddon()}
                />
                <div className={styles.deltaWrap}>
                  <span className={styles.deltaSign}>+$</span>
                  <input
                    className={styles.inlineInputSm}
                    type="number" step="0.01" placeholder="0"
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                  />
                </div>
                <button className={styles.addSmBtn} onClick={addAddon} disabled={adding || !newName.trim()}>
                  <PlusIcon /> Add
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, onOpen, onToggle, onPriceChange, canEdit }) {
  return (
    <div className={`${styles.itemRow} ${!item.active ? styles.itemInactive : ''}`}>
      <div className={styles.itemName} onClick={() => onOpen(item)} style={{ cursor:'pointer' }}>{item.name}</div>
      <div className={styles.itemPrice}>
        {canEdit
          ? <PriceCell price={item.price} onSave={p => onPriceChange(item.id, p)} />
          : <span className={styles.priceBtn} style={{cursor:'default'}}>${item.price}</span>
        }
      </div>
      <div className={styles.itemToggle}>
        {canEdit ? (
          <>
            <button className={`${styles.toggle} ${item.active ? styles.toggleOn : ''}`}
              onClick={() => onToggle(item.id, !item.active)}>
              <span className={styles.toggleThumb} />
            </button>
            <span className={styles.toggleLabel}>{item.active ? 'Active' : 'Off'}</span>
          </>
        ) : (
          <span className={styles.toggleLabel} style={{color: item.active ? 'var(--brand)' : 'var(--text-muted)'}}>
            {item.active ? 'Active' : 'Off'}
          </span>
        )}
      </div>
      <button className={styles.detailBtn} onClick={() => onOpen(item)}>Details / Cost ›</button>
    </div>
  )
}

export default function MenuManager() {
  const { isAdmin }  = useAuth()
  const { currentLocation } = useCurrentLocation() || {}
  const [items,      setItems]      = useState([])
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showAdd,    setShowAdd]    = useState(false)
  const [showCatMgr, setShowCatMgr] = useState(false)
  const [openCat,    setOpenCat]    = useState({})
  const [openItem,   setOpenItem]   = useState(null)
  const [seeding,    setSeeding]    = useState(false)
  const [seedMsg,    setSeedMsg]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const locId = currentLocation?.id
    const [{ data: dbItems }, { data: dbCats }] = await Promise.all([
      locId
        ? supabase.from('menu_items').select('*').eq('location_id', locId).order('sort_order').order('name')
        : supabase.from('menu_items').select('*').order('sort_order').order('name'),
      supabase.from('menu_categories').select('name').order('sort_order'),
    ])
    const loadedItems = dbItems || []
    setItems(loadedItems)

    let cats = (dbCats || []).map(c => c.name)
    if (cats.length === 0 && loadedItems.length > 0) {
      const fromItems = [...new Set(loadedItems.map(i => i.category))]
      await supabase.from('menu_categories').upsert(fromItems.map((name, i) => ({ name, sort_order: i })), { onConflict: 'name' })
      cats = fromItems
    } else if (cats.length === 0) {
      cats = CATEGORIES
    }

    setCategories(cats)
    setOpenCat(Object.fromEntries(cats.map(c => [c, true])))
    setLoading(false)
  }, [currentLocation])

  useEffect(() => { load() }, [load])

  const handleToggle = async (id, active) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, active } : i))
    await supabase.from('menu_items').update({ active }).eq('id', id)
    invalidateMenuCache()
  }

  const handlePriceChange = async (id, price) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, price } : i))
    await supabase.from('menu_items').update({ price }).eq('id', id)
    invalidateMenuCache()
  }

  const handleSeedFromDefaults = async () => {
    setSeeding(true); setSeedMsg('')
    const locId = currentLocation?.id
    const rows = MENU.map((m, i) => ({
      name: m.name, category: m.category, price: m.price, active: true, sort_order: i,
      ...(locId ? { location_id: locId } : {}),
    }))
    const { error } = await supabase.from('menu_items').upsert(rows, { onConflict: 'name,category,location_id' })
    if (error) setSeedMsg('Error: ' + error.message)
    else { setSeedMsg(`Loaded ${rows.length} items.`); invalidateMenuCache(locId); load() }
    setSeeding(false)
  }

  const allCats = [...categories]
  items.forEach(i => { if (!allCats.includes(i.category)) allCats.push(i.category) })

  const activeCount   = items.filter(i => i.active).length
  const inactiveCount = items.filter(i => !i.active).length

  return (
    <div className={styles.page}>
      <PageHeader title="Menu & Pricing">
        {isAdmin && <button className="btn btn-secondary" onClick={() => setShowCatMgr(true)}>Manage categories</button>}
        {isAdmin && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add item</button>}
      </PageHeader>

      <div className={styles.statsRow}>
        <div className={styles.stat}><span className={styles.statNum}>{items.length}</span><span className={styles.statLabel}>Total items</span></div>
        <div className={styles.stat}><span className={styles.statNum} style={{ color:'var(--brand)' }}>{activeCount}</span><span className={styles.statLabel}>Active</span></div>
        <div className={styles.stat}><span className={styles.statNum} style={{ color:'var(--text-muted)' }}>{inactiveCount}</span><span className={styles.statLabel}>Inactive</span></div>
      </div>

      {items.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>No menu items yet</div>
          <div className={styles.emptyMsg}>Load your current menu from defaults, or add items one by one.</div>
          {seedMsg && <div className={styles.seedMsg}>{seedMsg}</div>}
          <button className={styles.seedBtn} onClick={handleSeedFromDefaults} disabled={seeding}>
            {seeding ? 'Loading…' : 'Load default menu'}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className={styles.hint}>
            Click a price to edit. Click an item name or "Variants / Add-ons" to manage flavors, customizations, and recipe costing.
          </div>
          {seedMsg && <div className={styles.seedMsgInline}>{seedMsg}</div>}
          <div className={styles.categoryList}>
            {allCats.map(cat => {
              const catItems = items.filter(i => i.category === cat)
              if (!catItems.length) return null
              const isOpen = openCat[cat] !== false
              return (
                <div key={cat} className={styles.categoryBlock}>
                  <button className={styles.catHeader} onClick={() => setOpenCat(p => ({ ...p, [cat]: !isOpen }))}>
                    <span className={styles.catName}>{cat}</span>
                    <span className={styles.catCount}>{catItems.length} items · {catItems.filter(i => i.active).length} active</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s', flexShrink:0 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div className={styles.catItems}>
                      <div className={styles.itemsHeader}><span>Item</span><span>Base price</span><span>Status</span><span/></div>
                      {catItems.map(item => (
                        <ItemRow key={item.id} item={item} onOpen={setOpenItem}
                          onToggle={handleToggle} onPriceChange={handlePriceChange} canEdit={isAdmin} />
                      ))}
                      <CategoryAddonsSection catName={cat} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {showAdd    && <AddItemModal categories={categories.length > 0 ? categories : CATEGORIES} onClose={() => setShowAdd(false)} onSaved={load} locationId={currentLocation?.id} />}
      {showCatMgr && <ManageCategoriesModal categories={categories} onClose={() => setShowCatMgr(false)} onUpdated={cats => { setCategories(cats); load() }} />}
      {openItem   && <ItemModal item={openItem} onClose={() => setOpenItem(null)} onUpdated={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))} />}
    </div>
  )
}
