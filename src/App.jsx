import { useState, useCallback } from 'react'
import { seedOrders } from './data/orders'
import { STAGES, READY_SMS, PICKEDUP_SMS, fmtDate, diffDays, STRIP_DAYS } from './utils/helpers'
import Header     from './components/Header'
import CalStrip   from './components/CalStrip'
import Board      from './components/Board'
import Drawer     from './components/Drawer'
import OrderModal from './components/OrderModal'
import Toast      from './components/Toast'
import styles from './App.module.css'

let orderSeq = seedOrders.length

// Shared confirm modal
function ConfirmModal({ title, message, confirmLabel, confirmStyle, onConfirm, onCancel }) {
  return (
    <div className={styles.confirmOverlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className={styles.confirmBox}>
        <div className={styles.confirmTitle}>{title}</div>
        <div className={styles.confirmMsg}>{message}</div>
        <div className={styles.confirmActions}>
          <button className={styles.confirmCancel} onClick={onCancel}>Cancel</button>
          <button
            className={styles.confirmOk}
            style={confirmStyle}
            onClick={onConfirm}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [orders, setOrders]           = useState(seedOrders)
  const [selectedDay, setSelectedDay] = useState('all')
  const [customDate, setCustomDate]   = useState(false)
  const [drawerOrderId, setDrawerOrderId] = useState(null)
  const [editingId, setEditingId]     = useState(null)
  const [showNew, setShowNew]         = useState(false)
  const [toast, setToast]             = useState(null)

  // Confirmation modal state
  const [confirmDelete, setConfirmDelete]   = useState(null) // orderId
  const [confirmPickup, setConfirmPickup]   = useState(null) // orderId

  const drawerOrder = orders.find(o => o.id === drawerOrderId) || null
  const editOrder   = orders.find(o => o.id === editingId)     || null

  const showToast = useCallback(t => setToast(t), [])

  // ── Stage movement ──
  const handleMove = (id, dir) => {
    const o = orders.find(x => x.id === id)
    if (!o) return
    const si = STAGES.findIndex(s => s.id === o.stage)
    const ni = si + dir
    if (ni < 0 || ni >= STAGES.length) return
    const newStage = STAGES[ni].id

    // Confirm before Picked Up
    if (newStage === 'picked-up') {
      setConfirmPickup(id)
      return
    }
    applyMove(id, dir)
  }

  const applyMove = (id, dir) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o
      const si = STAGES.findIndex(s => s.id === o.stage)
      const ni = si + dir
      if (ni < 0 || ni >= STAGES.length) return o
      const newStage = STAGES[ni].id
      const notifs = [...o.notifications]
      if (dir === 1) {
        // No auto SMS — user triggers manually via 📱 button
        notifs.push(`→ Moved to ${STAGES[ni].label}`)
        if (newStage === 'picked-up') notifs.push('✅ Order picked up')
      } else {
        notifs.push(`↩ Moved back to ${STAGES[ni].label}`)
      }
      return { ...o, stage: newStage, notifications: notifs }
    }))
  }

  // ── Manual SMS button on card ──
  const handleSendSms = (id) => {
    const o = orders.find(x => x.id === id)
    if (!o) return
    const msg = o.stage === 'ready' ? READY_SMS(o.customer) : PICKEDUP_SMS(o.customer)
    setOrders(prev => prev.map(x =>
      x.id !== id ? x : { ...x, notifications: [...x.notifications, `📱 SMS sent: "${msg.substring(0,55)}…"`] }
    ))
    showToast({ label: '📱 SMS sent', customer: o.customer, msg })
  }

  // ── Delete ──
  const handleDelete = (id) => setConfirmDelete(id)
  const doDelete = () => {
    const id = confirmDelete
    setOrders(prev => prev.filter(o => o.id !== id))
    if (drawerOrderId === id) setDrawerOrderId(null)
    setConfirmDelete(null)
    showToast({ label: '🗑 Order deleted', customer: orders.find(o=>o.id===id)?.customer||'', msg: 'Order has been permanently removed.' })
  }

  // ── Save edit ──
  const handleSaveEdit = (data) => {
    setOrders(prev => prev.map(o =>
      o.id !== editingId ? o : { ...o, ...data, notifications: [...o.notifications, '✏ Order details updated by staff'] }
    ))
    setEditingId(null)
  }

  // ── Create ──
  const handleCreateOrder = (data) => {
    orderSeq++
    const id = `SRP-${String(orderSeq).padStart(3, '0')}`
    setOrders(prev => [...prev, { id, ...data, notifications: ['✓ Order created by staff'], stage: 'received', createdAt: new Date().toISOString() }])
    setShowNew(false)
    showToast({ label: '✓ Order created', customer: data.customer, msg: `${id} added to the board.` })
  }

  // ── SMS log from drawer ──
  const handleSmsLog = (id, entry) => {
    setOrders(prev => prev.map(o => o.id !== id ? o : { ...o, notifications: [...o.notifications, entry] }))
  }

  // ── Jump from search ──
  const handleJumpToOrder = (id) => {
    const o = orders.find(x => x.id === id)
    if (!o) return
    const d = diffDays(o.pickupDate)
    setSelectedDay(o.pickupDate)
    setCustomDate(!(d >= 0 && d <= STRIP_DAYS - 1))
    setDrawerOrderId(id)
  }

  const handleSelectDay = (ds, isCustom) => { setSelectedDay(ds); setCustomDate(isCustom) }

  // Header top offset: header has two rows, ~62px + ~34px = ~96px
  const headerHeight = 96

  return (
    <div className={styles.app}>
      <Header
        orders={orders}
        onNewOrder={() => setShowNew(true)}
        onJumpToOrder={handleJumpToOrder}
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
          onEdit={id => setEditingId(id)}
          onDrawer={id => setDrawerOrderId(id)}
          onDelete={handleDelete}
          onSendSms={handleSendSms}
          fmtDateFn={fmtDate}
        />
      </div>

      {drawerOrderId && (
        <>
          <div className={styles.drawerBackdrop} onClick={() => setDrawerOrderId(null)} />
          <Drawer order={drawerOrder} onClose={() => setDrawerOrderId(null)} onSmsLog={handleSmsLog} showToast={showToast} />
        </>
      )}

      {editingId && (
        <OrderModal mode="edit" order={editOrder} onSave={handleSaveEdit} onClose={() => setEditingId(null)} />
      )}
      {showNew && (
        <OrderModal mode="new" onSave={handleCreateOrder} onClose={() => setShowNew(false)} />
      )}

      {/* Delete confirmation */}
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

      {/* Picked up confirmation */}
      {confirmPickup && (
        <ConfirmModal
          title="Mark as Picked Up?"
          message={`Confirm that ${orders.find(o=>o.id===confirmPickup)?.customer}'s order has been picked up. This will move it to the final stage.`}
          confirmLabel="Yes, picked up"
          confirmStyle={{ background: 'var(--brand)', borderColor: 'var(--brand)' }}
          onConfirm={() => { applyMove(confirmPickup, 1); setConfirmPickup(null) }}
          onCancel={() => setConfirmPickup(null)}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
