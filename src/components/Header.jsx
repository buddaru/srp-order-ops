import { useState } from 'react'
import { STAGES, fmtDate, diffDays } from '../utils/helpers'
import styles from './Header.module.css'

function highlight(str, q) {
  const i = str.toLowerCase().indexOf(q.toLowerCase())
  if (i === -1) return str
  return (
    <>
      {str.substring(0, i)}
      <mark className={styles.highlight}>{str.substring(i, i + q.length)}</mark>
      {str.substring(i + q.length)}
    </>
  )
}

export default function Header({ orders, onNewOrder, onJumpToOrder, activeCount, readyCount }) {
  const [query, setQuery]     = useState('')
  const [showRes, setShowRes] = useState(false)

  const matches = query.trim()
    ? orders.filter(o => {
        const q = query.toLowerCase()
        return (
          o.customer.toLowerCase().includes(q) ||
          (o.phone  && o.phone.toLowerCase().includes(q))  ||
          (o.email  && o.email.toLowerCase().includes(q))  ||
          o.items.some(i => i.name.toLowerCase().includes(q)) ||
          o.id.toLowerCase().includes(q)
        )
      }).slice(0, 6)
    : []

  const handleSelect = (id) => {
    setQuery('')
    setShowRes(false)
    onJumpToOrder(id)
  }

  return (
    <header className={styles.header}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoMark}>S</div>
        <div className={styles.logoText}>
          <div className={styles.logoName}>Sweet Red Peach</div>
          <div className={styles.logoSub}>Order Operations</div>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <div className={styles.searchRow}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by name, phone, email, item…"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowRes(true) }}
            onFocus={() => setShowRes(true)}
            onBlur={() => setTimeout(() => setShowRes(false), 150)}
            autoComplete="off"
          />
        </div>
        {showRes && query.trim() && (
          <div className={styles.results}>
            {matches.length === 0 ? (
              <div className={styles.empty}>No orders found</div>
            ) : matches.map(o => {
              const q = query.toLowerCase()
              const stage = STAGES.find(s => s.id === o.stage)?.label || o.stage
              const matchedItem = o.items.find(i => i.name.toLowerCase().includes(q))
              return (
                <div key={o.id} className={styles.resultItem} onMouseDown={() => handleSelect(o.id)}>
                  <div className={styles.resultName}>
                    {highlight(o.customer, query)}
                    <span className={styles.resultId}> · {o.id}</span>
                  </div>
                  <div className={styles.resultMeta}>
                    {stage} · {fmtDate(o.pickupDate)} · {matchedItem ? highlight(matchedItem.name, query) : o.items[0]?.name || ''}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className={styles.right}>
        <div className={styles.statPill}><span>Active</span><b>{activeCount}</b></div>
        <div className={styles.statPill}><span>Ready</span><b>{readyCount}</b></div>
        <button className={styles.btnNew} onClick={onNewOrder}>+ New Order</button>
      </div>
    </header>
  )
}
