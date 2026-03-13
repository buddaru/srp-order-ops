import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
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
  const [date, setDate]       = useState(todayDS())
  const [items, setItems]     = useState([])
  const [note, setNote]       = useState('')
  const [noteId, setNoteId]   = useState(null)
  const [noteSaved, setNoteSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Add item form
  const [newName, setNewName]     = useState('')
  const [newQty, setNewQty]       = useState('')
  const [newCat, setNewCat]       = useState('')
  const [newNotes, setNewNotes]   = useState('')
  const [showForm, setShowForm]   = useState(false)
  const noteTimer = useRef(null)

  // Load items + note for selected date
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data: prodData }, { data: noteData }] = await Promise.all([
        supabase.from('production').select('*').eq('date', date).order('created_at'),
        supabase.from('production_notes').select('*').eq('date', date).maybeSingle(),
      ])
      setItems(prodData || [])
      setNote(noteData?.content || '')
      setNoteId(noteData?.id || null)
      setLoading(false)
    }
    load()
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
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>Daily Production List</div>
        <div className={styles.headerRight}>
          <button className={styles.printBtn} onClick={handlePrint}>🖨 Print</button>
          <button className={styles.templateBtn} onClick={handleLoadTemplate}>📋 Load Template</button>
          <button className={styles.templateSaveBtn} onClick={handleSaveTemplate}>💾 Save as Template</button>
          <div className={styles.dateNav}>
            <button className={styles.navBtn} onClick={() => setDate(shiftDate(date, -1))}>←</button>
            <span className={styles.dateLabel}>{fmtDisplayDate(date)}</span>
            <button className={styles.navBtn} onClick={() => setDate(shiftDate(date, 1))}>→</button>
          </div>
          {date !== todayDS() && (
            <button className={styles.todayBtn} onClick={() => setDate(todayDS())}>Today</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}><div className={styles.statNum}>{total}</div><div className={styles.statLabel}>Total items</div></div>
        <div className={styles.stat}><div className={styles.statNum} style={{color:'#15803D'}}>{completed}</div><div className={styles.statLabel}>Completed</div></div>
        <div className={styles.stat}><div className={styles.statNum} style={{color:'#B45309'}}>{remaining}</div><div className={styles.statLabel}>Remaining</div></div>
      </div>

      {total > 0 && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{width: `${pct}%`}} />
        </div>
      )}

      {/* Daily Note */}
      <div className={styles.noteSection}>
        <div className={styles.noteLabelRow}>
          <div className={styles.sectionLabel}>📋 Shift Notes</div>
          {noteSaved && <span className={styles.savedBadge}>Saved</span>}
        </div>
        <textarea
          className={styles.noteArea}
          value={note}
          onChange={e => handleNoteChange(e.target.value)}
          placeholder="Add notes for the team today — oven issues, low stock, special reminders…"
        />
      </div>

      {/* Production Items */}
      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : total === 0 && !showForm ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🧁</div>
          <div>No items yet for this day.</div>
          <button className={styles.addFirstBtn} onClick={() => setShowForm(true)}>+ Add first item</button>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} className={styles.group}>
            <div className={styles.sectionLabel}>{cat}</div>
            {catItems.map(item => (
              <div key={item.id} className={`${styles.itemCard} ${item.completed ? styles.done : ''}`}>
                <button className={`${styles.check} ${item.completed ? styles.checked : ''}`} onClick={() => handleToggle(item.id, item.completed)} />
                <div className={styles.itemBody}>
                  <div className={styles.itemName}>{item.item_name}</div>
                  {item.notes && <div className={styles.itemNote}>{item.notes}</div>}
                </div>
                <div className={styles.itemQty}>{item.quantity}</div>
                <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)}>×</button>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Add item form */}
      {showForm ? (
        <div className={styles.addForm}>
          <div className={styles.formRow}>
            <input placeholder="Item name *" value={newName} onChange={e=>setNewName(e.target.value)} className={styles.input} />
            <input placeholder="Qty *" value={newQty} onChange={e=>setNewQty(e.target.value)} className={styles.inputSm} />
          </div>
          <div className={styles.formRow}>
            <input placeholder="Category (e.g. Cupcakes)" value={newCat} onChange={e=>setNewCat(e.target.value)} className={styles.input} />
            <input placeholder="Notes (optional)" value={newNotes} onChange={e=>setNewNotes(e.target.value)} className={styles.input} />
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
            <button className={styles.saveBtn} onClick={handleAdd}>Add item</button>
          </div>
        </div>
      ) : (
        <button className={styles.addBtn} onClick={() => setShowForm(true)}>+ Add item</button>
      )}
    </div>
  )
}
