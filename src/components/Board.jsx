import { useState } from 'react'
import { STAGES, diffDays, STRIP_DAYS, fmtDate } from '../utils/helpers'
import OrderCard from './OrderCard'
import ListView from './ListView'
import styles from './Board.module.css'

export default function Board({ orders, ordersLoaded, selectedDay, customDateSelected, dateRange, selectedStage, isAdmin, onMove, onSetStage, onEdit, onDrawer, onDelete, onSendSms, onNewOrder }) {
  const [viewMode, setViewMode] = useState('list')
  const [query, setQuery]       = useState('')
  const [showRes, setShowRes]   = useState(false)

  const visible = orders.filter(o => {
    // Stage filter
    if (selectedStage === 'active') {
      if (o.stage === 'picked-up') return false
    } else if (selectedStage && selectedStage !== 'active') {
      if (o.stage !== selectedStage) return false
    }
    // Date filter
    if (dateRange) {
      return o.pickupDate >= dateRange.start && o.pickupDate <= dateRange.end
    }
    if (selectedDay === 'all') return true
    return o.pickupDate === selectedDay
  })

  const hasAny = visible.length > 0

  return (
    <div className={viewMode === 'list' ? styles.boardList : styles.boardWrap}>
      {/* ── Search ── */}
      <div className={styles.searchRow}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search orders…"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowRes(true) }}
            onFocus={() => setShowRes(true)}
            onBlur={() => setShowRes(false)}
            autoComplete="off"
          />
        </div>
        {showRes && query.trim() && (() => {
          const q = query.toLowerCase()
          const matches = orders.filter(o =>
            o.customer.toLowerCase().includes(q) ||
            (o.phone && o.phone.includes(q)) ||
            o.id.toLowerCase().includes(q) ||
            o.items.some(i => i.name.toLowerCase().includes(q))
          ).slice(0, 6)
          return (
            <div className={styles.searchResults}>
              {matches.length === 0
                ? <div className={styles.searchEmpty}>No orders found</div>
                : matches.map(o => (
                    <div key={o.id} className={styles.searchItem} onMouseDown={e => { e.preventDefault(); onDrawer(o.id); setQuery(''); setShowRes(false) }}>
                      <div className={styles.searchName}>{o.customer} <span className={styles.searchId}>{o.id}</span></div>
                      <div className={styles.searchMeta}>{fmtDate(o.pickupDate)} · {o.items[0]?.name || ''}</div>
                    </div>
                  ))
              }
            </div>
          )
        })()}
      </div>

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
            <button className={`${styles.vtBtn} ${viewMode === 'list' ? styles.vtActive : ''}`} onClick={() => setViewMode('list')} title="List view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              List
            </button>
            <div className={styles.vtDivider} />
            <button className={`${styles.vtBtn} ${viewMode === 'cards' ? styles.vtActive : ''}`} onClick={() => setViewMode('cards')} title="Card view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Cards
            </button>
          </div>
          {onNewOrder && (
            <button className={styles.newOrderBtn} onClick={onNewOrder}>+ New Order</button>
          )}
        </div>
      </div>

      {/* ── List view ── */}
      {viewMode === 'list' && !ordersLoaded && (
        <div className={styles.skeletonWrap}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="skeletonRow">
              <div className="skeletonLine" style={{width:28,height:28,borderRadius:'50%',flexShrink:0}} />
              <div className="skeletonLine" style={{width:24,height:24,borderRadius:6,flexShrink:0}} />
              <div style={{flex:'0 0 160px'}}><div className="skeletonLine" style={{width:'80%',marginBottom:5}} /><div className="skeletonLine" style={{width:'50%',height:10}} /></div>
              <div style={{flex:1}}><div className="skeletonLine" style={{width:'70%'}} /></div>
              <div className="skeletonLine" style={{width:60,flexShrink:0}} />
              <div style={{width:120,flexShrink:0}}><div className="skeletonLine" style={{width:'80%',marginBottom:5}} /><div className="skeletonLine" style={{width:'55%',height:10}} /></div>
              <div className="skeletonLine" style={{width:110,flexShrink:0,borderRadius:20}} />
            </div>
          ))}
        </div>
      )}
      {viewMode === 'list' && ordersLoaded && (
        <ListView orders={visible} onDrawer={onDrawer} onMove={onMove} onSetStage={onSetStage} onEdit={onEdit} />
      )}

      {/* ── Card view ── */}
      {viewMode === 'cards' && !ordersLoaded && (
        <div className={styles.board}>
          {STAGES.filter(s => s.id !== 'picked-up').map(stage => (
            <div key={stage.id} className={`${styles.column} ${styles['col_' + stage.id.replace(/-/g,'_')]}`}>
              <div className={styles.colHeader}>
                <div className={styles.colLabel}><span className={styles.colName}>{stage.label}</span></div>
                <div className={`${styles.colCount} ${styles['badge_' + stage.id.replace(/-/g,'_')]}`}><div className="skeletonLine" style={{width:16,height:16,borderRadius:10}} /></div>
              </div>
              <div className={styles.cards}>
                {[1,2].map(i => (
                  <div key={i} className="skeletonCard" style={{margin:'0 0 8px',padding:14}}>
                    <div style={{display:'flex',gap:8,marginBottom:10}}>
                      <div className="skeletonLine" style={{width:28,height:28,borderRadius:'50%',flexShrink:0}} />
                      <div style={{flex:1}}><div className="skeletonLine" style={{width:'65%',marginBottom:6}} /><div className="skeletonLine" style={{width:'40%',height:10}} /></div>
                    </div>
                    <div className="skeletonLine" style={{width:'90%',marginBottom:6}} />
                    <div className="skeletonLine" style={{width:'70%',marginBottom:12}} />
                    <div style={{display:'flex',gap:6}}><div className="skeletonLine" style={{width:80,height:28,borderRadius:6}} /><div className="skeletonLine" style={{width:100,height:28,borderRadius:6}} /></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {viewMode === 'cards' && ordersLoaded && (
        <div className={styles.board}>
          {!hasAny && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🧁</div>
              <div className={styles.emptyTitle}>No orders available</div>
              <div className={styles.emptySub}>No orders scheduled for this date.</div>
            </div>
          )}
          {hasAny && STAGES.map(stage => {
            const stageOrders = visible
              .filter(o => o.stage === stage.id)
              .sort((a, b) => {
                if (a.pickupDate !== b.pickupDate) return a.pickupDate.localeCompare(b.pickupDate)
                return (a.pickupTimeFrom || a.pickupTime || '').localeCompare(b.pickupTimeFrom || b.pickupTime || '')
              })
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
                        <div>{stage.id === 'ready' ? 'Nothing ready yet — move orders here from In Production' : stage.id === 'picked-up' ? 'No pickups today' : 'No orders here'}</div>
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
