import { useState } from 'react'
import { toDS, today } from '../utils/helpers'
import styles from './CalendarPopup.module.css'

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function CalendarPopup({
  selectedDate, onSelect, allowPast = false, orderDates = null,
  // Range mode
  rangeMode    = false,
  initStart    = '',
  initEnd      = '',
  onRangeApply = null,
}) {
  const initDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00')
    : initStart
      ? new Date(initStart + 'T00:00:00')
      : new Date(today)

  const [year, setYear]         = useState(initDate.getFullYear())
  const [month, setMonth]       = useState(initDate.getMonth())
  const [startVal, setStartVal] = useState(initStart || '')
  const [endVal, setEndVal]     = useState(initEnd   || '')
  const [step, setStep]         = useState('start') // 'start' | 'end'

  const navigate = (dir) => {
    let m = month + dir, y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    setMonth(m); setYear(y)
  }

  const monthName   = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayDS     = toDS(today)

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d)
    dt.setHours(0, 0, 0, 0)
    cells.push(dt)
  }

  const handleCell = (ds, isPast) => {
    if (isPast) return
    if (!rangeMode) { onSelect(ds); return }
    if (step === 'start') {
      setStartVal(ds); setEndVal(''); setStep('end')
    } else {
      if (ds >= startVal) {
        setEndVal(ds)
      } else {
        setEndVal(startVal); setStartVal(ds)
      }
      setStep('start')
    }
  }

  const canApply = startVal && endVal && startVal <= endVal

  return (
    <div className={styles.popup}>

      {rangeMode && (
        <div className={styles.rangeHeader}>
          <input
            type="date"
            className={`${styles.rangeInput} ${step === 'start' ? styles.rangeInputActive : ''}`}
            value={startVal}
            onChange={e => { setStartVal(e.target.value); setStep('end') }}
          />
          <span className={styles.rangeArrow}>→</span>
          <input
            type="date"
            className={`${styles.rangeInput} ${step === 'end' ? styles.rangeInputActive : ''}`}
            value={endVal}
            onChange={e => setEndVal(e.target.value)}
          />
          <button
            className={styles.applyBtn}
            disabled={!canApply}
            onClick={() => canApply && onRangeApply({ start: startVal, end: endVal })}
          >
            Apply
          </button>
        </div>
      )}

      <div className={styles.nav}>
        <button className={styles.navBtn} onClick={() => navigate(-1)}>‹</button>
        <span className={styles.monthLabel}>{monthName}</span>
        <button className={styles.navBtn} onClick={() => navigate(1)}>›</button>
      </div>

      <div className={styles.grid}>
        {DAYS.map((d, i) => <div key={i} className={styles.dow}>{d}</div>)}
        {cells.map((dt, i) => {
          if (!dt) return <div key={`e${i}`} />
          const ds      = toDS(dt)
          const isPast  = !allowPast && dt < today && ds !== todayDS
          const isToday = ds === todayDS
          const isSel   = !rangeMode && ds === selectedDate
          const isStart = rangeMode && ds === startVal
          const isEnd   = rangeMode && ds === endVal
          const inRange = rangeMode && startVal && endVal && ds > startVal && ds < endVal
          const hasOrd  = orderDates?.has(ds)

          let cls = styles.cell
          if (isPast)                    cls += ` ${styles.past}`
          if (isToday)                   cls += ` ${styles.todayCell}`
          if (isSel || isStart || isEnd) cls += ` ${styles.selected}`
          if (inRange)                   cls += ` ${styles.inRange}`
          if (hasOrd)                    cls += ` ${styles.hasOrders}`

          return (
            <div key={ds} className={cls} onClick={() => handleCell(ds, isPast)}>
              {dt.getDate()}
            </div>
          )
        })}
      </div>

      {rangeMode && (
        <div className={styles.rangeHint}>
          {!startVal
            ? 'Click a start date on the calendar'
            : step === 'end'
              ? 'Now click an end date'
              : canApply ? 'Ready — hit Apply or pick new dates' : ''}
        </div>
      )}
    </div>
  )
}
