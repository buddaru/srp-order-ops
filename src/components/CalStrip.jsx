import { useState, useRef, useEffect } from 'react'
import { toDS, today, daysFromNow, diffDays, fmtDate, STRIP_DAYS } from '../utils/helpers'
import CalendarPopup from './CalendarPopup'
import styles from './CalStrip.module.css'

export default function CalStrip({ orders, selectedDay, customDateSelected, dateRange, onSelectDay, onRangeSelect }) {
  const [pendingStart, setPendingStart] = useState(null) // first click made, waiting for end
  const [showCal, setShowCal]           = useState(false)
  const calRef = useRef(null)

  // Clear pending if range is cleared externally
  useEffect(() => {
    if (!dateRange) setPendingStart(null)
  }, [dateRange])

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

  // ── Strip day click logic ──
  const handleDayClick = (ds) => {
    if (dateRange) {
      // Range active — start fresh
      setPendingStart(ds)
      onRangeSelect(null)
      onSelectDay(ds, false)
      return
    }
    if (!pendingStart) {
      // First click — set pending start, also show as selected
      setPendingStart(ds)
      onSelectDay(ds, false)
    } else if (pendingStart === ds) {
      // Clicked same day — cancel pending
      setPendingStart(null)
      onSelectDay(ds, false)
    } else {
      // Second click — complete the range
      const start = pendingStart < ds ? pendingStart : ds
      const end   = pendingStart < ds ? ds : pendingStart
      setPendingStart(null)
      onRangeSelect({ start, end })
    }
  }

  // ── Calendar pick (used as end date when pendingStart set, or single browse) ──
  const handleCalPick = (ds) => {
    setShowCal(false)
    if (pendingStart) {
      const start = pendingStart < ds ? pendingStart : ds
      const end   = pendingStart < ds ? ds : pendingStart
      setPendingStart(null)
      onRangeSelect({ start, end })
    } else {
      onSelectDay(ds, true)
    }
  }

  const handleAllClick = () => {
    setPendingStart(null)
    onRangeSelect(null)
    onSelectDay('all', false)
  }

  const handleClearRange = () => {
    setPendingStart(null)
    onRangeSelect(null)
    onSelectDay('all', false)
  }

  // ── Tab styling helpers ──
  const getTabState = (ds) => {
    if (dateRange) {
      if (ds === dateRange.start) return 'rangeStart'
      if (ds === dateRange.end)   return 'rangeEnd'
      if (ds > dateRange.start && ds < dateRange.end) return 'rangeMid'
    }
    if (pendingStart === ds) return 'pendingStart'
    if (!dateRange && !pendingStart && selectedDay === ds && !customDateSelected) return 'single'
    return 'normal'
  }

  const tabCls = (state) => {
    if (state === 'rangeStart')   return `${styles.tab} ${styles.tabRangeStart}`
    if (state === 'rangeEnd')     return `${styles.tab} ${styles.tabRangeEnd}`
    if (state === 'rangeMid')     return `${styles.tab} ${styles.tabRangeMid}`
    if (state === 'pendingStart') return `${styles.tab} ${styles.tabPending}`
    if (state === 'single')       return `${styles.tab} ${styles.active}`
    return styles.tab
  }

  // Browse button label
  const browseBtnLabel = pendingStart
    ? 'Pick end date →'
    : customDateSelected && !dateRange && selectedDay !== 'all'
      ? fmtDate(selectedDay)
      : 'Browse'

  const browseBtnCls = pendingStart
    ? `${styles.browseBtn} ${styles.browseBtnPicking}`
    : customDateSelected && !dateRange
      ? `${styles.browseBtn} ${styles.browseBtnActive}`
      : styles.browseBtn

  // Range label for clear pill
  const rangeLabel = dateRange ? (() => {
    const fmt = ds => {
      const d = new Date(ds + 'T00:00:00')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    return `✕ ${fmt(dateRange.start)} – ${fmt(dateRange.end)}`
  })() : null

  return (
    <div className={styles.strip}>
      {/* All tab */}
      <div
        className={`${styles.tab} ${styles.allTab} ${!dateRange && !pendingStart && selectedDay === 'all' && !customDateSelected ? styles.active : ''}`}
        onClick={handleAllClick}
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
        const state = getTabState(ds)
        return (
          <div key={ds} className={tabCls(state)} onClick={() => handleDayClick(ds)}>
            <div className={styles.tabLabel}>{lbl}</div>
            <div className={styles.tabDate}>{d.getDate()}</div>
            <div className={styles.tabCount}>{n}</div>
          </div>
        )
      })}

      {/* Browse / Clear pill */}
      <div className={styles.end} ref={calRef}>
        {dateRange
          ? <button className={styles.clearPill} onClick={handleClearRange}>{rangeLabel}</button>
          : (
            <button className={browseBtnCls} onClick={() => setShowCal(v => !v)}>
              📅 <span>{browseBtnLabel}</span>
            </button>
          )
        }
        {showCal && (
          <div className={styles.calWrap}>
            <CalendarPopup
              selectedDate={pendingStart || (customDateSelected ? selectedDay : null)}
              rangeStart={pendingStart}
              allowPast={true}
              orderDates={orderDates}
              onSelect={handleCalPick}
            />
          </div>
        )}
      </div>
    </div>
  )
}
