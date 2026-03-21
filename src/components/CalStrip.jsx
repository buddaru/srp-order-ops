import { useState, useRef, useEffect } from 'react'
import { toDS } from '../utils/helpers'
import CalendarPopup from './CalendarPopup'
import styles from './CalStrip.module.css'

const todayDS = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const offsetDS = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const fmtShort = (ds) => {
  if (!ds) return ''
  const d = new Date(ds + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CalStrip({ orders, selectedDay, customDateSelected, dateRange, onSelectDay, onRangeSelect }) {
  const [startVal, setStartVal] = useState('')
  const [endVal, setEndVal]     = useState('')
  const [showCal, setShowCal]   = useState(false)
  const calRef = useRef(null)

  useEffect(() => {
    if (!dateRange) { setStartVal(''); setEndVal('') }
  }, [dateRange])

  useEffect(() => {
    const handler = (e) => {
      if (calRef.current && !calRef.current.contains(e.target)) setShowCal(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const today    = todayDS()
  const tomorrow = offsetDS(1)
  const d7end    = offsetDS(7)
  const d30end   = offsetDS(30)

  // Order counts per preset
  const countAll      = orders.filter(o => o.stage !== 'picked-up').length
  const countToday    = orders.filter(o => o.pickupDate === today && o.stage !== 'picked-up').length
  const countTomorrow = orders.filter(o => o.pickupDate === tomorrow && o.stage !== 'picked-up').length
  const count7d       = orders.filter(o => o.pickupDate >= today && o.pickupDate <= d7end && o.stage !== 'picked-up').length
  const count30d      = orders.filter(o => o.pickupDate >= today && o.pickupDate <= d30end && o.stage !== 'picked-up').length

  const getActivePreset = () => {
    if (dateRange) {
      if (dateRange.start === today && dateRange.end === d7end) return '7d'
      if (dateRange.start === today && dateRange.end === d30end) return '30d'
      return 'custom'
    }
    if (selectedDay === 'all' && !customDateSelected) return 'all'
    if (selectedDay === today && !customDateSelected) return 'today'
    if (selectedDay === tomorrow && !customDateSelected) return 'tomorrow'
    return 'custom'
  }
  const activePreset = getActivePreset()

  const handlePreset = (preset) => {
    onRangeSelect(null)
    if (preset === 'all')      { onSelectDay('all', false) }
    if (preset === 'today')    { onSelectDay(today, false) }
    if (preset === 'tomorrow') { onSelectDay(tomorrow, false) }
    if (preset === '7d')       { onRangeSelect({ start: today, end: d7end }) }
    if (preset === '30d')      { onRangeSelect({ start: today, end: d30end }) }
  }

  const handleApply = () => {
    if (!startVal || !endVal || startVal > endVal) return
    onRangeSelect({ start: startVal, end: endVal })
  }

  const handleClear = () => {
    setStartVal(''); setEndVal('')
    onRangeSelect(null)
    onSelectDay('all', false)
  }

  const handleCalSelect = (ds) => {
    setShowCal(false)
    onRangeSelect(null)
    onSelectDay(ds, true)
  }

  const PRESETS = [
    { id: 'all',      label: 'All',      count: countAll },
    { id: 'today',    label: 'Today',    count: countToday },
    { id: 'tomorrow', label: 'Tomorrow', count: countTomorrow },
    { id: '7d',       label: '7 Days',   count: count7d },
    { id: '30d',      label: '30 Days',  count: count30d },
  ]

  return (
    <div className={styles.strip}>
      {/* Preset pills */}
      <div className={styles.presets}>
        {PRESETS.map(p => (
          <button
            key={p.id}
            className={`${styles.preset} ${activePreset === p.id ? styles.presetActive : ''}`}
            onClick={() => handlePreset(p.id)}
          >
            {p.label}
            <span className={`${styles.presetCount} ${activePreset === p.id ? styles.presetCountActive : ''}`}>{p.count}</span>
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      {/* Custom range */}
      <div className={styles.rangeRow}>
        {activePreset === 'custom' && dateRange ? (
          <>
            <span className={styles.activeRange}>{fmtShort(dateRange.start)} – {fmtShort(dateRange.end)}</span>
            <button className={styles.clearBtn} onClick={handleClear}>✕</button>
          </>
        ) : (
          <>
            <input type="date" className={styles.dateInput} value={startVal} onChange={e => setStartVal(e.target.value)} />
            <span className={styles.rangeArrow}>→</span>
            <input type="date" className={styles.dateInput} value={endVal} onChange={e => setEndVal(e.target.value)} />
            {startVal && endVal && startVal <= endVal && (
              <button className={styles.applyBtn} onClick={handleApply}>Apply</button>
            )}
          </>
        )}
      </div>

      {/* Calendar browse */}
      <div className={styles.browseWrap} ref={calRef}>
        <button
          className={`${styles.browseBtn} ${activePreset === 'custom' && !dateRange ? styles.browseBtnActive : ''}`}
          onClick={() => setShowCal(v => !v)}
          title="Pick a specific date"
        >
          📅
          {activePreset === 'custom' && !dateRange && <span className={styles.browseDateLabel}>{fmtShort(selectedDay)}</span>}
        </button>
        {showCal && (
          <div className={styles.calWrap}>
            <CalendarPopup
              selectedDate={activePreset === 'custom' && !dateRange ? selectedDay : null}
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
