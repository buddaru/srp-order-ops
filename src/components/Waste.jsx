import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, safeQuery } from '../lib/supabase'
import styles from './Waste.module.css'

const REASONS = ['Overproduction', 'Order cancelled', 'Quality issue', 'Expired / spoiled', 'Wrong order', 'Other']

const REASON_COLORS = {
  'Overproduction':    { bg: '#FEE2E2', text: '#991B1B', pill: '#FEE2E2', pillText: '#991B1B' },
  'Order cancelled':   { bg: '#FEF3C7', text: '#92400E', pill: '#FEF3C7', pillText: '#92400E' },
  'Quality issue':     { bg: '#EDE9FE', text: '#5B21B6', pill: '#EDE9FE', pillText: '#5B21B6' },
  'Expired / spoiled': { bg: '#DCFCE7', text: '#166534', pill: '#DCFCE7', pillText: '#166534' },
  'Wrong order':       { bg: '#E0F2FE', text: '#075985', pill: '#E0F2FE', pillText: '#075985' },
  'Other':             { bg: '#F1F5F9', text: '#475569', pill: '#F1F5F9', pillText: '#475569' },
}
const PERIODS = ['D', 'W', 'M', '6M', 'Y']

// ── Date helpers ──
const toDS = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d }

function getPeriodLabel(period, anchor) {
  const d = new Date(anchor + 'T00:00:00')
  if (period === 'D') return d.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric', year:'numeric' })
  if (period === 'W') {
    const start = new Date(d); start.setDate(d.getDate() - d.getDay())
    const end   = new Date(start); end.setDate(start.getDate() + 6)
    return `${start.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${end.toLocaleDateString('en-US',{month:'short',day:'numeric', year:'numeric'})}`
  }
  if (period === 'M') return d.toLocaleDateString('en-US', { month:'long', year:'numeric' })
  if (period === '6M') {
    const half = d.getMonth() < 6 ? 0 : 6
    const start = new Date(d.getFullYear(), half, 1)
    const end   = new Date(d.getFullYear(), half + 5, 1)
    return `${start.toLocaleDateString('en-US',{month:'short',year:'numeric'})} – ${end.toLocaleDateString('en-US',{month:'short',year:'numeric'})}`
  }
  return String(d.getFullYear())
}

function stepAnchor(period, anchor, dir) {
  const d = new Date(anchor + 'T00:00:00')
  if (period === 'D')  { d.setDate(d.getDate() + dir) }
  if (period === 'W')  { d.setDate(d.getDate() + dir * 7) }
  if (period === 'M')  { d.setMonth(d.getMonth() + dir) }
  if (period === '6M') { d.setMonth(d.getMonth() + dir * 6) }
  if (period === 'Y')  { d.setFullYear(d.getFullYear() + dir) }
  return toDS(d)
}

function isFuture(ds) {
  const d = new Date(ds + 'T00:00:00')
  const t = today()
  return d > t
}

function inPeriod(dateStr, period, anchor) {
  const d     = new Date(dateStr + 'T00:00:00')
  const anch  = new Date(anchor + 'T00:00:00')
  if (period === 'D') return dateStr === anchor
  if (period === 'W') {
    const start = new Date(anch); start.setDate(anch.getDate() - anch.getDay())
    const end   = new Date(start); end.setDate(start.getDate() + 6)
    return d >= start && d <= end
  }
  if (period === 'M') return d.getFullYear() === anch.getFullYear() && d.getMonth() === anch.getMonth()
  if (period === '6M') {
    const half = anch.getMonth() < 6 ? 0 : 6
    return d.getFullYear() === anch.getFullYear() && d.getMonth() >= half && d.getMonth() < half + 6
  }
  if (period === 'Y') return d.getFullYear() === anch.getFullYear()
  return false
}

function fmt$(n) { return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',') }
function fmtDate(ds) { return new Date(ds + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) }
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})
}

