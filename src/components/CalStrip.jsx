import { useState, useRef, useEffect } from 'react'
import { toDS, today, daysFromNow, diffDays, fmtDate, STRIP_DAYS } from '../utils/helpers'
import CalendarPopup from './CalendarPopup'
import styles from './CalStrip.module.css'

export default function CalStrip({ orders, selectedDay, customDateSelected, dateRange, onSelectDay, onRangeSelect }) {
  const [showCal, setShowCal]     = useState(false)
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd]     = useState('')
  const [rangeErr, setRangeErr]     = useState('')
  const calRef = useRef(null)

  // Sync inputs when dateRange is cleared externally
  useEffect(() => {
    if (!dateRange) { setRangeStart(''); setRangeEnd(''); setRangeErr('') }
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

  const browseBtnLabel = customDateSelected && selectedDay !== 'all'
    ? fmtDate(selectedDay)
    : 'Browse'

  const handleApplyRange = () => {
    setRangeErr('')
    if (!rangeStart || !rangeEnd) { setRangeErr('Enter both dates'); return }
    if (rangeStart > rangeEnd) { setRangeErr('Start must be before end'); return }
    onRangeSelect({ start: rangeStart, end: rangeEnd })
  }

  const handleClearRange = () => {
    setRangeStart(''); setRangeEnd(''); setRangeErr('')
    onRangeSelect(null)
  }

  const handleTabClick = (ds, isCustom) => {
    if (dateRange) { setRangeStart(''); setRangeEnd(''); onRangeSelect(null) }
    onSelectDay(ds, isCustom)
  }

  return (
    <div className={styles.stripWrap}>
      <div className={styles.strip}>
        {/* All tab */}
        <div
          className={`${styles.tab} ${styles.allTab} ${!dateRange && selectedDay === 'all' && !customDateSelected ? styles.active : ''}`}
          onClick={() => handleTabClick('all', false)}
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
          const isActive = !dateRange && selectedDay === ds && !customDateSelected
          return (
            <div
              key={ds}
              className={`${styles.tab} ${isActive ? styles.active : ''}`}
              onClick={() => handleTabClick(ds, false)}
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
            className={`${styles.browseBtn} ${customDateSelected && !dateRange ? styles.browseBtnActive : ''}`}
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
                onSelect={(ds) => { handleTabClick(ds, true); setShowCal(false) }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Date range bar ── */}
      <div className={styles.rangeBar}>
        <span className={styles.rangeLabel}>Date range</span>
        <input
          type="date"
          className={`${styles.rangeInput} ${dateRange ? styles.rangeInputActive : ''}`}
          value={rangeStart}
          onChange={e => setRangeStart(e.target.value)}
        />
        <span className={styles.rangeArrow}>→</span>
        <input
          type="date"
          className={`${styles.rangeInput} ${dateRange ? styles.rangeInputActive : ''}`}
          value={rangeEnd}
          onChange={e => setRangeEnd(e.target.value)}
        />
        {!dateRange
          ? <button className={styles.rangeApply} onClick={handleApplyRange}>Apply</button>
          : <button className={styles.rangeClear} onClick={handleClearRange}>✕ Clear</button>
        }
        {rangeErr && <span className={styles.rangeErr}>{rangeErr}</span>}
        {dateRange && <span className={styles.rangeActive}>
          Showing {orders.filter(o => o.pickupDate >= dateRange.start && o.pickupDate <= dateRange.end).length} orders
        </span>}
      </div>
    </div>
  )
}
