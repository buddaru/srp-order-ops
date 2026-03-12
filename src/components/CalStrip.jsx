import { useState, useRef, useEffect } from 'react'
import { toDS, today, daysFromNow, diffDays, fmtDate, STRIP_DAYS } from '../utils/helpers'
import CalendarPopup from './CalendarPopup'
import styles from './CalStrip.module.css'

export default function CalStrip({ orders, selectedDay, customDateSelected, onSelectDay }) {
  const [showCal, setShowCal] = useState(false)
  const calRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (calRef.current && !calRef.current.contains(e.target)) setShowCal(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const orderDates = new Set(orders.map(o => o.pickupDate))

  const inWindowCount = orders.filter(o => {
    const d = diffDays(o.pickupDate)
    return d >= 0 && d <= STRIP_DAYS - 1
  }).length

  const browseBtnLabel = customDateSelected && selectedDay !== 'all'
    ? fmtDate(selectedDay)
    : 'Browse'

  return (
    <div className={styles.strip}>
      {/* All tab */}
      <div
        className={`${styles.tab} ${styles.allTab} ${selectedDay === 'all' && !customDateSelected ? styles.active : ''}`}
        onClick={() => onSelectDay('all', false)}
      >
        <div className={styles.tabLabel}>All</div>
        <div className={styles.tabDate}>All</div>
        <div className={styles.tabCount}>{inWindowCount}</div>
      </div>

      <div className={styles.divider} />

      {/* 10-day tabs */}
      {Array.from({ length: STRIP_DAYS }, (_, i) => {
        const d   = daysFromNow(i)
        const ds  = toDS(d)
        const n   = orders.filter(o => o.pickupDate === ds).length
        const lbl = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })
        const isActive = selectedDay === ds && !customDateSelected
        return (
          <div
            key={ds}
            className={`${styles.tab} ${isActive ? styles.active : ''}`}
            onClick={() => onSelectDay(ds, false)}
          >
            <div className={styles.tabLabel}>{lbl}</div>
            <div className={styles.tabDate}>{d.getDate()}</div>
            <div className={styles.tabCount}>{n}</div>
          </div>
        )
      })}

      {/* Browse button */}
      <div className={styles.end} ref={calRef}>
        <button
          className={`${styles.browseBtn} ${customDateSelected ? styles.browseBtnActive : ''}`}
          onClick={() => setShowCal(v => !v)}
        >
          📅 <span>{browseBtnLabel}</span>
        </button>
        {showCal && (
          <div className={styles.calWrap}>
            <CalendarPopup
              selectedDate={customDateSelected ? selectedDay : null}
              allowPast={true}
              orderDates={orderDates}
              onSelect={(ds) => { onSelectDay(ds, true); setShowCal(false) }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
