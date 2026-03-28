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


export default function CalStrip({ orders, selectedDay, customDateSelected, dateRange, onSelectDay, onRangeSelect, selectedStage, onStageChange }) {
  const [startVal, setStartVal]   = useState('')
  const [endVal, setEndVal]       = useState('')
  const [showCal, setShowCal]     = useState(false)
  const [stageOpen, setStageOpen] = useState(false)
  const [dateOpen, setDateOpen]   = useState(false)
  const calRef   = useRef(null)
  const stageRef = useRef(null)
  const dateRef  = useRef(null)

  useEffect(() => {
    if (!dateRange) { setStartVal(''); setEndVal('') }
  }, [dateRange])

  useEffect(() => {
    const handler = (e) => {
      if (calRef.current && !calRef.current.contains(e.target)) setShowCal(false)
      if (stageRef.current && !stageRef.current.contains(e.target)) setStageOpen(false)
      if (dateRef.current && !dateRef.current.contains(e.target)) setDateOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const today    = todayDS()
  const tomorrow = offsetDS(1)
  const d7end    = offsetDS(7)
  const d30end   = offsetDS(30)

  const activeOrders = orders.filter(o => o.stage !== 'picked-up')
  const stageCounts = {
    active:          activeOrders.length,
    received:        orders.filter(o => o.stage === 'received').length,
    'in-production': orders.filter(o => o.stage === 'in-production').length,
    ready:           orders.filter(o => o.stage === 'ready').length,
    'picked-up':     orders.filter(o => o.stage === 'picked-up').length,
  }

  const stageFiltered = selectedStage === 'active'
    ? activeOrders
    : orders.filter(o => o.stage === selectedStage)

  const countAll      = stageFiltered.length
  const countToday    = stageFiltered.filter(o => o.pickupDate === today).length
  const countTomorrow = stageFiltered.filter(o => o.pickupDate === tomorrow).length
  const count7d       = stageFiltered.filter(o => o.pickupDate >= today && o.pickupDate <= d7end).length
  const count30d      = stageFiltered.filter(o => o.pickupDate >= today && o.pickupDate <= d30end).length

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

  const PRESETS = [
    { id: 'all',      label: 'All orders',    count: countAll },
    { id: 'today',    label: 'Today',         count: countToday },
    { id: 'tomorrow', label: 'Tomorrow',      count: countTomorrow },
    { id: '7d',       label: 'Next 7 days',   count: count7d },
    { id: '30d',      label: 'Next 30 days',  count: count30d },
  ]

  const activePresetLabel = PRESETS.find(p => p.id === activePreset)?.label
    || (dateRange ? `${fmtShort(dateRange.start)} – ${fmtShort(dateRange.end)}` : fmtShort(selectedDay))

  const activeCount = PRESETS.find(p => p.id === activePreset)?.count ?? stageFiltered.length

  const handlePreset = (preset) => {
    onRangeSelect(null)
    if (preset === 'all')      onSelectDay('all', false)
    if (preset === 'today')    onSelectDay(today, false)
    if (preset === 'tomorrow') onSelectDay(tomorrow, false)
    if (preset === '7d')       onRangeSelect({ start: today, end: d7end })
    if (preset === '30d')      onRangeSelect({ start: today, end: d30end })
    setDateOpen(false)
  }

  const handleCalSelect = (ds) => {
    setShowCal(false)
    onRangeSelect(null)
    onSelectDay(ds, true)
  }

  const stageLabels = {
    active:          'Active',
    received:        'Received',
    'in-production': 'In Production',
    ready:           'Ready for Pickup',
    'picked-up':     'Picked Up',
  }

  return (
    <div className={styles.strip}>

      {/* Date dropdown */}
      <div className={styles.stageWrap} ref={dateRef}>
        <button
          className={`${styles.stageBtn} ${styles.dateBtn}`}
          onClick={() => setDateOpen(v => !v)}
        >
          {activePresetLabel}
          <span className={styles.dateCnt}>{activeCount}</span>
          <svg width="8" height="8" viewBox="0 0 10 6" fill="currentColor"><path d="M0 0l5 6 5-6z"/></svg>
        </button>
        {dateOpen && (
          <div className={styles.stageDrop}>
            {PRESETS.map(p => (
              <button
                key={p.id}
                className={`${styles.stageItem} ${activePreset === p.id ? styles.stageItemActive : ''}`}
                onClick={() => handlePreset(p.id)}
              >
                <span>{p.label}</span>
                <span className={styles.stageCnt + ' ' + styles.stageCnt_active}>{p.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stage dropdown */}
      <div className={styles.stageWrap} ref={stageRef}>
        <button
          className={`${styles.stageBtn} ${selectedStage !== 'active' ? styles.stageBtnActive : ''}`}
          onClick={() => setStageOpen(v => !v)}
        >
          Stage: {stageLabels[selectedStage]}
          <svg width="8" height="8" viewBox="0 0 10 6" fill="currentColor"><path d="M0 0l5 6 5-6z"/></svg>
        </button>
        {stageOpen && (
          <div className={styles.stageDrop}>
            {Object.entries(stageLabels).map(([id, label]) => (
              <button
                key={id}
                className={`${styles.stageItem} ${selectedStage === id ? styles.stageItemActive : ''}`}
                onClick={() => { onStageChange(id); setStageOpen(false) }}
              >
                <span>{label}</span>
                <span className={`${styles.stageCnt} ${styles['stageCnt_' + id.replace(/-/g,'_')]}`}>
                  {stageCounts[id] ?? 0}
                </span>
              </button>
            ))}</div>
        )}
      </div>

      {/* Custom date range */}
      <div className={styles.rangeRow}>
        <input type="date" className={styles.dateInput} value={startVal} onChange={e => setStartVal(e.target.value)} />
        <span className={styles.rangeArrow}>→</span>
        <input type="date" className={styles.dateInput} value={endVal} onChange={e => setEndVal(e.target.value)} />
        {startVal && endVal && startVal <= endVal && (
          <button className={styles.applyBtn} onClick={() => { onRangeSelect({ start: startVal, end: endVal }) }}>Apply</button>
        )}
        {dateRange && (
          <button className={styles.clearBtn} onClick={() => { setStartVal(''); setEndVal(''); onRangeSelect(null); onSelectDay('all', false) }}>✕</button>
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
