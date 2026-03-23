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

export default function ListView({ orders, onDrawer, onMove }) {
  if (orders.length === 0) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>🧁</div>
      <div className={styles.emptyTitle}>No orders found</div>
      <div className={styles.emptySub}>No orders match the selected date range.</div>
    </div>
  )

  const sorted = [...orders].sort((a, b) => {
    if (a.pickupDate !== b.pickupDate) return a.pickupDate.localeCompare(b.pickupDate)
    return (a.pickupTime || '').localeCompare(b.pickupTime || '')
  })

  return (
    <div className={styles.wrap}>
      {/* ── Desktop table ── */}
      <div className={styles.table}>
        <div className={styles.thead}>
          <div className={styles.tr}>
            <div className={styles.th} style={{width:36}}></div>
            <div className={styles.th} style={{flex:'0 0 160px'}}>Customer</div>
            <div className={styles.th} style={{flex:1}}>Items</div>
            <div className={styles.th} style={{width:80}}>Total</div>
            <div className={styles.th} style={{width:120}}>Pickup</div>
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
            const si   = STAGES.findIndex(s => s.id === o.stage)
            const prev = STAGES[si - 1]
            const next = STAGES[si + 1]
            return (
              <div key={o.id} className={styles.tr} onClick={() => onDrawer(o.id)}>
                <div className={styles.td}>
                  <div className={`${styles.avatar} ${styles['av_'+av]}`}>
                    {o.initials || o.customer.slice(0,2).toUpperCase()}
                  </div>
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
                <div className={styles.td} style={{width:130}}>
                  <span className={`${styles.pill} ${styles['pill_'+meta.cls]}`}>{meta.label}</span>
                </div>
                <div className={styles.td} style={{width:100}} onClick={e => e.stopPropagation()}>
                  <div className={styles.stageBtns}>
                    {prev && <button className={styles.stageBtn} onClick={() => onMove(o.id, -1)} title={`← ${prev.label}`}>←</button>}
                    {next && <button className={`${styles.stageBtn} ${styles.stageBtnNext}`} onClick={() => onMove(o.id, 1)} title={`→ ${next.label}`}>→</button>}
                  </div>
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
                <span className={`${styles.pill} ${styles['pill_'+meta.cls]}`}>{meta.label}</span>
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
