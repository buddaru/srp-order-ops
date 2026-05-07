import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { STAGES } from '../utils/helpers'
import { supabase } from '../lib/supabase'
import styles from './Header.module.css'
import { useAuth } from '../context/AuthContext'
import { useCurrentLocation } from '../context/LocationContext'

export default function Header({ orders, onJumpToOrder, profile, onSignOut, onMenuOpen, onOrdersSynced }) {
  const { user } = useAuth()
  const { currentLocation, locations } = useCurrentLocation() || {}
  const { locationSlug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isOrdersPage = location.pathname.endsWith('/orders') || location.pathname === `/app/${locationSlug}`

  const [syncing, setSyncing]           = useState(false)
  const [syncMsg, setSyncMsg]           = useState(null)
  const [locationMenuOpen, setLocationMenuOpen] = useState(false)
  const locationMenuRef = useRef(null)

  const [failedImports, setFailedImports] = useState([])
  const [failedOpen, setFailedOpen]       = useState(false)
  const failedRef = useRef(null)

  const loadFailed = async () => {
    const { data } = await supabase
      .from('failed_imports')
      .select('gmail_message_id, subject, sender, reason, attempted_at')
      .is('resolved_at', null)
      .order('attempted_at', { ascending: false })
      .limit(50)
    setFailedImports(data || [])
  }

  useEffect(() => {
    if (isOrdersPage && currentLocation?.slug === 'srp-carson') loadFailed()
  }, [isOrdersPage, currentLocation?.slug])

  const handleSync = async (retryFailed = false) => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const url  = retryFailed ? '/api/sync-orders?retryFailed=1' : '/api/sync-orders'
      const res  = await fetch(url, { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.error || data.message || 'No response')
      if (data.imported > 0 && onOrdersSynced) onOrdersSynced()
      loadFailed()
    } catch (err) {
      setSyncMsg('Sync failed: ' + err.message)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 8000)
    }
  }

  const handleDismissFailed = async (messageId) => {
    await supabase
      .from('failed_imports')
      .update({ resolved_at: new Date().toISOString() })
      .eq('gmail_message_id', messageId)
    loadFailed()
  }

  const localDS = (offset = 0) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const todayDS    = localDS(0)
  const tomorrowDS = localDS(1)
  const todayCount    = (orders || []).filter(o => o.pickupDate === todayDS && o.stage !== 'picked-up').length
  const tomorrowCount = (orders || []).filter(o => o.pickupDate === tomorrowDS && o.stage !== 'picked-up').length
  const readyCount    = (orders || []).filter(o => o.stage === 'ready').length

  // Close location dropdown on outside click
  useEffect(() => {
    if (!locationMenuOpen) return
    const handler = (e) => {
      if (locationMenuRef.current && !locationMenuRef.current.contains(e.target)) {
        setLocationMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [locationMenuOpen])

  // Close failed-imports popover on outside click
  useEffect(() => {
    if (!failedOpen) return
    const handler = (e) => {
      if (failedRef.current && !failedRef.current.contains(e.target)) {
        setFailedOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [failedOpen])

  const handleLocationSwitch = (slug) => {
    setLocationMenuOpen(false)
    if (slug === locationSlug) return
    // Swap the slug in the current path so the user stays on the same page
    const newPath = location.pathname.replace(`/app/${locationSlug}`, `/app/${slug}`)
    navigate(newPath + location.search)
  }

  const showSelector = (locations?.length ?? 0) > 1

  return (
    <header className={styles.headerWrap}>
      <div className={styles.topRow}>
        {/* Hamburger — mobile only */}
        <button className={styles.hamburger} onClick={onMenuOpen} aria-label="Open navigation menu">
          <span/><span/><span/>
        </button>

        {/* Location name (and optional switcher) */}
        {currentLocation && (
          <div className={styles.locationArea} ref={locationMenuRef}>
            <button
              className={`${styles.locationBtn} ${showSelector ? styles.locationBtnClickable : ''}`}
              onClick={() => showSelector && setLocationMenuOpen(v => !v)}
              disabled={!showSelector}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span className={styles.locationName}>{currentLocation.name}</span>
              {showSelector && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45, transform: locationMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              )}
            </button>

            {showSelector && locationMenuOpen && (
              <div className={styles.locationDropdown}>
                {locations.map(loc => (
                  <button
                    key={loc.id}
                    className={`${styles.locationOption} ${loc.slug === locationSlug ? styles.locationOptionActive : ''}`}
                    onClick={() => handleLocationSwitch(loc.slug)}
                  >
                    {loc.name}
                    {loc.slug === locationSlug && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Right — sync button + counters */}
        <div className={styles.right}>
          {isOrdersPage && currentLocation?.slug === 'srp-carson' && (
            <>
              <button
                className={styles.syncBtn}
                onClick={() => handleSync(false)}
                disabled={syncing}
                title="Sync orders from email"
                aria-label={syncing ? 'Syncing orders…' : 'Sync orders from email'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
                  <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                  <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
                {syncing ? 'Syncing...' : syncMsg || 'Sync Orders'}
              </button>

              {failedImports.length > 0 && (
                <div className={styles.failedArea} ref={failedRef}>
                  <button
                    className={styles.failedBadge}
                    onClick={() => setFailedOpen(v => !v)}
                    title={`${failedImports.length} email${failedImports.length > 1 ? 's' : ''} couldn't be parsed`}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {failedImports.length}
                  </button>

                  {failedOpen && (
                    <div className={styles.failedDropdown}>
                      <div className={styles.failedHeader}>
                        <span>Couldn't parse {failedImports.length} email{failedImports.length > 1 ? 's' : ''}</span>
                        <button
                          className={styles.failedRetry}
                          onClick={() => { setFailedOpen(false); handleSync(true) }}
                          disabled={syncing}
                        >
                          Retry all
                        </button>
                      </div>
                      <div className={styles.failedList}>
                        {failedImports.map(f => (
                          <div key={f.gmail_message_id} className={styles.failedRow}>
                            <div className={styles.failedRowText}>
                              <div className={styles.failedSubject}>{f.subject || '(no subject)'}</div>
                              <div className={styles.failedReason}>{f.reason}</div>
                            </div>
                            <button
                              className={styles.failedDismiss}
                              onClick={() => handleDismissFailed(f.gmail_message_id)}
                              title="Dismiss"
                            >×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
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
              <span className={styles.counterNum} style={{ color: '#16a34a' }}>{readyCount}</span>
              <span className={styles.counterLabel}>Ready</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
