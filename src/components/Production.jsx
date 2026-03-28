import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, safeQuery } from '../lib/supabase'
import { toDS } from '../utils/helpers'
import styles from './Production.module.css'

const todayDS = () => toDS(new Date())

const fmtDisplayDate = (ds) => {
  const d = new Date(ds + 'T00:00:00')
  const today = todayDS()
  const tomorrow = toDS(new Date(new Date().setDate(new Date().getDate() + 1)))
  const yesterday = toDS(new Date(new Date().setDate(new Date().getDate() - 1)))
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  const month   = d.toLocaleDateString('en-US', { month: 'short' })
  const day     = d.getDate()
  if (ds === today)     return `Today — ${weekday}, ${month} ${day}`
  if (ds === tomorrow)  return `Tomorrow — ${weekday}, ${month} ${day}`
  if (ds === yesterday) return `Yesterday — ${weekday}, ${month} ${day}`
  return `${weekday}, ${month} ${day}`
}

const shiftDate = (ds, n) => {
  const d = new Date(ds + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toDS(d)
}

export default function Production() {
  const { isAdmin } = useAuth()
  const loadRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [date, setDate]       = useState(todayDS())
  const [items, setItems]         = useState([])
  const [note, setNote]           = useState('')
  const [noteId, setNoteId]   = useState(null)
  const [noteSaved, setNoteSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Add item form
  const [newName, setNewName]     = useState('')
  const [newQty, setNewQty]       = useState('')
  const [newCat, setNewCat]       = useState('')
  const [newNotes, setNewNotes]   = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [editingItem, setEditingItem] = useState(null) // {id, item_name, quantity, category, notes}
  const noteTimer = useRef(null)

  // Load items + note for selected date
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setLoadError(false)
      try {
        const [r1, r2] = await Promise.all([
          safeQuery(() => supabase.from('production').select('*').eq('date', date).order('created_at')),
          safeQuery(() => supabase.from('production_notes').select('*').eq('date', date).maybeSingle()),
        ])
        if (r1.error?.message === 'timeout' || r2.error?.message === 'timeout') {
          setLoadError(true)
        } else {
          setItems(r1.data || [])
          setNote(r2.data?.content || '')
          setNoteId(r2.data?.id || null)
        }
      } finally {
        setLoading(false)
      }
    }
    // expose load so retry button can call it
    loadRef.current = load
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [date])

  // Auto-save note with debounce
  const handleNoteChange = (val) => {
    setNote(val)
    setNoteSaved(false)
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(async () => {
      if (noteId) {
        await supabase.from('production_notes').update({ content: val, updated_at: new Date().toISOString() }).eq('id', noteId)
      } else {
        const { data } = await supabase.from('production_notes').insert({ date, content: val }).select().single()
        if (data) setNoteId(data.id)
      }
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 2000)
    }, 800)
  }

  // Add item
  const handleAdd = async () => {
    if (!newName.trim() || !newQty.trim()) return
    const item = { date, item_name: newName.trim(), quantity: newQty.trim(), category: newCat.trim() || 'General', notes: newNotes.trim(), completed: false }
    const { data } = await supabase.from('production').insert(item).select().single()
    if (data) setItems(prev => [...prev, data])
    setNewName(''); setNewQty(''); setNewCat(''); setNewNotes(''); setShowForm(false)
  }

  // Toggle complete
  const handleToggle = async (id, completed) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, completed: !completed } : i))
    await supabase.from('production').update({ completed: !completed }).eq('id', id)
  }

  // Delete item
  const handleDelete = async (id) => {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('production').delete().eq('id', id)
  }

  // ── Edit item ──
  const handleEditItem = (item) => {
    setEditingItem({ id: item.id, item_name: item.item_name, quantity: item.quantity, category: item.category, notes: item.notes || '' })
  }

  const handleSaveEdit = async () => {
    if (!editingItem || !editingItem.item_name.trim() || !editingItem.quantity.trim()) return
    const { id, item_name, quantity, category, notes } = editingItem
    setItems(prev => prev.map(i => i.id === id ? { ...i, item_name, quantity, category, notes } : i))
    setEditingItem(null)
    await supabase.from('production').update({ item_name, quantity, category, notes }).eq('id', id)
  }

  // ── Template ──
  const handleSaveTemplate = async () => {
    if (items.length === 0) return
    // Clear existing template
    await supabase.from('production_template').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    // Save current items as template
    const templateItems = items.map((item, i) => ({
      item_name: item.item_name,
      quantity: item.quantity,
      category: item.category,
      notes: item.notes,
      sort_order: i,
    }))
    await supabase.from('production_template').insert(templateItems)
    alert('Template saved! Load it any day with "Load Template".')
  }

  const handleLoadTemplate = async () => {
    if (items.length > 0) {
      const ok = window.confirm('This will add template items to today\'s list. Continue?')
      if (!ok) return
    }
    const { data } = await supabase.from('production_template').select('*').order('sort_order')
    if (!data || data.length === 0) {
      alert('No template saved yet. Build your list and click "Save as Template" first.')
      return
    }
    const toInsert = data.map(t => ({
      date,
      item_name: t.item_name,
      quantity: t.quantity,
      category: t.category,
      notes: t.notes,
      completed: false,
    }))
    const { data: inserted } = await supabase.from('production').insert(toInsert).select()
    if (inserted) setItems(prev => [...prev, ...inserted])
  }

  // Print
  const handlePrint = () => window.print()

  // Group by category
  const grouped = items.reduce((acc, item) => {
    const cat = item.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const total     = items.length
  const completed = items.filter(i => i.completed).length
  const remaining = total - completed
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className={styles.page}>
      {/* Print header */}
      <div className={styles.printHeader}>
        <div className={styles.printTitle}>Sweet Red Peach — Daily Production</div>
        <div className={styles.printDate}>{fmtDisplayDate(date)}</div>
      </div>

      {/* Title bar */}
      <div className={`${styles.titlebar} ${styles.noPrint}`}>
        <span className={styles.titleLabel}>Daily Production</span>
        <div className={styles.menuWrap}>
          <button className={styles.menuBtn} onClick={() => setMenuOpen(v => !v)}>≡ Menu</button>
          {menuOpen && (
            <>
              <div className={styles.menuBackdrop} onClick={() => setMenuOpen(false)} />
              <div className={styles.menuDropdown}>
                <button className={styles.menuItem} onClick={() => { handlePrint(); setMenuOpen(false) }}>🖨 Print</button>
                <button className={styles.menuItem} onClick={() => { handleLoadTemplate(); setMenuOpen(false) }}>📋 Load Template</button>
                <button className={styles.menuItem} onClick={() => { handleSaveTemplate(); setMenuOpen(false) }}>💾 Save as Template</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Date hero */}
      <div className={`${styles.hero} ${styles.noPrint}`}>
        <div className={styles.heroDate}>
          <button className={styles.navBtn} onClick={() => setDate(shiftDate(date, -1))}>←</button>
          <span>{fmtDisplayDate(date)}</span>
          <button className={styles.navBtn} onClick={() => setDate(shiftDate(date, 1))}>→</button>
        </div>
        {date !== todayDS() && (
          <button className={styles.todayBtn} onClick={() => setDate(todayDS())}>Jump to today</button>
        )}
      </div>

      <div className={`${styles.divider} ${styles.noPrint}`} />

      {/* Stats */}
      <div className={`${styles.stats} ${styles.noPrint}`}>
        <div className={styles.stat}><strong>{total}</strong> total</div>
        <div className={styles.stat} style={{color:'#639922'}}><strong>{completed}</strong> done</div>
        <div className={styles.stat} style={{color:'#B45309'}}><strong>{remaining}</strong> left</div>
      </div>

      {total > 0 && (
        <div className={`${styles.progressBar} ${styles.noPrint}`}>
          <div className={styles.progressFill} style={{width: `${pct}%`}} />
        </div>
      )}

      {/* Shift notes */}
      <div className={`${styles.notesRow} ${styles.noPrint}`}>
        <span className={styles.notesLabel}>Shift notes</span>
        <textarea
          className={styles.notesInput}
          value={note}
          onChange={e => handleNoteChange(e.target.value)}
          placeholder="Add notes for the team today..."
          rows={3}
        />
        {noteSaved && <span className={styles.savedBadge}>Saved</span>}
      </div>

      {/* Items */}
      {loading ? (
        <div className={styles.empty}>Loading...</div>
      ) : loadError ? (
        <div className={styles.empty}>
          <div style={{marginBottom:12}}>Couldn't load — connection timed out.</div>
          <button onClick={() => loadRef.current && loadRef.current()} style={{background:'var(--brand)',color:'#fff',border:'none',borderRadius:8,padding:'8px 20px',cursor:'pointer',fontFamily:'DM Sans, sans-serif',fontSize:13}}>Retry</button>
        </div>
      ) : total === 0 && !showForm ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🧁</div>
          <div>No items yet for this day.</div>
          <button className={styles.addFirstBtn} onClick={() => setShowForm(true)}>+ Add first item</button>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, catItems]) => {
          const catDone = catItems.filter(i => i.completed).length
          return (
            <div key={cat}>
              <div className={styles.catLabel}>
                <span className={styles.catName}>{cat}</span>
                <div className={styles.catLine}></div>
                <span className={styles.catCount}>{catItems.length} item{catItems.length !== 1 ? 's' : ''}{catDone > 0 ? `, ${catDone} done` : ''}</span>
              </div>
              {catItems.map(item => (
                <div key={item.id}>
                  {editingItem?.id === item.id ? (
                    <div className={`${styles.editForm} ${styles.noPrint}`}>
                      <div className={styles.formRow}>
                        <input className={styles.input} value={editingItem.item_name} onChange={e => setEditingItem(p => ({...p, item_name: e.target.value}))} placeholder="Item name" />
                        <input className={styles.inputSm} value={editingItem.quantity} onChange={e => setEditingItem(p => ({...p, quantity: e.target.value}))} placeholder="Qty" />
                      </div>
                      <div className={styles.formRow}>
                        <input className={styles.input} value={editingItem.category} onChange={e => setEditingItem(p => ({...p, category: e.target.value}))} placeholder="Category" />
                        <input className={styles.input} value={editingItem.notes} onChange={e => setEditingItem(p => ({...p, notes: e.target.value}))} placeholder="Notes" />
                      </div>
                      <div className={styles.formActions}>
                        <button className={styles.cancelBtn} onClick={() => setEditingItem(null)}>Cancel</button>
                        <button className={styles.saveBtn} onClick={handleSaveEdit}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className={`${styles.itemRow} ${item.completed ? styles.done : ''}`}>
                      <div className={styles.itemQtyBig}>{item.quantity}</div>
                      <div className={styles.itemBody}>
                        <div className={styles.itemName}>{item.item_name}</div>
                        {item.notes && <div className={styles.itemNote}>{item.notes}</div>}
                      </div>
                      <div className={`${styles.itemActions} ${styles.noPrint}`}>
                        <button className={styles.editItemBtn} onClick={() => handleEditItem(item)} title="Edit">✏</button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)}>×</button>
                      </div>
                      <button
                        className={`${styles.check} ${item.completed ? styles.checked : ''}`}
                        onClick={() => handleToggle(item.id, item.completed)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })
      )}

      {/* Add form */}
      <div className={styles.noPrint}>
        {showForm ? (
          <div className={styles.addForm}>
            <div className={styles.formRow}>
              <input placeholder="Item name *" value={newName} onChange={e => setNewName(e.target.value)} className={styles.input} />
              <input placeholder="Qty *" value={newQty} onChange={e => setNewQty(e.target.value)} className={styles.inputSm} />
            </div>
            <div className={styles.formRow}>
              <input placeholder="Category (e.g. Cupcakes)" value={newCat} onChange={e => setNewCat(e.target.value)} className={styles.input} />
              <input placeholder="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} className={styles.input} />
            </div>
            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleAdd}>Add item</button>
            </div>
          </div>
        ) : total > 0 ? (
          <button className={styles.addBtn} onClick={() => setShowForm(true)}>+ Add item</button>
        ) : null}
      </div>
    </div>
  )
}
