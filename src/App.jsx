import { useState, useCallback } from 'react'
import { seedOrders } from './data/orders'
import { STAGES, READY_SMS, fmtDate, diffDays } from './utils/helpers'
import Header    from './components/Header'
import CalStrip  from './components/CalStrip'
import Board     from './components/Board'
import Drawer    from './components/Drawer'
import OrderModal from './components/OrderModal'
import Toast     from './components/Toast'
import styles from './App.module.css'

let orderSeq = seedOrders.length

export default function App() {
  const [orders, setOrders]               = useState(seedOrders)
  const [selectedDay, setSelectedDay]     = useState('all')
  const [customDate, setCustomDate]       = useState(false)
  const [drawerOrderId, setDrawerOrderId] = useState(null)
  const [editingId, setEditingId]         = useState(null)   // null = closed, string = editing
  const [showNew, setShowNew]             = useState(false)
  const [toast, setToast]                 = useState(null)

  // ── Derived ──
  const drawerOrder = orders.find(o => o.id === drawerOrderId) || null
  const editOrder   = orders.find(o => o.id === editingId)     || null
  const activeCount = orders.filter(o => ['received','in-production'].includes(o.stage)).length
  const readyCount  = orders.filter(o => o.stage === 'ready').length

  // ── Toast helper ──
  const showToast = useCallback((t) => setToast(t), [])

  // ── Stage movement ──
  const handleMove = (id, dir) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o
      const si = STAGES.findIndex(s => s.id === o.stage)
      const ni = si + dir
      if (ni < 0 || ni >= STAGES.length) return o
      const newStage = STAGES[ni].id
      const notifs   = [...o.notifications]
      if (dir === 1) {
        if (newStage === 'ready') {
          const msg = READY_SMS(o.customer)
          notifs.push(`📱 SMS sent: "${msg.substring(0, 55)}…"`)
          showToast({ label: '📱 SMS sent — Ready for Pickup', customer: o.customer, msg })
        } else if (newStage === 'picked-up') {
          notifs.push('✅ Order picked up')
        } else {
          notifs.push(`→ Moved to ${STAGES[ni].label}`)
        }
      } else {
        notifs.push(`↩ Moved back to ${STAGES[ni].label}`)
      }
      return { ...o, stage: newStage, notifications: notifs }
    }))
  }

  // ── Save edit ──
  const handleSaveEdit = (data) => {
    setOrders(prev => prev.map(o =>
      o.id !== editingId ? o : {
        ...o, ...data,
        notifications: [...o.notifications, '✏ Order details updated by staff']
      }
    ))
    setEditingId(null)
  }

  // ── Create new order ──
  const handleCreateOrder = (data) => {
    orderSeq++
    const id = `SRP-${String(orderSeq).padStart(3, '0')}`
    setOrders(prev => [...prev, {
      id,
      ...data,
      notifications: ['✓ Order created by staff'],
      stage: 'received',
    }])
    setShowNew(false)
  }

  // ── SMS log from drawer ──
  const handleSmsLog = (id, entry) => {
    setOrders(prev => prev.map(o =>
      o.id !== id ? o : { ...o, notifications: [...o.notifications, entry] }
    ))
  }

  // ── Jump to order from search ──
  const handleJumpToOrder = (id) => {
    const o = orders.find(x => x.id === id)
    if (!o) return
    const d = diffDays(o.pickupDate)
    if (d >= 0 && d <= 4) {
      setSelectedDay(o.pickupDate)
      setCustomDate(false)
    } else {
      setSelectedDay(o.pickupDate)
      setCustomDate(true)
    }
    setDrawerOrderId(id)
  }

  // ── Day selection ──
  const handleSelectDay = (ds, isCustom) => {
    setSelectedDay(ds)
    setCustomDate(isCustom)
  }

  return (
    <div className={styles.app}>
      <Header
        orders={orders}
        onNewOrder={() => setShowNew(true)}
        onJumpToOrder={handleJumpToOrder}
        activeCount={activeCount}
        readyCount={readyCount}
      />

      <CalStrip
        orders={orders}
        selectedDay={selectedDay}
        customDateSelected={customDate}
        onSelectDay={handleSelectDay}
      />

      <div className={styles.boardWrapper}>
        <Board
          orders={orders}
          selectedDay={selectedDay}
          customDateSelected={customDate}
          onMove={handleMove}
          onEdit={(id) => setEditingId(id)}
          onDrawer={(id) => setDrawerOrderId(id)}
          fmtDateFn={fmtDate}
        />
      </div>

      {/* Drawer */}
      {drawerOrderId && (
        <>
          <div className={styles.drawerBackdrop} onClick={() => setDrawerOrderId(null)} />
          <Drawer
            order={drawerOrder}
            onClose={() => setDrawerOrderId(null)}
            onSmsLog={handleSmsLog}
            showToast={showToast}
          />
        </>
      )}

      {/* Edit modal */}
      {editingId && (
        <OrderModal
          mode="edit"
          order={editOrder}
          onSave={handleSaveEdit}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* New order modal */}
      {showNew && (
        <OrderModal
          mode="new"
          onSave={handleCreateOrder}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
