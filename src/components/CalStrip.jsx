import { useState, useRef, useEffect } from 'react'
import { toDS, today, daysFromNow, diffDays, fmtDate, STRIP_DAYS } from '../utils/helpers'
import CalendarPopup from './CalendarPopup'
import styles from './CalStrip.module.css'

const fmtRangeDate = (ds) => {
  if (!ds) return ''
  const d = new Date(ds + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CalStrip({ orders, selectedDay, customDateSelected, dateRange, onSelectDay, onRangeSelect }) {
  const [startVal, setStartVal] = useState('')
  const [endVal, setEndVal]     = useState('')
  const [err, setErr]           = useState('')
  const [showCal, setShowCal]   = useState(false)
  const calRef = useRef(null)

  useEffect(() => {
    if (!dateRange) { setStartVal(''); setEndVal(''); setErr('') }
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

  const handleApply = () => {
    setErr('')
    if (!startVal || !endVal) { setErr('Enter both dates'); return }
    if (startVal > endVal)    { setErr('Start must be before end'); return }
    onRangeSelect({ start: startVal, end: endVal })
  }

  const handleClear = () => {
    setStartVal(''); setEndVal(''); setErr('')
    onRangeSelect(null)
    onSelectDay('all', false)
  }

  const handleCalSelect = (ds) => {
    setShowCal(false)
    if (dateRange) handleClear()
    onSelectDay(ds, true)
  }

  const handleTabClick = (ds, isCustom) => {
    if (dateRange) handleClear()
    onSelectDay(ds, isCustom)
  }

  const bothFilled = startVal && endVal

  return (
    <div className={styles.strip}>
      {/* ── Day tabs ── */}
      <div className={`${styles.tabs} ${dateRange ? styles.tabsDimmed : ''}`}>
        <div
          className={`${styles.tab} ${styles.allTab} ${!dateRange && selectedDay === 'all' && !customDateSelected ? styles.active : ''}`}
          onClick={() => handleTabClick('all', false)}
        >
          <div className={styles.tabLabel}>All</div>
          <div className={styles.tabDate}>All</div>
          <div className={styles.tabCount}>{inWindowCount}</div>
        </div>

        <div className={styles.divider} />

        {Array.from({ length: STRIP_DAYS }, (_, i) => {
          const d   = daysFromNow(i)
          const ds  = toDS(d)
          const n   = orders.filter(o => o.pickupDate === ds).length
          const lbl = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })
          const isActive = !dateRange && selectedDay === ds && !customDateSelected
          return (
            <div key={ds} className={`${styles.tab} ${isActive ? styles.active : ''}`} onClick={() => handleTabClick(ds, false)}>
              <div className={styles.tabLabel}>{lbl}</div>
              <div className={styles.tabDate}>{d.getDate()}</div>
              <div className={styles.tabCount}>{n}</div>
            </div>
          )
        })}
      </div>

      {/* ── Range section ── */}
      <div className={`${styles.rangeSection} ${dateRange ? styles.rangeSectionActive : ''}`}>
        <span className={styles.rangeLabel}>Range</span>

        {dateRange ? (
          <>
            <span className={styles.activeRangeText}>
              {fmtRangeDate(dateRange.start)} – {fmtRangeDate(dateRange.end)}
            </span>
            <button className={styles.clearBtn} onClick={handleClear} title="Clear range">✕</button>
          </>
        ) : (
          <>
            <div className={styles.dateWrap}>
              <input
                type="date"
                className={`${styles.dateInput} ${startVal ? styles.dateInputFilled : ''}`}
                value={startVal}
                onChange={e => { setStartVal(e.target.value); setErr('') }}
              />
              {!startVal && <div className={styles.datePlaceholder}>Start date</div>}
            </div>
            <span className={styles.rangeArrow}>→</span>
            <div className={styles.dateWrap}>
              <input
                type="date"
                className={`${styles.dateInput} ${endVal ? styles.dateInputFilled : ''}`}
                value={endVal}
                onChange={e => { setEndVal(e.target.value); setErr('') }}
              />
              {!endVal && <div className={styles.datePlaceholder}>End date</div>}
            </div>
            {bothFilled && (
              <button className={styles.applyBtn} onClick={handleApply}>Apply</button>
            )}
            {err && <span className={styles.rangeErr}>{err}</span>}
          </>
        )}
      </div>
      {/* ── Browse button ── */}
      <div className={styles.browseWrap} ref={calRef}>
        <button
          className={`${styles.browseBtn} ${customDateSelected && !dateRange ? styles.browseBtnActive : ''}`}
          onClick={() => setShowCal(v => !v)}
          title="Browse calendar"
        >
          📅
          {customDateSelected && !dateRange && <span className={styles.browseDateLabel}>{fmtRangeDate(selectedDay)}</span>}
        </button>
        {showCal && (
          <div className={styles.calWrap}>
            <CalendarPopup
              selectedDate={customDateSelected && !dateRange ? selectedDay : null}
              allowPast={true}
              orderDates={new Set(orders.map(o => o.pickupDate))}
              onSelect={handleCalSelect}
            />
          </div>
        )}
      </div>
    </div>
  )
}
