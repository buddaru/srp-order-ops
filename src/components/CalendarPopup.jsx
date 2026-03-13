import { useState } from 'react'
import { toDS, today } from '../utils/helpers'
import styles from './CalendarPopup.module.css'

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function CalendarPopup({ selectedDate, rangeStart, onSelect, allowPast = false, orderDates = null }) {
  const initDate = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date(today)
  const [year, setYear]   = useState(initDate.getFullYear())
  const [month, setMonth] = useState(initDate.getMonth())
  const [hoverDate, setHoverDate] = useState(null)

  const navigate = (dir) => {
    let m = month + dir, y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0)  { m = 11; y-- }
    setMonth(m); setYear(y)
  }

  const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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

  // Compute preview range end (hover or selected)
  const previewEnd = rangeStart ? (hoverDate || selectedDate) : null

  const getRangeState = (ds) => {
    if (!rangeStart || !previewEnd) return null
    const start = rangeStart < previewEnd ? rangeStart : previewEnd
    const end   = rangeStart < previewEnd ? previewEnd : rangeStart
    if (ds === start) return 'start'
    if (ds === end)   return 'end'
    if (ds > start && ds < end) return 'mid'
    return null
  }

  const hintLabel = rangeStart ? (() => {
    const d = new Date(rangeStart + 'T00:00:00')
    return `Start: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · Click any date to set end`
  })() : null

  return (
    <div className={styles.popup}>
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
          const isSel   = ds === selectedDate && !rangeStart
          const hasOrd  = orderDates?.has(ds)
          const rstate  = getRangeState(ds)

          let cls = styles.cell
          if (isPast)              cls += ` ${styles.past}`
          if (isToday && !rstate)  cls += ` ${styles.todayCell}`
          if (isSel)               cls += ` ${styles.selected}`
          if (hasOrd)              cls += ` ${styles.hasOrders}`
          if (rstate === 'start')  cls += ` ${styles.rangeStart}`
          if (rstate === 'mid')    cls += ` ${styles.rangeMid}`
          if (rstate === 'end')    cls += ` ${styles.rangeEnd}`

          return (
            <div
              key={ds}
              className={cls}
              onMouseEnter={() => rangeStart && setHoverDate(ds)}
              onMouseLeave={() => rangeStart && setHoverDate(null)}
              onClick={() => !isPast && onSelect(ds)}
            >
              {dt.getDate()}
            </div>
          )
        })}
      </div>
      {hintLabel && <div className={styles.hint}>{hintLabel}</div>}
    </div>
  )
}
