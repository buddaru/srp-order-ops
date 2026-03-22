import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { STAGES, fmtDate, diffDays, fmtNow, toDS } from '../utils/helpers'
import styles from './Header.module.css'
import { useAuth } from '../context/AuthContext'

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

export default function Header({ orders, onNewOrder, onJumpToOrder, profile, onSignOut, onMenuOpen }) {
  const { user } = useAuth()
  const [query, setQuery]     = useState('')
  const [showRes, setShowRes] = useState(false)

  const localDS = (offset = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  const todayDS    = localDS(0)
  const tomorrowDS = localDS(1)
  const todayCount    = orders.filter(o => o.pickupDate === todayDS && o.stage !== 'picked-up').length
  const tomorrowCount = orders.filter(o => o.pickupDate === tomorrowDS && o.stage !== 'picked-up').length
  const readyCount    = orders.filter(o => o.stage === 'ready').length

  const matches = query.trim()
    ? orders.filter(o => {
        const q = query.toLowerCase()
        return (
          o.customer.toLowerCase().includes(q) ||
          (o.phone && o.phone.toLowerCase().includes(q)) ||
          (o.email && o.email.toLowerCase().includes(q)) ||
          o.items.some(i => i.name.toLowerCase().includes(q)) ||
          o.id.toLowerCase().includes(q)
        )
      }).slice(0, 6)
    : []

  const handleSelect = (id) => {
    setQuery(''); setShowRes(false); onJumpToOrder(id)
  }

  return (
    <header className={styles.headerWrap}>
      <div className={styles.topRow}>
        {/* Hamburger — mobile only */}
        <button className={styles.hamburger} onClick={onMenuOpen}>
          <span/><span/><span/>
        </button>

        {/* Search */}
        <div className={styles.searchWrap}>
          <div className={styles.searchRow}>
            <svg className={styles.searchIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search..."
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

        {/* Right — counters only, no avatar */}
        <div className={styles.right}>
          <div className={styles.counters}>
            <div className={styles.counter}>
              <span className={styles.counterNum}>{todayCount}</span>
              <span className={styles.counterLabel}>Due Today</span>
            </div>
            <div className={styles.counterDivider} />
            <div className={styles.counter}>
              <span className={styles.counterNum}>{tomorrowCount}</span>
              <span className={styles.counterLabel}>Tomorrow</span>
            </div>
            <div className={styles.counterDivider} />
            <div className={styles.counter}>
              <span className={styles.counterNum} style={{color:'#16a34a'}}>{readyCount}</span>
              <span className={styles.counterLabel}>Ready</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