// ── Log Modal ──
function WasteModal({ entry, onSave, onClose }) {
  const isEdit = !!entry?.id
  const [name, setName]       = useState(entry?.item_name || '')
  const [qty, setQty]         = useState(entry?.qty ?? '')
  const [unit, setUnit]       = useState(entry?.unit || '')
  const [cpu, setCpu]         = useState(entry?.cost_per_unit ?? '')
  const [type, setType]       = useState(entry?.type || 'prepared')
  const [reason, setReason]   = useState(entry?.reason || '')
  const [notes, setNotes]     = useState(entry?.notes || '')
  const [saving, setSaving]   = useState(false)
  const [errors, setErrors]   = useState({})

  const total = qty && cpu ? (parseFloat(qty) * parseFloat(cpu)) : 0

  const validate = () => {
    const e = {}
    if (!name.trim()) e.name = true
    if (!qty || isNaN(parseFloat(qty)) || parseFloat(qty) <= 0) e.qty = true
    if (!cpu || isNaN(parseFloat(cpu)) || parseFloat(cpu) < 0) e.cpu = true
    if (!reason) e.reason = true
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const row = {
      item_name:     name.trim(),
      qty:           parseFloat(qty),
      unit:          unit.trim(),
      cost_per_unit: parseFloat(cpu),
      total_cost:    parseFloat((parseFloat(qty)*parseFloat(cpu)).toFixed(2)),
      type,
      reason,
      notes:         notes.trim(),
      logged_date:   toDS(today()),
    }
    if (isEdit) {
      await supabase.from('waste_log').update(row).eq('id', entry.id)
    } else {
      await supabase.from('waste_log').insert([row])
    }
    setSaving(false)
    onSave()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>{isEdit ? 'Edit waste entry' : 'Log waste entry'}</div>
            <div className={styles.modalSub}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric'})}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Item name</label>
            <input
              className={`${styles.finput} ${errors.name ? styles.invalid : ''}`}
              value={name} onChange={e => { setName(e.target.value); setErrors(v=>({...v,name:false})) }}
              placeholder="e.g. Red Velvet Cupcakes"
            />
          </div>

          <div className={styles.formRow}>
            <label className={styles.flabel}>Quantity & cost</label>
            <div className={styles.qtyGrid}>
              <div className={styles.qtyField}>
                <label className={styles.qtyLabel}>Qty</label>
                <input
                  className={`${styles.finput} ${errors.qty ? styles.invalid : ''}`}
                  type="number" min="0" value={qty}
                  onChange={e => { setQty(e.target.value); setErrors(v=>({...v,qty:false})) }}
                  placeholder="12"
                />
              </div>
              <div className={styles.qtyField}>
                <label className={styles.qtyLabel}>Unit</label>
                <input className={styles.finput} value={unit} onChange={e => setUnit(e.target.value)} placeholder="cupcakes" />
              </div>
              <div className={styles.qtyField}>
                <label className={styles.qtyLabel}>Cost per unit ($)</label>
                <input
                  className={`${styles.finput} ${errors.cpu ? styles.invalid : ''}`}
                  type="number" min="0" step="0.01" value={cpu}
                  onChange={e => { setCpu(e.target.value); setErrors(v=>({...v,cpu:false})) }}
                  placeholder="1.50"
                />
              </div>
            </div>
            <div className={styles.totalBanner}>
              <div>
                <div className={styles.tbLabel}>Total waste cost</div>
                {qty && cpu && <div className={styles.tbEq}>{qty} × {fmt$(cpu)}</div>}
              </div>
              <div className={styles.tbRight}>
                <div className={styles.tbTotal}>{fmt$(total)}</div>
                <div className={styles.tbSub}>calculated</div>
              </div>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.formRow}>
            <label className={styles.flabel}>Type</label>
            <div className={styles.typeToggle}>
              <button
                className={`${styles.typeOpt} ${type === 'prepared' ? styles.typeP : ''}`}
                onClick={() => setType('prepared')}
              >Prepared product</button>
              <button
                className={`${styles.typeOpt} ${type === 'unprepared' ? styles.typeU : ''}`}
                onClick={() => setType('unprepared')}
              >Unprepared ingredient</button>
            </div>
          </div>

          <div className={styles.formRow}>
            <label className={`${styles.flabel} ${errors.reason ? styles.labelErr : ''}`}>Reason</label>
            <div className={styles.reasonGrid}>
              {REASONS.map(r => (
                <button
                  key={r}
                  className={`${styles.chip} ${reason === r ? styles.chipSel : ''}`}
                  onClick={() => { setReason(r); setErrors(v=>({...v,reason:false})) }}
                >{r}</button>
              ))}
            </div>
          </div>

          <div className={styles.formRow} style={{marginBottom:0}}>
            <label className={styles.flabel}>Notes (optional)</label>
            <textarea className={styles.finput} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional context…" style={{height:56,resize:'none'}} />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Confirm delete modal ──
function ConfirmDelete({ onConfirm, onCancel }) {
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className={styles.confirmBox}>
        <div className={styles.confirmTitle}>Delete entry?</div>
        <div className={styles.confirmMsg}>This waste entry will be permanently removed and cannot be undone.</div>
        <div className={styles.confirmActions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.deleteBtn} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──
export default function Waste() {
  const { isAdmin } = useAuth()
  const [entries, setEntries]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [period, setPeriod]       = useState('M')
  const [anchor, setAnchor]       = useState(toDS(today()))
  const [sort, setSort]           = useState('newest')
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [deleteId, setDeleteId]   = useState(null)
  const [showCal, setShowCal]       = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await safeQuery(() => supabase.from('waste_log').select('*').order('created_at', { ascending: false }))
      setEntries(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const filtered = useMemo(() => {
    return entries.filter(e => inPeriod(e.logged_date, period, anchor))
  }, [entries, period, anchor])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (sort === 'desc')   return b.total_cost - a.total_cost
      if (sort === 'asc')    return a.total_cost - b.total_cost
      return 0
    })
  }, [filtered, sort])

  const totalCost = filtered.reduce((s, e) => s + (e.total_cost || 0), 0)

  const topReason = (() => {
    const counts = {}
    filtered.forEach(e => { if (e.reason) counts[e.reason] = (counts[e.reason] || 0) + 1 })
    const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]
    return top ? { reason: top[0], count: top[1] } : null
  })()

  const handlePeriodChange = (p) => {
    setPeriod(p)
    setAnchor(toDS(today()))
  }

  const handleDelete = async () => {
    await supabase.from('waste_log').delete().eq('id', deleteId)
    setDeleteId(null)
    load()
  }

  const handleSave = () => {
    setShowModal(false)
    setEditEntry(null)
    load()
  }

  const openEdit = (e) => { setEditEntry(e); setShowModal(true) }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.topbar}>
        <div className={styles.pageTitle}>Food Waste Tracker</div>
        <button className={styles.logBtn} onClick={() => { setEditEntry(null); setShowModal(true) }}>+ Log Waste</button>
      </div>

      {/* Period tabs */}
      <div className={styles.periodRow}>
        {PERIODS.map(p => (
          <button key={p} className={`${styles.pb} ${period === p ? styles.pbActive : ''}`} onClick={() => handlePeriodChange(p)}>{p}</button>
        ))}
      </div>

      {/* Navigator */}
      <div className={styles.navRow}>
        <div className={styles.periodNav}>
          <button className={styles.pnArrow} onClick={() => setAnchor(stepAnchor(period, anchor, -1))}>‹</button>
          <div className={styles.pnLabel}>{getPeriodLabel(period, anchor)}</div>
          <button
            className={`${styles.pnArrow} ${isFuture(stepAnchor(period, anchor, 1)) ? styles.pnArrowDisabled : ''}`}
            onClick={() => { const next = stepAnchor(period, anchor, 1); if (!isFuture(next)) setAnchor(next) }}
            disabled={isFuture(stepAnchor(period, anchor, 1))}
          >›</button>
        </div>
        <div className={styles.calWrap}>
          <button className={styles.calIconBtn} onClick={() => { const el = document.getElementById('waste-date-pick'); el && el.showPicker && el.showPicker(); el && el.focus(); }} title="Pick a date">📅</button>
          <input
            id="waste-date-pick"
            type="date"
            className={styles.calInput}
            value={anchor}
            max={toDS(today())}
            onChange={e => { if (e.target.value) setAnchor(e.target.value) }}
          />
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summaryBlock}>
        <div className={styles.summaryCard}>
          <div>
            <div>
              <span className={styles.summaryTotal}>{fmt$(totalCost)}</span>
              <span className={styles.summaryUnit}>total waste</span>
            </div>
            <div className={styles.summarySub}>
              <b>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</b> logged · {getPeriodLabel(period, anchor)}
            </div>
          </div>
          {topReason && (
            <>
              <div className={styles.summaryDivider} />
              <div className={styles.reasonSection}>
                <div className={styles.reasonCardLabel}>Top reason</div>
                <div className={styles.reasonCardPill} style={{background: REASON_COLORS[topReason.reason]?.bg, color: REASON_COLORS[topReason.reason]?.text}}>
                  {topReason.reason}
                </div>
                <div className={styles.reasonCardCount}>{topReason.count} {topReason.count === 1 ? 'time' : 'times'}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sort row */}
      <div className={styles.sortRow}>
        <div className={styles.sortLabel}>{sorted.length} {sorted.length === 1 ? 'entry' : 'entries'}</div>
        <div className={styles.sortBtns}>
          <button className={`${styles.sortBtn} ${sort==='newest'?styles.sortActive:''}`} onClick={()=>setSort('newest')}>Newest</button>
          <button className={`${styles.sortBtn} ${sort==='oldest'?styles.sortActive:''}`} onClick={()=>setSort('oldest')}>Oldest</button>
          <button className={`${styles.sortBtn} ${sort==='desc'?styles.sortActive:''}`} onClick={()=>setSort('desc')}>Cost ↓</button>
          <button className={`${styles.sortBtn} ${sort==='asc' ?styles.sortActive:''}`} onClick={()=>setSort('asc')}>Cost ↑</button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : sorted.length === 0 ? (
        <div className={styles.empty}>No waste entries for this period.</div>
      ) : (
        <div className={styles.listWrap}>
          <div className={styles.listHeader}>
            <div>Item</div>
            <div>Type</div>
            <div>Reason</div>
            <div>Cost</div>
            <div></div>
          </div>
          {sorted.map(e => (
            <div key={e.id} className={styles.entry}>
              <div className={styles.nameCol}>
                <div className={`${styles.typeDot} ${e.type === 'prepared' ? styles.dotP : styles.dotU}`} />
                <div>
                  <div className={styles.ename}>{e.item_name}</div>
                  <div className={styles.emeta}>{e.qty}{e.unit ? ` ${e.unit}` : ''}</div>
                  <div className={styles.entryTimestamp}>{fmtDate(e.logged_date)}{e.created_at ? ` · ${fmtTime(e.created_at)}` : ''}</div>
                </div>
              </div>
              <div className={styles.ecell}>{e.type === 'prepared' ? 'Prepared' : 'Unprepared'}</div>
              <div><span className={styles.reasonPill} style={{background: REASON_COLORS[e.reason]?.bg || '#F1F5F9', color: REASON_COLORS[e.reason]?.text || '#475569'}}>{e.reason}</span></div>
              <div className={styles.ecost}>{fmt$(e.total_cost)}</div>
              {isAdmin && (
              <div className={styles.eActions}>
                <button className={styles.ea} onClick={() => openEdit(e)}>Edit</button>
                <button className={`${styles.ea} ${styles.eaDel}`} onClick={() => setDeleteId(e.id)}>Delete</button>
              </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && <WasteModal entry={editEntry} onSave={handleSave} onClose={() => { setShowModal(false); setEditEntry(null) }} />}
      {deleteId  && <ConfirmDelete onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  )
}
