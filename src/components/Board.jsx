import { STAGES, diffDays, STRIP_DAYS } from '../utils/helpers'
import OrderCard from './OrderCard'
import styles from './Board.module.css'

export default function Board({ orders, selectedDay, customDateSelected, onMove, onEdit, onDrawer, onDelete, onSendSms }) {
  const visible = orders.filter(o => {
    if (selectedDay === 'all') {
      const d = diffDays(o.pickupDate)
      return d >= 0 && d <= STRIP_DAYS - 1
    }
    return o.pickupDate === selectedDay
  })

  const hasAny = visible.length > 0

  return (
    <div className={styles.board}>
      {!hasAny && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🧁</div>
          <div className={styles.emptyTitle}>No orders available</div>
          <div className={styles.emptySub}>No orders scheduled for this date.</div>
        </div>
      )}
      {hasAny && STAGES.map(stage => {
        const stageOrders = visible.filter(o => o.stage === stage.id)
        return (
          <div key={stage.id} className={styles.column}>
            <div className={styles.colHeader}>
              <div className={`${styles.colDot} ${styles['dot_' + stage.id.replace('-','_')]}`} />
              <div className={styles.colTitle}>{stage.label}</div>
              <div className={styles.colCount}>{stageOrders.length}</div>
            </div>
            <div className={styles.cards}>
              {stageOrders.length === 0
                ? <div className={styles.emptyCol}>No orders here</div>
                : stageOrders.map(o => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onMove={onMove}
                      onEdit={onEdit}
                      onDrawer={onDrawer}
                      onDelete={onDelete}
                      onSendSms={onSendSms}
                    />
                  ))
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}
