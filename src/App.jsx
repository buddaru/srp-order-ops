import { useState, useCallback, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase, withTimeout } from './lib/supabase'
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
import Schedule   from './components/Schedule'
import Privacy  from './components/Privacy'
import Terms    from './components/Terms'
import Login    from './components/Login'
import { useAuth } from './context/AuthContext'
import styles from './App.module.css'

// ── Sidebar icons ──
const IconBoard    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="11"/><rect x="14" y="18" width="7" height="3"/></svg>
const IconProd     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
const IconWaste    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const IconSchedule = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IconChevron  = ({ open }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.25s' }}><polyline points="15 18 9 12 15 6"/></svg>

const NAV_ITEMS = [
  { to: '/',           label: 'Order Board',      Icon: IconBoard,    end: true },
  { to: '/production', label: 'Daily Production', Icon: IconProd },
  { to: '/waste',      label: 'Food Waste',       Icon: IconWaste },
  { to: '/schedule',   label: 'Schedule',         Icon: IconSchedule },
]

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
  const [selectedDay, setSelectedDay] = useState('all')
  const [customDate, setCustomDate]   = useState(false)
  const [drawerOrderId, setDrawerOrderId] = useState(null)
  const [editingId, setEditingId]     = useState(null)
  const [showNew, setShowNew]         = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
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
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Load orders error:', error)
          return
        }
        if (data && data.length > 0) {
          const mapped = data.map(fromDB)
          setOrders(mapped)
          orderSeq = mapped.reduce((max, o) => {
            const n = parseInt(o.id.replace('SRP-', '')) || 0
            return Math.max(max, n)
          }, 0)
        }
      } catch(e) {
        console.error('Orders load exception:', e)
      }
    }
    load()
    return () => {}
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
    const { error } = await supabase.from('orders').update(toDB(updated)).eq('id', editingId)
    if (error) {
      console.error('Update order error:', error)
      showToast({ label: '⚠️ Save failed', customer: data.customer, msg: 'Could not save changes. Check your connection.' })
      return
    }
    setOrders(prev => prev.map(o => o.id !== editingId ? o : updated))
    setEditingId(null)
  }

  // ── Create ──
  const handleCreateOrder = async (data) => {
    orderSeq++
    const id = `SRP-${String(orderSeq).padStart(3, '0')}`
    const newOrder = { id, ...data, notifications: [{ text: '✓ Order created', ts: new Date().toISOString() }], stage: 'received', createdAt: new Date().toISOString() }
    const dbRow = toDB(newOrder)
    const { error } = await supabase.from('orders').insert(dbRow)
    if (error) {
      console.error('Create order error:', error)
      showToast({ label: '⚠️ Save failed', customer: data.customer, msg: 'Order could not be saved. Check your connection.' })
      return
    }
    setOrders(prev => [...prev, newOrder])
    setShowNew(false)
    showToast({ label: '✓ Order created', customer: data.customer, msg: `${id} added to the board.` })
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

  if (!user) return <Login />

  return (
    <div className={`${styles.app} ${sidebarOpen ? styles.sidebarExpanded : styles.sidebarCollapsed}`}>

      {/* ── Left Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.sidebarLogo}>
            <img src="/srp-logo.png" alt="Sweet Red Peach" className={styles.sidebarLogoImg} />
            {sidebarOpen && <div className={styles.sidebarLogoText}>Carson Ops</div>}
          </div>
          <button className={styles.sidebarToggle} onClick={() => setSidebarOpen(v => !v)} title={sidebarOpen ? 'Collapse' : 'Expand'}>
            <IconChevron open={sidebarOpen} />
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          {sidebarOpen && <div className={styles.sidebarSection}>Operations</div>}
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={!sidebarOpen ? label : undefined}
              className={({ isActive }) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
            >
              <span className={styles.sidebarIcon}><Icon /></span>
              {sidebarOpen && <span className={styles.sidebarLabel}>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarUser} title={!sidebarOpen ? (profile?.full_name || profile?.email) : undefined}>
            <div className={styles.sidebarAvatar}>
              {(profile?.full_name || profile?.email || user?.email || '?').slice(0,2).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className={styles.sidebarUserInfo}>
                <div className={styles.sidebarUserName}>{profile?.full_name || profile?.email}</div>
                <div className={styles.sidebarUserRole}>{profile?.role || 'employee'}</div>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button className={styles.sidebarSignOut} onClick={signOut}>Sign out</button>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className={styles.mainContent}>
        <Header orders={orders} onNewOrder={() => setShowNew(true)} onJumpToOrder={handleJumpToOrder} profile={profile} onSignOut={signOut} />
        <Routes>
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/production" element={<Production />} />
        <Route path="/waste" element={<Waste />} />
        <Route path="/schedule" element={<Schedule />} />
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

      {editingId  && <OrderModal mode="edit" order={editOrder} onSave={handleSaveEdit} onClose={() => setEditingId(null)} onDelete={handleDelete} isAdmin={isAdmin} />}

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
    </div>
  )
}
