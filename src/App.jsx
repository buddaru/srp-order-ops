import { useState, useCallback, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase, withTimeout } from './lib/supabase'
import { seedOrders } from './data/orders'
import { STAGES, fmtDate, diffDays, STRIP_DAYS } from './utils/helpers'
import Header     from './components/Header'
import CalStrip   from './components/CalStrip'
import Board      from './components/Board'
import Drawer     from './components/Drawer'
import OrderModal from './components/OrderModal'
import Toast      from './components/Toast'
import Production from './components/Production'
import Waste      from './components/Waste'
import Schedule   from './components/Schedule'
import Recipes         from './components/Recipes'
import RecipeView      from './components/RecipeView'
import RecipeEdit      from './components/RecipeEdit'
import RecipeGroupPage from './components/RecipeGroupPage'
import Settings        from './components/Settings'
import Admin           from './components/Admin'
import MenuManager     from './components/MenuManager'
import Reports         from './components/Reports'
import Invoices        from './components/Invoices'
import Privacy    from './components/Privacy'
import Terms      from './components/Terms'
import Login      from './components/Login'
import { useAuth } from './context/AuthContext'
import { useBusiness } from './context/BusinessContext'
import styles from './App.module.css'

// ── Sidebar icons ──
const IconOrders   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="3" width="7" height="11"/><rect x="14" y="18" width="7" height="3"/></svg>
const IconProd     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
const IconWaste    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const IconSchedule = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
const IconRecipes  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
const IconSettings = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
const IconAdmin    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IconMenu     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h18M3 6h18M3 14h12M3 18h8"/></svg>
const IconReports = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
const IconInvoices = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>

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
  bentoOrderId:  row.bento_order_id || null,
})

