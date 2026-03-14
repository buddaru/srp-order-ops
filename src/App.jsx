import { useState, useCallback, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { seedOrders } from './data/orders'
import { STAGES, READY_SMS, PICKEDUP_SMS, fmtDate, diffDays, STRIP_DAYS } from './utils/helpers'
import Header     from './components/Header'
import CalStrip   from './components/CalStrip'
import Board      from './components/Board'
import Drawer     from './components/Drawer'
import OrderModal from './components/OrderModal'
import Toast      from './components/Toast'
import Production from './components/Production'
import Waste      from './components/Waste'
import Privacy  from './components/Privacy'
import Terms    from './components/Terms'
import Login    from './components/Login'
import Admin    from './components/Admin'
import { useAuth } from './context/AuthContext'
import styles from './App.module.css'

let orderSeq = 0

// ── DB helpers: map DB row ↔ app object ──
const fromDB = (row) => ({
  id:            row.id,
  customer:      row.customer,
  initials:      row.initials || '',
  phone:         row.phone || '',
  email:         row.email || '',
  items:         row.items || [],
  pickupDate:    row.pickup_date,
  pickupTime:    row.pickup_time,
  notes:         row.notes || '',
  notifications: row.notifications || [],
  stage:         row.stage,
  image:         row.image || null,
  createdAt:     row.created_at,
})

const toDB = (o) => ({
  id:            o.id,
  customer:      o.customer,
  initials:      o.initials,
  phone:         o.phone,
  email:         o.email,
  items:         o.items,
  pickup_date:   o.pickupDate,
  pickup_time:   o.pickupTime,
  notes:         o.notes,
  notifications: o.notifications,
  stage:         o.stage,
  image:         o.image,
})

// ── Confirm modal ──
function ConfirmModal({ title, message, confirmLabel, confirmStyle, onConfirm, onCancel }) {
  return (
    <div className={styles.confirmOverlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className={styles.confirmBox}>
        <div className={styles.confirmTitle}>{title}</div>
        <div className={styles.confirmMsg}>{message}</div>
        <div className={styles.confirmActions}>
          <button className={styles.confirmCancel} onClick={onCancel}>Cancel</button>
          <button className={styles.confirmOk} style={confirmStyle} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [orders, setOrders]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [selectedDay, setSelectedDay] = useState('all')
  const [customDate, setCustomDate]   = useState(false)
  const [drawerOrderId, setDrawerOrderId] = useState(null)
  const [editingId, setEditingId]     = useState(null)
  const [showNew, setShowNew]         = useState(false)
  const { user, profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Auto-open new order modal when navigated with ?neworder=1
  useEffect(() => {
    if (location.search.includes('neworder=1')) {
      setShowNew(true)
      navigate('/', { replace: true })
    }
  }, [location.search])
  const [toast, setToast]             = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [confirmPickup, setConfirmPickup] = useState(null)
  const [dateRange, setDateRange] = useState(null)

  const drawerOrder = orders.find(o => o.id === drawerOrderId) || null
  const editOrder   = orders.find(o => o.id === editingId)     || null
  const showToast   = useCallback(t => setToast(t), [])

  // ── Load orders from Supabase on mount ──
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Load error:', error)
        // Fall back to seed data if DB fails
        setOrders(seedOrders)
      } else if (data.length === 0) {
        // First run — seed the DB with sample orders
        const toInsert = seedOrders.map(toDB)
        const { error: insertErr } = await supabase.from('orders').insert(toInsert)
        if (!insertErr) setOrders(seedOrders)
        else setOrders(seedOrders)
      } else {
        const mapped = data.map(fromDB)
        setOrders(mapped)
        orderSeq = mapped.reduce((max, o) => {
          const n = parseInt(o.id.replace('SRP-', '')) || 0
          return Math.max(max, n)
        }, 0)
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── Stage movement ──
  const handleMove = (id, dir) => {
    const o = orders.find(x => x.id === id)
    if (!o) return
    const si = STAGES.findIndex(s => s.id === o.stage)
    const ni = si + dir
    if (ni < 0 || ni >= STAGES.length) return
    if (STAGES[ni].id === 'picked-up') { setConfirmPickup(id); return }
    applyMove(id, dir)
  }

  const applyMove = async (id, dir) => {
    const o = orders.find(x => x.id === id)
    if (!o) return
    const si = STAGES.findIndex(s => s.id === o.stage)
    const ni = si + dir
    if (ni < 0 || ni >= STAGES.length) return
    const newStage = STAGES[ni].id
    const notifs = [...o.notifications]
    const now = new Date().toISOString()
    if (dir === 1) {
      notifs.push({ text: `→ Moved to ${STAGES[ni].label}`, ts: now })
      if (newStage === 'picked-up') notifs.push({ text: '✅ Order picked up', ts: now })
    } else {
      notifs.push({ text: `↩ Moved back to ${STAGES[ni].label}`, ts: now })
    }
    const updated = { ...o, stage: newStage, notifications: notifs }
    setOrders(prev => prev.map(x => x.id === id ? updated : x))
    await supabase.from('orders').update({ stage: newStage, notifications: notifs }).eq('id', id)
  }

  // ── Manual SMS ──
  const handleSendSms = async (id) => {
    const o = orders.find(x => x.id === id)
    if (!o) return
    const msg = o.stage === 'ready' ? READY_SMS(o.customer) : PICKEDUP_SMS(o.customer)

    // Optimistically update UI
    const notifs = [...o.notifications, { text: `📱 SMS sent to ${o.phone || 'customer'}`, ts: new Date().toISOString() }]
    setOrders(prev => prev.map(x => x.id !== id ? x : { ...x, notifications: notifs }))
    await supabase.from('orders').update({ notifications: notifs }).eq('id', id)

    // Send real SMS via serverless function
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: o.phone, message: msg }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast({ label: '⚠️ SMS failed', customer: o.customer, msg: data.error || 'Could not send SMS.' })
      } else {
        showToast({ label: '📱 SMS sent!', customer: o.customer, msg: msg.substring(0, 80) })
      }
    } catch (err) {
      showToast({ label: '⚠️ SMS error', customer: o.customer, msg: 'Network error — SMS not sent.' })
    }
  }

  // ── Delete ──
  const handleDelete = (id) => setConfirmDelete(id)
  const doDelete = async () => {
    const id = confirmDelete
    const name = orders.find(o => o.id === id)?.customer || ''
    setOrders(prev => prev.filter(o => o.id !== id))
    if (drawerOrderId === id) setDrawerOrderId(null)
    setConfirmDelete(null)
    await supabase.from('orders').delete().eq('id', id)
    showToast({ label: '🗑 Order deleted', customer: name, msg: 'Order permanently removed.' })
  }

  // ── Edit ──
  const handleSaveEdit = async (data) => {
    const notifs = [...(editOrder?.notifications || []), { text: '✏ Order updated by staff', ts: new Date().toISOString() }]
    const updated = { ...editOrder, ...data, notifications: notifs }
    setOrders(prev => prev.map(o => o.id !== editingId ? o : updated))
    setEditingId(null)
    await supabase.from('orders').update(toDB(updated)).eq('id', editingId)
  }

  // ── Create ──
  const handleCreateOrder = async (data) => {
    orderSeq++
    const id = `SRP-${String(orderSeq).padStart(3, '0')}`
    const newOrder = { id, ...data, notifications: [{ text: '✓ Order created', ts: new Date().toISOString() }], stage: 'received', createdAt: new Date().toISOString() }
    setOrders(prev => [...prev, newOrder])
    setShowNew(false)
    showToast({ label: '✓ Order created', customer: data.customer, msg: `${id} added to the board.` })
    await supabase.from('orders').insert(toDB(newOrder))
  }

  // ── SMS log from drawer ──
  const handleSmsLog = async (id, entry) => {
    const o = orders.find(x => x.id === id)
    if (!o) return
    const notifs = [...o.notifications, { text: entry, ts: new Date().toISOString() }]
    setOrders(prev => prev.map(x => x.id !== id ? x : { ...x, notifications: notifs }))
    await supabase.from('orders').update({ notifications: notifs }).eq('id', id)
  }

  // ── Jump from search ──
  const handleJumpToOrder = (id) => {
    const o = orders.find(x => x.id === id)
    if (!o) return
    const d = diffDays(o.pickupDate)
    setSelectedDay(o.pickupDate)
    setCustomDate(!(d >= 0 && d <= STRIP_DAYS - 1))
    setDrawerOrderId(id)
    navigate('/')
  }

  const handleSelectDay = (ds, isCustom) => { setSelectedDay(ds); setCustomDate(isCustom); setDateRange(null) }

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingLogo}>🍑</div>
        <div className={styles.loadingText}>Loading…</div>
      </div>
    )
  }

  return (
    <div className={styles.app}>
      <Header orders={orders} onNewOrder={() => setShowNew(true)} onJumpToOrder={handleJumpToOrder} profile={profile} onSignOut={signOut} />
      <nav className={styles.mainNav}>
        <NavLink to="/" end className={({isActive}) => isActive ? styles.navActive : styles.navItem}>Order Board</NavLink>
        <NavLink to="/production" className={({isActive}) => isActive ? styles.navActive : styles.navItem}>Daily Production</NavLink>
        <NavLink to="/waste" className={({isActive}) => isActive ? styles.navActive : styles.navItem}>Food Waste</NavLink>
        {isAdmin && <NavLink to="/admin" className={({isActive}) => isActive ? styles.navActive : styles.navItem}>Team</NavLink>}
      </nav>
      <Routes>
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/production" element={<Production />} />
        <Route path="/waste" element={<Waste />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/" element={<>
      <CalStrip orders={orders} selectedDay={selectedDay} customDateSelected={customDate} dateRange={dateRange} onSelectDay={handleSelectDay} onRangeSelect={setDateRange} />
      <div className={styles.boardWrapper}>
        <Board
          orders={orders}
          selectedDay={selectedDay}
          customDateSelected={customDate}
          dateRange={dateRange}
          isAdmin={isAdmin}
          onMove={handleMove}
          onEdit={id => setEditingId(id)}
          onDrawer={id => setDrawerOrderId(id)}
          onDelete={handleDelete}
          onSendSms={handleSendSms}
        />
      </div>

      {drawerOrderId && (
        <>
          <div className={styles.drawerBackdrop} onClick={() => setDrawerOrderId(null)} />
          <Drawer order={drawerOrder} onClose={() => setDrawerOrderId(null)} onSmsLog={handleSmsLog} showToast={showToast} />
        </>
      )}

      {editingId  && <OrderModal mode="edit" order={editOrder} onSave={handleSaveEdit} onClose={() => setEditingId(null)} />}

      {confirmDelete && (
        <ConfirmModal
          title="Delete order?"
          message={`This will permanently delete ${orders.find(o=>o.id===confirmDelete)?.customer}'s order. This action cannot be undone.`}
          confirmLabel="Yes, delete"
          confirmStyle={{ background: '#DC2626', borderColor: '#DC2626' }}
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {confirmPickup && (
        <ConfirmModal
          title="Mark as Picked Up?"
          message={`Confirm that ${orders.find(o=>o.id===confirmPickup)?.customer}'s order has been picked up.`}
          confirmLabel="Yes, picked up"
          confirmStyle={{ background: 'var(--brand)', borderColor: 'var(--brand)' }}
          onConfirm={() => { applyMove(confirmPickup, 1); setConfirmPickup(null) }}
          onCancel={() => setConfirmPickup(null)}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
        </>} />
      </Routes>
      {showNew && <OrderModal mode="new" onSave={handleCreateOrder} onClose={() => setShowNew(false)} />}
    </div>
  )
}
