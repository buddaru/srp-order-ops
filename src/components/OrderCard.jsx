import { STAGES, dueBadge, orderTotal, fmt$ } from '../utils/helpers'
import styles from './OrderCard.module.css'

export default function OrderCard({ order, isAdmin, onMove, onEdit, onDrawer, onDelete, onSendSms }) {
  const si   = STAGES.findIndex(s => s.id === order.stage)
  const prev = si > 0 ? STAGES[si - 1] : null
  const next = si < STAGES.length - 1 ? STAGES[si + 1] : null
  const done = order.stage === 'picked-up'
  const badge = dueBadge(order)
  const total = orderTotal(order)
  const isReady    = order.stage === 'ready'
  const isPickedUp = order.stage === 'picked-up'

  return (
    <div className={`${styles.card} ${badge.cls === 'overdue' ? styles.overdueCard : ''} ${done ? styles.done : ''}`} onClick={() => onDrawer(order.id)} style={{cursor:'pointer'}}>
      <div className={styles.top}>
        <div className={styles.topRow}>
          <div className={styles.customerInfo}>
            <div className={styles.avatar}>{order.initials}</div>
            <div>
              <div className={styles.customerName}>{order.customer}</div>
              <div className={styles.orderId}>
                {order.id}
                {order.bentoOrderId && <span className={styles.bentoId}> · #{order.bentoOrderId}</span>}
              </div>
            </div>
          </div>
          <div className={`${styles.dueBadge} ${styles[badge.cls]}`}>{badge.label}</div>
        </div>
      </div>

      <div className={styles.items}>
        {(order.items || []).map((item, i) => {
          const nameHasFlavors = item.name && item.name.includes('—')
          const addonRaw = item.addonSummary
          const addonStr = Array.isArray(addonRaw) ? addonRaw.join(' · ') : (addonRaw || '')
          const details = [
            !nameHasFlavors ? item.flavor1 : null,
            !nameHasFlavors ? item.flavor2 : null,
            addonStr,
            item.writingText ? `"${item.writingText}"` : null,
          ].filter(Boolean).join(' · ')
          return (
            <div key={i} className={styles.itemRow}>
              <div className={styles.itemDot} />
              <div className={styles.itemText}>
                {item.qty}× {item.name}
                {details && <div className={styles.itemDetails}>{details}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {total > 0 && <div className={styles.total}>Order total: {fmt$(total)}</div>}
      {order.notes && <div className={styles.note}>📝 {order.notes}</div>}

      <div className={styles.actions}>
        {prev && (
          <button className="btn btn-back" onClick={e => { e.stopPropagation(); onMove(order.id, -1); }}>
            ← {prev.label}
          </button>
        )}
        {next && (
          <button className={`btn ${styles.stageBtn}`} onClick={e => { e.stopPropagation(); onMove(order.id, 1); }}>
            → {next.label}
          </button>
        )}
        <button className="btn" onClick={e => { e.stopPropagation(); onEdit(order.id); }} title="Edit order">✏</button>
      </div>
    </div>
  )
}
