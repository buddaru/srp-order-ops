import { STAGES, dueBadge, orderTotal, fmt$ } from '../utils/helpers'
import styles from './OrderCard.module.css'

export default function OrderCard({ order, onMove, onEdit, onDrawer }) {
  const si   = STAGES.findIndex(s => s.id === order.stage)
  const prev = si > 0 ? STAGES[si - 1] : null
  const next = si < STAGES.length - 1 ? STAGES[si + 1] : null
  const done = order.stage === 'picked-up'
  const badge = dueBadge(order)
  const total = orderTotal(order)

  return (
    <div className={`${styles.card} ${badge.cls === 'overdue' ? styles.overdue : ''} ${done ? styles.done : ''}`}>
      {/* Top row */}
      <div className={styles.top}>
        <div className={styles.customerInfo}>
          <div className={styles.avatar}>{order.initials}</div>
          <div>
            <div className={styles.customerName}>{order.customer}</div>
            <div className={styles.orderId}>{order.id}</div>
          </div>
        </div>
        <div className={`${styles.dueBadge} ${styles[badge.cls]}`}>{badge.label}</div>
      </div>

      {/* Items */}
      <div className={styles.items}>
        {order.items.map((item, i) => (
          <div key={i} className={styles.itemRow}>
            <div className={styles.itemDot} />
            <div className={styles.itemText}>{item.qty}× {item.name}</div>
          </div>
        ))}
      </div>

      {/* Total */}
      {total > 0 && (
        <div className={styles.total}>Order total: {fmt$(total)}</div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className={styles.note}>📝 {order.notes}</div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {prev && (
          <button className="btn btn-back" onClick={() => onMove(order.id, -1)}>
            ← {prev.label}
          </button>
        )}
        {next && (
          <button className="btn btn-primary" onClick={() => onMove(order.id, 1)}>
            → {next.label}
          </button>
        )}
        <button className="btn" onClick={() => onEdit(order.id)}>✏</button>
        <button className="btn" onClick={() => onDrawer(order.id)}>☰</button>
      </div>
    </div>
  )
}
