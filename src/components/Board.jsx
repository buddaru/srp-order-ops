import { useState } from 'react'
import { STAGES, diffDays, STRIP_DAYS } from '../utils/helpers'
import OrderCard from './OrderCard'
import ListView from './ListView'
import styles from './Board.module.css'

export default function Board({ orders, selectedDay, customDateSelected, dateRange, isAdmin, onMove, onSetStage, onEdit, onDrawer, onDelete, onSendSms, onNewOrder }) {
  const [viewMode, setViewMode] = useState('list')

  const visible = orders.filter(o => {
    if (dateRange) {
      return o.pickupDate >= dateRange.start && o.pickupDate <= dateRange.end
    }
    if (selectedDay === 'all') {
      return o.stage !== 'picked-up'
    }
    return o.pickupDate === selectedDay
  })

  const hasAny = visible.length > 0

  return (
    <div className={viewMode === 'list' ? styles.boardList : styles.boardWrap}>
      {/* ── View toggle bar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarCount}>
          {visible.length} {visible.length === 1 ? 'order' : 'orders'}
          {dateRange && <span className={styles.rangeTag}>
            {dateRange.start} – {dateRange.end}
          </span>}
        </div>
        <div className={styles.toolbarRight}>
          <div className={styles.viewToggle}>
            <button className={`${styles.vtBtn} ${viewMode === 'list' ? styles.vtActive : ''}`} onClick={() => setViewMode('list')}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="0" y="1" width="13" height="2" rx="1" fill="currentColor"/><rect x="0" y="5.5" width="13" height="2" rx="1" fill="currentColor"/><rect x="0" y="10" width="13" height="2" rx="1" fill="currentColor"/></svg>
              List
            </button>
            <div className={styles.vtDivider} />
            <button className={`${styles.vtBtn} ${viewMode === 'cards' ? styles.vtActive : ''}`} onClick={() => setViewMode('cards')}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="0" y="0" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="7.5" y="0" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="0" y="7.5" width="5.5" height="5.5" rx="1" fill="currentColor"/><rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1" fill="currentColor"/></svg>
              Cards
            </button>
          </div>
          {onNewOrder && (
            <button className={styles.newOrderBtn} onClick={onNewOrder}>+ New Order</button>
          )}
        </div>
      </div>

      {/* ── List view ── */}
      {viewMode === 'list' && (
        <ListView orders={visible} onDrawer={onDrawer} onMove={onMove} onSetStage={onSetStage} />
      )}

      {/* ── Card view ── */}
      {viewMode === 'cards' && (
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
              <div key={stage.id} className={`${styles.column} ${styles['col_' + stage.id.replace(/-/g,'_')]}`}>
                <div className={styles.colHeader}>
                  <div className={styles.colLabel}>
                    <span className={styles.colName}>{stage.label}</span>
                  </div>
                  <div className={`${styles.colCount} ${styles['badge_' + stage.id.replace(/-/g,'_')]}`}>{stageOrders.length}</div>
                </div>
                <div className={styles.cards}>
                  {stageOrders.length === 0
                    ? <div className={styles.emptyCol}>
                        <div className={styles.emptyColIcon}>{stage.id === 'ready' ? '🎁' : stage.id === 'picked-up' ? '✓' : '📋'}</div>
                        <div>{stage.id === 'ready' ? 'Nothing ready yet' : stage.id === 'picked-up' ? 'No pickups today' : 'No orders here'}</div>
                      </div>
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
      )}
    </div>
  )
}
