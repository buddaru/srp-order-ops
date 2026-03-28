import { useState } from 'react'
import { fmtDate, fmtTime, orderTotal, fmt$, STAGES } from '../utils/helpers'
import styles from './ListView.module.css'

const STAGE_META = {
  'received':      { label: 'Received',         cls: 'received' },
  'in-production': { label: 'In Production',    cls: 'production' },
  'ready':         { label: 'Ready for Pickup',  cls: 'ready' },
  'picked-up':     { label: 'Picked Up',         cls: 'pickedup' },
}

const AVATAR_COLORS = ['amber','pink','teal','blue','coral','purple']
const avatarColor = (id) => AVATAR_COLORS[parseInt(id.replace('SRP-','')) % AVATAR_COLORS.length]

export default function ListView({ orders, onDrawer, onMove, onSetStage, onEdit }) {
  const [sortCol, setSortCol] = useState('pickup')
  const [sortDir, setSortDir] = useState('asc')

  if (orders.length === 0) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>🧁</div>
      <div className={styles.emptyTitle}>No orders found</div>
      <div className={styles.emptySub}>No orders match the selected date range.</div>
    </div>
  )

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = [...orders].sort((a, b) => {
    let av, bv
    if (sortCol === 'customer') { av = a.customer; bv = b.customer }
    else if (sortCol === 'total') { av = orderTotal(a); bv = orderTotal(b) }
    else { // pickup (default)
      av = (a.pickupDate || '') + (a.pickupTime || '')
      bv = (b.pickupDate || '') + (b.pickupTime || '')
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className={styles.sortIdle}>↕</span>
    return <span className={styles.sortActive}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const Th = ({ col, label, style }) => (
    <div
      className={`${styles.th} ${styles.thSortable} ${sortCol === col ? styles.thActive : ''}`}
      style={style}
      onClick={() => handleSort(col)}
    >
      {label} <SortIcon col={col} />
    </div>
  )

  return (
    <div className={styles.wrap}>
      {/* ── Desktop table ── */}
      <div className={styles.table}>
        <div className={styles.thead}>
          <div className={styles.tr}>
            <div className={styles.th} style={{width:36}}></div>
            <div className={styles.th} style={{width:28}}></div>
            <Th col="customer" label="Customer" style={{flex:'0 0 160px'}} />
            <div className={styles.th} style={{flex:1}}>Items</div>
            <Th col="total" label="Total" style={{width:80}} />
            <Th col="pickup" label="Pickup" style={{width:120}} />
            <div className={styles.th} style={{width:130}}>Stage</div>
          </div>
        </div>
        <div className={styles.tbody}>
          {sorted.map(o => {
            const total = orderTotal(o)
            const meta  = STAGE_META[o.stage] || STAGE_META['received']
            const av    = avatarColor(o.id)
            const itemSummary = o.items.length === 0 ? '—'
              : o.items.map(i => {
                  const flavor = [i.flavor1, i.flavor2].filter(Boolean).join(', ')
                  return `${i.qty}× ${i.name}${flavor ? ` (${flavor})` : ''}`
                }).join(', ')
            return (
              <div key={o.id} className={styles.tr} onClick={() => onDrawer(o.id)}>
                <div className={styles.td}>
                  <div className={`${styles.avatar} ${styles['av_'+av]}`}>
                    {o.initials || o.customer.slice(0,2).toUpperCase()}
                  </div>
                </div>
                <div className={styles.td} style={{width:28}} onClick={e => e.stopPropagation()}>
                  <button className={styles.editBtn} onClick={() => onEdit(o.id)} title="Edit order">✏</button>
                </div>
                <div className={styles.td} style={{flex:'0 0 160px'}}>
                  <div className={styles.name}>{o.customer}</div>
                  <div className={styles.id}>{o.id}</div>
                </div>
                <div className={`${styles.td} ${styles.items}`} style={{flex:1}}>{itemSummary}</div>
                <div className={styles.td} style={{width:80}}>
                  <span className={styles.total}>{fmt$(total)}</span>
                </div>
                <div className={styles.td} style={{width:120}}>
                  <div className={styles.date}>{fmtDate(o.pickupDate)}</div>
                  <div className={styles.time}>{fmtTime(o.pickupTime)}</div>
                </div>
                <div className={styles.td} style={{width:150}} onClick={e => e.stopPropagation()}>
                  <select
                    className={`${styles.stagePill} ${styles['pill_'+meta.cls]}`}
                    value={o.stage}
                    onChange={e => onSetStage(o.id, e.target.value)}
                  >
                    {STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Mobile cards ── */}
      <div className={styles.mobileList}>
        {sorted.map(o => {
          const total = orderTotal(o)
          const meta  = STAGE_META[o.stage] || STAGE_META['received']
          const av    = avatarColor(o.id)
          const itemSummary = o.items.length === 0 ? '—'
            : o.items.map(i => {
                const flavor = [i.flavor1, i.flavor2].filter(Boolean).join(', ')
                return `${i.qty}× ${i.name}${flavor ? ` (${flavor})` : ''}`
              }).join(', ')
          return (
            <div key={o.id} className={styles.mobileRow} onClick={() => onDrawer(o.id)}>
              <div className={styles.mobileTop}>
                <div className={`${styles.avatar} ${styles['av_'+av]}`}>
                  {o.initials || o.customer.slice(0,2).toUpperCase()}
                </div>
                <div className={styles.mobileCustomer}>
                  <div className={styles.name}>{o.customer}</div>
                  <div className={styles.id}>{o.id}</div>
                </div>
                <div onClick={e => e.stopPropagation()}>
                  <select
                    className={`${styles.stagePill} ${styles['pill_'+meta.cls]}`}
                    value={o.stage}
                    onChange={e => onSetStage(o.id, e.target.value)}
                  >
                    {STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.mobileItems}>{itemSummary}</div>
              <div className={styles.mobileBottom}>
                <div className={styles.mobilePickup}>
                  <span className={styles.date}>{fmtDate(o.pickupDate)}</span>
                  <span className={styles.time}> · {fmtTime(o.pickupTime)}</span>
                </div>
                <span className={styles.total}>{fmt$(total)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
