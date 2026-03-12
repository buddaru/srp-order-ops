import { STAGES, diffDays } from '../utils/helpers'
import OrderCard from './OrderCard'
import styles from './Board.module.css'

const SORT_BY_DUE = (arr) =>
  [...arr].sort(
    (a, b) =>
      new Date(a.pickupDate + 'T' + a.pickupTime) -
      new Date(b.pickupDate + 'T' + b.pickupTime)
  )

export default function Board({ orders, selectedDay, customDateSelected, onMove, onEdit, onDrawer, fmtDateFn }) {
  // Filter by selected day
  let visible
  if (selectedDay === 'all') {
    visible = orders.filter(o => { const d = diffDays(o.pickupDate); return d >= 0 && d <= 4 })
  } else {
    visible = orders.filter(o => o.pickupDate === selectedDay)
  }

  if (visible.length === 0) {
    const label = selectedDay === 'all'
      ? 'No orders in the next 5 days.'
      : `No orders found for ${fmtDateFn(selectedDay)}.`
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📭</div>
        <div className={styles.emptyTitle}>No Orders Available</div>
        <div className={styles.emptySub}>{label}</div>
      </div>
    )
  }

  return (
    <div className={styles.board}>
      {STAGES.map(stage => {
        const staged = SORT_BY_DUE(visible.filter(o => o.stage === stage.id))
        return (
          <div key={stage.id} className={styles.column} data-stage={stage.id}>
            <div className={styles.colHeader}>
              <div className={styles.colLabel}>
                <div className={styles.colDot} />
                <div className={styles.colName}>{stage.label}</div>
              </div>
              <div className={styles.colCount}>{staged.length}</div>
            </div>
            <div className={styles.colCards}>
              {staged.map(o => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onMove={onMove}
                  onEdit={onEdit}
                  onDrawer={onDrawer}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
