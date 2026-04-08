import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { STAGES, fmtDate, diffDays, fmtNow, toDS } from '../utils/helpers'
import styles from './Header.module.css'
import { useAuth } from '../context/AuthContext'

export default function Header({ orders, onNewOrder, onJumpToOrder, profile, onSignOut, onMenuOpen, onOrdersSynced }) {
  const { user } = useAuth()
  const location = useLocation()
  const isOrdersPage = location.pathname === '/'
  const [syncing, setSyncing]   = useState(false)
  const [syncMsg, setSyncMsg]   = useState(null)

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res  = await fetch('/api/sync-orders', { method: 'POST' })
      const data = await res.json()
      // Show error field if present, then message, then fallback
      setSyncMsg(data.error || data.message || 'No response')
      if (data.imported > 0 && onOrdersSynced) onOrdersSynced()
    } catch (err) {
      setSyncMsg('Sync failed: ' + err.message)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 8000)
    }
  }

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

  return (
    <header className={styles.headerWrap}>
      <div className={styles.topRow}>
        {/* Hamburger — mobile only */}
        <button className={styles.hamburger} onClick={onMenuOpen}>
          <span/><span/><span/>
        </button>

        <div style={{ flex: 1 }} />

        {/* Right — sync button + counters */}
        <div className={styles.right}>
          {isOrdersPage && (
            <button
              className={styles.syncBtn}
              onClick={handleSync}
              disabled={syncing}
              title="Sync orders from email"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
                <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              {syncing ? 'Syncing...' : syncMsg || 'Sync Orders'}
            </button>
          )}
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