const toDB = (o) => ({
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
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [selectedDay, setSelectedDay] = useState('all')
  const [customDate, setCustomDate]   = useState(false)
  const [selectedStage, setSelectedStage] = useState('active')
  const [drawerOrderId, setDrawerOrderId] = useState(null)
  const [editingId, setEditingId]     = useState(null)
  const [showNew, setShowNew]         = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { user, profile, isAdmin, signOut } = useAuth()
  const { readySms, pickupSms } = useBusiness()
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

  // ── Load orders from Supabase ──
  const loadOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) { console.error('Load orders error:', error); setOrdersLoaded(true); return }
      if (data && data.length > 0) {
        const mapped = data.map(fromDB)
        setOrders(mapped)
        orderSeq = mapped.reduce((max, o) => {
          const n = parseInt(o.id.replace('SRP-', '')) || 0
          return Math.max(max, n)
        }, 0)
      }
      setOrdersLoaded(true)
    } catch(e) {
      console.error('Orders load exception:', e)
      setOrdersLoaded(true)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // ── Confirm picked-up (always jumps directly to picked-up regardless of current stage) ──
  const applyPickup = async (id) => {
    const o = orders.find(x => x.id === id)
    if (!o) return
    const notifs = [...o.notifications,
      { text: '→ Moved to Picked Up', ts: new Date().toISOString() },
      { text: '✅ Order picked up',    ts: new Date().toISOString() },
    ]
    setOrders(prev => prev.map(x => x.id === id ? { ...x, stage: 'picked-up', notifications: notifs } : x))
    const { error } = await supabase.from('orders').update({ stage: 'picked-up', notifications: notifs }).eq('id', id)
    if (error) console.error('applyPickup error:', error)
  }

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
    // Optimistic update
    setOrders(prev => prev.map(x => x.id === id ? updated : x))
    const { error } = await supabase.from('orders').update({ stage: newStage, notifications: notifs }).eq('id', id)
    if (error) {
      // Rollback on failure
      setOrders(prev => prev.map(x => x.id === id ? o : x))
      showToast({ label: '⚠️ Update failed', customer: o.customer, msg: 'Stage change could not be saved. Please try again.' })
    }
  }

  const handleSetStage = async (id, newStageId) => {
    const o = orders.find(x => x.id === id)
    if (!o || o.stage === newStageId) return
    if (newStageId === 'picked-up') { setConfirmPickup(id); return }
    const stage = STAGES.find(s => s.id === newStageId)
    const notifs = [...o.notifications, { text: `→ Moved to ${stage.label}`, ts: new Date().toISOString() }]
    const updated = { ...o, stage: newStageId, notifications: notifs }
    // Optimistic update
    setOrders(prev => prev.map(x => x.id === id ? updated : x))
    const { error } = await supabase.from('orders').update({ stage: newStageId, notifications: notifs }).eq('id', id)
    if (error) {
      // Rollback on failure
      setOrders(prev => prev.map(x => x.id === id ? o : x))
      showToast({ label: '⚠️ Update failed', customer: o.customer, msg: 'Stage change could not be saved. Please try again.' })
    }
  }

  // ── Manual SMS ──
  const handleSendSms = async (id) => {
    const o = orders.find(x => x.id === id)
    if (!o) return
    const msg = o.stage === 'ready' ? readySms(o.customer) : pickupSms(o.customer)

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
    // Optimistic update
    setOrders(prev => prev.map(o => o.id !== editingId ? o : updated))
    setEditingId(null)
    const { error } = await supabase.from('orders').update(toDB(updated)).eq('id', editingId)
    if (error) {
      // Rollback: restore original order
      setOrders(prev => prev.map(o => o.id !== editingId ? o : editOrder))
      showToast({ label: '⚠️ Save failed', customer: data.customer, msg: 'Could not save changes. Your edits have been reverted.' })
    }
  }

  // ── Create ──
  const handleCreateOrder = async (data) => {
    // Generate a temporary optimistic ID while we wait for the DB
    const tempSeq = orderSeq + 1
    const tempId = `SRP-${String(tempSeq).padStart(3, '0')}`
    const newOrder = {
      id: tempId, ...data,
      notifications: [{ text: '✓ Order created', ts: new Date().toISOString() }],
      stage: 'received',
      createdAt: new Date().toISOString(),
    }
    // Optimistic: show order immediately
    setOrders(prev => [...prev, newOrder])
    setShowNew(false)

    const dbRow = toDB(newOrder)
    const { data: inserted, error } = await supabase.from('orders').insert(dbRow).select('id').single()
    if (error) {
      // Rollback
      setOrders(prev => prev.filter(o => o.id !== tempId))
      setShowNew(true)
      showToast({ label: '⚠️ Save failed', customer: data.customer, msg: 'Order could not be saved. Check your connection.' })
      return
    }
    // If server returned a different ID (future: use DB sequence), update it
    const finalId = inserted?.id || tempId
    if (finalId !== tempId) {
      setOrders(prev => prev.map(o => o.id === tempId ? { ...o, id: finalId } : o))
    }
    orderSeq = tempSeq
    showToast({ label: '✓ Order created', customer: data.customer, msg: `${finalId} added to the board.` })
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
    <div className={`${styles.app} ${!sidebarOpen ? styles.sidebarCollapsed : ''} ${mobileSidebarOpen ? styles.sidebarOpen : ''}`}>

      {/* Mobile overlay — tap to close sidebar */}
      <div className={styles.sidebarOverlay} onClick={() => setMobileSidebarOpen(false)} />

      {/* ── Left Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.sidebarLogo}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
              <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 700, fontSize: '22px', color: '#131710', letterSpacing: '-0.5px', lineHeight: 1 }}>cadro</span>
              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#245A1F', marginLeft: '2px', flexShrink: 0, position: 'relative', top: '-1px' }}></span>
            </div>
          </div>
          <button className={styles.sidebarToggle} onClick={() => setSidebarOpen(v => !v)} title={sidebarOpen ? 'Collapse' : 'Expand'}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.22s'}}>
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          {sidebarOpen && <div className={styles.sidebarSection}>Operations</div>}
          <NavLink to="/" end onClick={() => setMobileSidebarOpen(false)} className={({isActive}) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`} title={!sidebarOpen ? 'Orders' : undefined}>
            <span className={styles.sidebarIcon}><IconOrders /></span>
            {sidebarOpen && <span>Orders</span>}
          </NavLink>
          <NavLink to="/production" onClick={() => setMobileSidebarOpen(false)} className={({isActive}) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`} title={!sidebarOpen ? 'Daily Production' : undefined}>
            <span className={styles.sidebarIcon}><IconProd /></span>
            {sidebarOpen && <span>Daily Production</span>}
          </NavLink>
          <NavLink to="/waste" onClick={() => setMobileSidebarOpen(false)} className={({isActive}) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`} title={!sidebarOpen ? 'Food Waste' : undefined}>
            <span className={styles.sidebarIcon}><IconWaste /></span>
            {sidebarOpen && <span>Food Waste</span>}
          </NavLink>
          <NavLink to="/schedule" onClick={() => setMobileSidebarOpen(false)} className={({isActive}) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`} title={!sidebarOpen ? 'Schedule' : undefined}>
            <span className={styles.sidebarIcon}><IconSchedule /></span>
            {sidebarOpen && <span>Schedule</span>}
          </NavLink>

          {sidebarOpen && <div className={styles.sidebarSection} style={{marginTop: 6}}>Kitchen</div>}
          {!sidebarOpen && <div style={{height: 8}} />}
          <NavLink to="/recipes" onClick={() => setMobileSidebarOpen(false)} className={({isActive}) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`} title={!sidebarOpen ? 'Recipes' : undefined}>
            <span className={styles.sidebarIcon}><IconRecipes /></span>
            {sidebarOpen && <span>Recipes</span>}
          </NavLink>
          <NavLink to="/reports" onClick={() => setMobileSidebarOpen(false)} className={({isActive}) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`} title={!sidebarOpen ? 'Reports' : undefined}>
            <span className={styles.sidebarIcon}><IconReports /></span>
            {sidebarOpen && <span>Reports</span>}
          </NavLink>
          <NavLink to="/invoices" onClick={() => setMobileSidebarOpen(false)} className={({isActive}) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`} title={!sidebarOpen ? 'Invoices' : undefined}>
            <span className={styles.sidebarIcon}><IconInvoices /></span>
            {sidebarOpen && <span>Invoices</span>}
          </NavLink>

          <div style={{flex: 1}} />

          {sidebarOpen && <div className={styles.sidebarSection} style={{marginTop: 6}}>Account</div>}
          {!sidebarOpen && <div style={{height: 8}} />}
          <NavLink to="/settings" onClick={() => setMobileSidebarOpen(false)} className={({isActive}) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`} title={!sidebarOpen ? 'Settings' : undefined}>
            <span className={styles.sidebarIcon}><IconSettings /></span>
            {sidebarOpen && <span>Settings</span>}
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" onClick={() => setMobileSidebarOpen(false)} className={({isActive}) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`} title={!sidebarOpen ? 'Team' : undefined}>
              <span className={styles.sidebarIcon}><IconAdmin /></span>
              {sidebarOpen && <span>Team</span>}
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/menu" onClick={() => setMobileSidebarOpen(false)} className={({isActive}) => `${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`} title={!sidebarOpen ? 'Menu' : undefined}>
              <span className={styles.sidebarIcon}><IconMenu /></span>
              {sidebarOpen && <span>Menu & Pricing</span>}
            </NavLink>
          )}
        </nav>

        {(sidebarOpen || true) && (
          <div className={styles.sidebarFooter}>
            <div className={styles.sidebarUser}>
              <div className={styles.sidebarAvatar}>
                {(profile?.full_name || profile?.email || user?.email || '?').slice(0,2).toUpperCase()}
              </div>
              <div className={styles.sidebarUserInfo}>
                <div className={styles.sidebarUserName}>{profile?.full_name || profile?.email}</div>
                <div className={styles.sidebarUserRole}>{profile?.role || 'employee'}</div>
              </div>
            </div>
            <button className={styles.sidebarSignOut} onClick={signOut}>Sign out</button>
          </div>
        )}
      </aside>

      {/* ── Main Content ── */}
      <div className={styles.mainContent}>
        <Header orders={orders} onJumpToOrder={handleJumpToOrder} profile={profile} onSignOut={signOut} onMenuOpen={() => setMobileSidebarOpen(true)} onOrdersSynced={loadOrders} />
        <Routes>
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/production" element={<Production />} />
        <Route path="/waste" element={<Waste />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/:id" element={<RecipeView />} />
        <Route path="/recipes/:id/edit" element={<RecipeEdit />} />
        <Route path="/recipe-groups/:id" element={<RecipeGroupPage />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={isAdmin ? <Admin /> : <div style={{padding:'40px 28px'}}><p style={{color:'var(--text-muted)'}}>Access denied.</p></div>} />
        <Route path="/menu" element={isAdmin ? <MenuManager /> : <div style={{padding:'40px 28px'}}><p style={{color:'var(--text-muted)'}}>Access denied.</p></div>} />
        <Route path="/" element={<>
      <CalStrip orders={orders} selectedDay={selectedDay} customDateSelected={customDate} dateRange={dateRange} onSelectDay={handleSelectDay} onRangeSelect={setDateRange} selectedStage={selectedStage} onStageChange={setSelectedStage} />
      <div className={styles.boardWrapper}>
        <Board
          orders={orders}
          ordersLoaded={ordersLoaded}
          selectedDay={selectedDay}
          customDateSelected={customDate}
          dateRange={dateRange}
          selectedStage={selectedStage}
          isAdmin={isAdmin}
          onMove={handleMove}
          onSetStage={handleSetStage}
          onEdit={id => setEditingId(id)}
          onDrawer={id => setDrawerOrderId(id)}
          onDelete={handleDelete}
          onSendSms={handleSendSms}
          onNewOrder={() => setShowNew(true)}
        />
      </div>

      {drawerOrderId && (
        <>
          <div className={styles.drawerBackdrop} onClick={() => setDrawerOrderId(null)} />
          <Drawer order={drawerOrder} onClose={() => setDrawerOrderId(null)} onSmsLog={handleSmsLog} showToast={showToast} />
        </>
      )}

      {editingId && editOrder && <OrderModal mode="edit" order={editOrder} onSave={handleSaveEdit} onClose={() => setEditingId(null)} onDelete={handleDelete} isAdmin={isAdmin} />}
      {editingId && !editOrder && (() => { setTimeout(() => setEditingId(null), 0); return null })()}

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
          onConfirm={() => { applyPickup(confirmPickup); setConfirmPickup(null) }}
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
