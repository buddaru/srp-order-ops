import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { MENU, CATEGORIES } from '../data/menuData'
import { invalidateMenuCache } from '../hooks/useMenuItems'
import PageHeader from './PageHeader'
import styles from './MenuManager.module.css'

function AddItemModal({ onClose, onSaved }) {
  const [name, setName]     = useState('')
  const [category, setCat]  = useState(CATEGORIES[0])
  const [price, setPrice]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSave = async () => {
    if (!name.trim() || !price) { setError('Name and price are required'); return }
    setSaving(true)
    const { error: err } = await supabase.from('menu_items').insert({
      name: name.trim(), category, price: parseInt(price), active: true, sort_order: 999,
    })
    if (err) { setError(err.message); setSaving(false); return }
    invalidateMenuCache()
    onSaved()
    onClose()
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
            <select className="modal-input" value={category} onChange={e => setCat(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
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

function ItemRow({ item, onToggle, onPriceChange }) {
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState(String(item.price))
  const [saving, setSaving]     = useState(false)

  const commitPrice = async () => {
    const parsed = parseInt(draft)
    if (isNaN(parsed) || parsed < 0) { setDraft(String(item.price)); setEditing(false); return }
    if (parsed === item.price) { setEditing(false); return }
    setSaving(true)
    await onPriceChange(item.id, parsed)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className={`${styles.itemRow} ${!item.active ? styles.itemInactive : ''}`}>
      <div className={styles.itemName}>{item.name}</div>
      <div className={styles.itemPrice}>
        {editing ? (
          <div className={styles.priceEdit}>
            <span className={styles.priceDollar}>$</span>
            <input
              className={styles.priceInput}
              type="number"
              min="0"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={e => { if (e.key === 'Enter') commitPrice(); if (e.key === 'Escape') { setDraft(String(item.price)); setEditing(false) } }}
              autoFocus
            />
          </div>
        ) : (
          <button className={styles.priceBtn} onClick={() => { setDraft(String(item.price)); setEditing(true) }} title="Click to edit price">
            ${item.price}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{marginLeft:4,opacity:0.5}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
      </div>
      <div className={styles.itemToggle}>
        <button
          className={`${styles.toggle} ${item.active ? styles.toggleOn : ''}`}
          onClick={() => onToggle(item.id, !item.active)}
          title={item.active ? 'Deactivate' : 'Activate'}
        >
          <span className={styles.toggleThumb} />
        </button>
        <span className={styles.toggleLabel}>{item.active ? 'Active' : 'Off'}</span>
      </div>
    </div>
  )
}

export default function MenuManager() {
  const { isAdmin } = useAuth()
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [showAdd, setShowAdd]       = useState(false)
  const [seeding, setSeeding]       = useState(false)
  const [seedMsg, setSeedMsg]       = useState('')
  const [openCat, setOpenCat]       = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('menu_items').select('*').order('sort_order').order('name')
    setItems(data || [])
    setLoading(false)
    // Default all categories open
    const cats = [...new Set((data || []).map(i => i.category))]
    setOpenCat(Object.fromEntries(cats.map(c => [c, true])))
  }, [])

  useEffect(() => { load() }, [load])

  if (!isAdmin) return <div style={{padding:'40px 28px',color:'var(--text-muted)'}}>Access denied.</div>

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
    setSeeding(true)
    setSeedMsg('')
    const rows = MENU.map((m, i) => ({ name: m.name, category: m.category, price: m.price, active: true, sort_order: i }))
    const { error } = await supabase.from('menu_items').upsert(rows, { onConflict: 'name,category' })
    if (error) { setSeedMsg('Error: ' + error.message) }
    else { setSeedMsg(`Loaded ${rows.length} items from default menu.`); invalidateMenuCache(); load() }
    setSeeding(false)
  }

  const categories = CATEGORIES.filter(c => items.some(i => i.category === c))
  items.forEach(i => { if (!categories.includes(i.category)) categories.push(i.category) })

  const activeCount  = items.filter(i => i.active).length
  const inactiveCount = items.filter(i => !i.active).length

  return (
    <div className={styles.page}>
      <PageHeader title="Menu & Pricing">
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add item</button>
      </PageHeader>

      <div className={styles.statsRow}>
        <div className={styles.stat}><span className={styles.statNum}>{items.length}</span><span className={styles.statLabel}>Total items</span></div>
        <div className={styles.stat}><span className={styles.statNum} style={{color:'var(--brand)'}}>{activeCount}</span><span className={styles.statLabel}>Active</span></div>
        <div className={styles.stat}><span className={styles.statNum} style={{color:'var(--text-muted)'}}>{inactiveCount}</span><span className={styles.statLabel}>Inactive</span></div>
      </div>

      {items.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>No menu items yet</div>
          <div className={styles.emptyMsg}>Load your current menu from the app defaults, or add items one by one.</div>
          {seedMsg && <div className={styles.seedMsg}>{seedMsg}</div>}
          <button className={styles.seedBtn} onClick={handleSeedFromDefaults} disabled={seeding}>
            {seeding ? 'Loading…' : 'Load default menu'}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className={styles.hint}>Click a price to edit it. Toggle the switch to show or hide an item from orders.</div>
          {seedMsg && <div className={styles.seedMsgInline}>{seedMsg}</div>}
          <div className={styles.categoryList}>
            {categories.map(cat => {
              const catItems = items.filter(i => i.category === cat)
              const isOpen = openCat[cat] !== false
              return (
                <div key={cat} className={styles.categoryBlock}>
                  <button className={styles.catHeader} onClick={() => setOpenCat(p => ({ ...p, [cat]: !isOpen }))}>
                    <span className={styles.catName}>{cat}</span>
                    <span className={styles.catCount}>{catItems.length} items · {catItems.filter(i=>i.active).length} active</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s', flexShrink:0}}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div className={styles.catItems}>
                      <div className={styles.itemsHeader}>
                        <span>Item</span><span>Base price</span><span>Status</span>
                      </div>
                      {catItems.map(item => (
                        <ItemRow key={item.id} item={item} onToggle={handleToggle} onPriceChange={handlePriceChange} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onSaved={load} />}
    </div>
  )
}
