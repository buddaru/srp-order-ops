import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import styles from './Schedule.module.css'

const ROLES = ['Baker', 'Decorator', 'Cashier', 'Lead']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const ROLE_COLORS = {
  Baker:     { bg: '#FEF3C7', text: '#92400E', dot: '#D97706' },
  Decorator: { bg: '#EDE9FE', text: '#5B21B6', dot: '#7C3AED' },
  Cashier:   { bg: '#DCFCE7', text: '#166534', dot: '#16A34A' },
  Lead:      { bg: '#DBEAFE', text: '#1E40AF', dot: '#2563EB' },
}

const toDS = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const parseDS = ds => new Date(ds + 'T00:00:00')

function getWeekStart(date) {
  const d = new Date(date); d.setHours(0,0,0,0)
  d.setDate(d.getDate() - d.getDay())
  return d
}
function getWeekDays(weekStart) {
  return Array.from({length:7}, (_,i) => { const d = new Date(weekStart); d.setDate(d.getDate()+i); return d })
}
function fmtWeek(ws) {
  const we = new Date(ws); we.setDate(we.getDate()+6)
  return `${ws.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${we.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`
}
function fmt12(t) {
  if (!t) return ''
  const [h,m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h%12||12}:${String(m).padStart(2,'0')} ${ampm}`
}

// ── Shift Modal ──
function ShiftModal({ shift, weekDays, onSave, onClose }) {
  const isEdit = !!shift?.id
  const [employeeName, setEmployeeName] = useState(shift?.employee_name || '')
  const [employeeEmail, setEmployeeEmail] = useState(shift?.employee_email || '')
  const [date, setDate] = useState(shift?.shift_date || toDS(weekDays[0]))
  const [startTime, setStartTime] = useState(shift?.start_time || '09:00')
  const [endTime, setEndTime] = useState(shift?.end_time || '17:00')
  const [role, setRole] = useState(shift?.role || 'Baker')
  const [notes, setNotes] = useState(shift?.notes || '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!employeeName.trim()) e.name = true
    if (!date) e.date = true
    if (!startTime) e.start = true
    if (!endTime) e.end = true
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const row = { employee_name: employeeName.trim(), employee_email: employeeEmail.trim(), shift_date: date, start_time: startTime, end_time: endTime, role, notes: notes.trim() }
    if (isEdit) {
      await supabase.from('shifts').update(row).eq('id', shift.id)
    } else {
      await supabase.from('shifts').insert([row])
    }
    onSave()
  }

  return (
    <div className={styles.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{isEdit ? 'Edit shift' : 'Add shift'}</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Employee name</label>
            <input className={`${styles.finput} ${errors.name?styles.invalid:''}`} value={employeeName} onChange={e=>{setEmployeeName(e.target.value);setErrors(v=>({...v,name:false}))}} placeholder="Jane Smith" autoFocus />
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Employee email (for shift notifications)</label>
            <input className={styles.finput} type="email" value={employeeEmail} onChange={e=>setEmployeeEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Date</label>
            <select className={`${styles.finput} ${errors.date?styles.invalid:''}`} value={date} onChange={e=>{setDate(e.target.value);setErrors(v=>({...v,date:false}))}}>
              {weekDays.map(d => (
                <option key={toDS(d)} value={toDS(d)}>{d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</option>
              ))}
            </select>
          </div>
          <div className={styles.formRow2}>
            <div>
              <label className={styles.flabel}>Start time</label>
              <input className={`${styles.finput} ${errors.start?styles.invalid:''}`} type="time" value={startTime} onChange={e=>{setStartTime(e.target.value);setErrors(v=>({...v,start:false}))}} />
            </div>
            <div>
              <label className={styles.flabel}>End time</label>
              <input className={`${styles.finput} ${errors.end?styles.invalid:''}`} type="time" value={endTime} onChange={e=>{setEndTime(e.target.value);setErrors(v=>({...v,end:false}))}} />
            </div>
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Role</label>
            <div className={styles.roleGrid}>
              {ROLES.map(r => (
                <button key={r} className={`${styles.roleChip} ${role===r?styles.roleChipSel:''}`}
                  style={role===r ? {background:ROLE_COLORS[r].bg, color:ROLE_COLORS[r].text, borderColor:ROLE_COLORS[r].dot} : {}}
                  onClick={()=>setRole(r)}>{r}</button>
              ))}
            </div>
          </div>
          <div className={styles.formRow} style={{marginBottom:0}}>
            <label className={styles.flabel}>Notes (optional)</label>
            <textarea className={styles.finput} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any special instructions…" style={{height:52,resize:'none'}} />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save shift'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Email confirm modal ──
function EmailModal({ employee, weekLabel, shifts, onClose }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/send-schedule', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ employee, weekLabel, shifts })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send')
      setSent(true)
    } catch(err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div className={styles.modal} style={{maxWidth:400}}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{sent ? 'Schedule sent!' : 'Send schedule'}</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          {sent ? (
            <div className={styles.sentMsg}>
              <div className={styles.sentIcon}>✓</div>
              <div>Schedule sent to <strong>{employee.name}</strong> at <strong>{employee.email}</strong></div>
            </div>
          ) : (
            <>
              <div className={styles.emailPreview}>
                <div className={styles.epRow}><span>To</span><strong>{employee.name}</strong></div>
                <div className={styles.epRow}><span>Email</span><strong>{employee.email}</strong></div>
                <div className={styles.epRow}><span>Week</span><strong>{weekLabel}</strong></div>
                <div className={styles.epRow}><span>Shifts</span><strong>{shifts.length} shift{shifts.length!==1?'s':''}</strong></div>
              </div>
              <div className={styles.shiftPreviewList}>
                {shifts.map(s => (
                  <div key={s.id} className={styles.shiftPreviewRow}>
                    <span className={styles.shiftPreviewDot} style={{background:ROLE_COLORS[s.role]?.dot||'#ccc'}} />
                    <span>{parseDS(s.shift_date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span>
                    <span>{fmt12(s.start_time)} – {fmt12(s.end_time)}</span>
                    <span className={styles.shiftPreviewRole} style={{background:ROLE_COLORS[s.role]?.bg, color:ROLE_COLORS[s.role]?.text}}>{s.role}</span>
                  </div>
                ))}
              </div>
              {error && <div className={styles.errorMsg}>{error}</div>}
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          {sent
            ? <button className={styles.saveBtn} style={{gridColumn:'1/-1'}} onClick={onClose}>Done</button>
            : <>
                <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                <button className={styles.saveBtn} onClick={handleSend} disabled={sending}>{sending?'Sending…':'Send schedule'}</button>
              </>
          }
        </div>
      </div>
    </div>
  )
}

// ── Main ──
export default function Schedule() {
  const { isAdmin } = useAuth()
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [view, setView] = useState('calendar') // calendar | list
  const [showModal, setShowModal] = useState(false)
  const [editShift, setEditShift] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [emailEmployee, setEmailEmployee] = useState(null)
  const [copyingWeek, setCopyingWeek] = useState(false)
  const [toast, setToast] = useState('')

  const weekDays = getWeekDays(weekStart)
  const weekEnd = weekDays[6]

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('shifts').select('*').order('shift_date').order('start_time')
    setShifts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const weekShifts = useMemo(() => {
    const ws = toDS(weekStart), we = toDS(weekEnd)
    return shifts.filter(s => s.shift_date >= ws && s.shift_date <= we)
  }, [shifts, weekStart])

  const handleSave = () => { setShowModal(false); setEditShift(null); load() }

  const handleDelete = async () => {
    await supabase.from('shifts').delete().eq('id', deleteId)
    setDeleteId(null)
    load()
  }

  const handleCopyLastWeek = async () => {
    const prevStart = new Date(weekStart); prevStart.setDate(prevStart.getDate()-7)
    const prevEnd = new Date(prevStart); prevEnd.setDate(prevEnd.getDate()+6)
    const ps = toDS(prevStart), pe = toDS(prevEnd)
    const prevShifts = shifts.filter(s => s.shift_date >= ps && s.shift_date <= pe)
    if (!prevShifts.length) { setToast('No shifts found for last week'); setTimeout(()=>setToast(''),3000); return }
    setCopyingWeek(true)
    const newShifts = prevShifts.map(s => {
      const d = parseDS(s.shift_date); d.setDate(d.getDate()+7)
      return { employee_name:s.employee_name, employee_email:s.employee_email, shift_date:toDS(d), start_time:s.start_time, end_time:s.end_time, role:s.role, notes:s.notes }
    })
    await supabase.from('shifts').insert(newShifts)
    setCopyingWeek(false)
    setToast(`Copied ${newShifts.length} shifts from last week`)
    setTimeout(()=>setToast(''),3000)
    load()
  }

  // Get unique employees with shifts this week
  const weekEmployees = useMemo(() => {
    const map = {}
    weekShifts.forEach(s => {
      if (!map[s.employee_name]) map[s.employee_name] = { name:s.employee_name, email:s.employee_email, shifts:[] }
      map[s.employee_name].shifts.push(s)
    })
    return Object.values(map).sort((a,b)=>a.name.localeCompare(b.name))
  }, [weekShifts])

  const todayDS = toDS(new Date())

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.topbar}>
        <div className={styles.pageTitle}>Schedule</div>
        <div className={styles.topbarRight}>
          {isAdmin && (
            <>
              <button className={styles.copyBtn} onClick={handleCopyLastWeek} disabled={copyingWeek}>
                {copyingWeek ? 'Copying…' : '↩ Copy last week'}
              </button>
              <button className={styles.addBtn} onClick={()=>{setEditShift(null);setShowModal(true)}}>+ Add shift</button>
            </>
          )}
        </div>
      </div>

      {/* Week nav */}
      <div className={styles.weekNav}>
        <div className={styles.weekNavLeft}>
          <button className={styles.weekArrow} onClick={()=>{const d=new Date(weekStart);d.setDate(d.getDate()-7);setWeekStart(d)}}>‹</button>
          <div className={styles.weekLabel}>{fmtWeek(weekStart)}</div>
          <button className={styles.weekArrow} onClick={()=>{const d=new Date(weekStart);d.setDate(d.getDate()+7);setWeekStart(d)}}>›</button>
          <button className={styles.todayBtn} onClick={()=>setWeekStart(getWeekStart(new Date()))}>Today</button>
        </div>
        <div className={styles.viewToggle}>
          <button className={`${styles.vtBtn} ${view==='calendar'?styles.vtActive:''}`} onClick={()=>setView('calendar')}>⊞ Calendar</button>
          <div className={styles.vtDivider}/>
          <button className={`${styles.vtBtn} ${view==='list'?styles.vtActive:''}`} onClick={()=>setView('list')}>☰ List</button>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : view === 'calendar' ? (
        /* ── Calendar view ── */
        <div className={styles.calendarWrap}>
          <div className={styles.calGrid}>
            {weekDays.map(day => {
              const ds = toDS(day)
              const dayShifts = weekShifts.filter(s => s.shift_date === ds)
              const isToday = ds === todayDS
              return (
                <div key={ds} className={`${styles.calDay} ${isToday?styles.calDayToday:''}`}>
                  <div className={styles.calDayHeader}>
                    <div className={styles.calDayName}>{DAYS[day.getDay()]}</div>
                    <div className={`${styles.calDayNum} ${isToday?styles.calDayNumToday:''}`}>{day.getDate()}</div>
                    {isAdmin && <button className={styles.calAddBtn} onClick={()=>{setEditShift({shift_date:ds});setShowModal(true)}}>+</button>}
                  </div>
                  <div className={styles.calDayShifts}>
                    {dayShifts.length === 0
                      ? <div className={styles.calEmpty}>—</div>
                      : dayShifts.map(s => (
                        <div key={s.id} className={styles.calShift}
                          style={{background:ROLE_COLORS[s.role]?.bg, borderLeft:`3px solid ${ROLE_COLORS[s.role]?.dot}`}}
                          onClick={()=>isAdmin&&(setEditShift(s),setShowModal(true))}
                        >
                          <div className={styles.calShiftName}>{s.employee_name}</div>
                          <div className={styles.calShiftTime}>{fmt12(s.start_time)} – {fmt12(s.end_time)}</div>
                          <div className={styles.calShiftRole} style={{color:ROLE_COLORS[s.role]?.text}}>{s.role}</div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* ── List view ── */
        <div className={styles.listWrap}>
          {weekShifts.length === 0 ? (
            <div className={styles.empty}>No shifts scheduled for this week.</div>
          ) : (
            <div className={styles.listTable}>
              <div className={styles.listHeader}>
                <div>Employee</div><div>Day</div><div>Time</div><div>Role</div><div></div>
              </div>
              {weekShifts.map(s => (
                <div key={s.id} className={styles.listRow}>
                  <div className={styles.listName}>
                    <div className={styles.listAvatar}>{s.employee_name.slice(0,2).toUpperCase()}</div>
                    <div>
                      <div className={styles.listNameText}>{s.employee_name}</div>
                      {s.notes && <div className={styles.listNotes}>{s.notes}</div>}
                    </div>
                  </div>
                  <div className={styles.listDay}>{parseDS(s.shift_date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
                  <div className={styles.listTime}>{fmt12(s.start_time)} – {fmt12(s.end_time)}</div>
                  <div><span className={styles.rolePill} style={{background:ROLE_COLORS[s.role]?.bg, color:ROLE_COLORS[s.role]?.text}}>{s.role}</span></div>
                  {isAdmin && (
                    <div className={styles.listActions}>
                      <button className={styles.ea} onClick={()=>{setEditShift(s);setShowModal(true)}}>Edit</button>
                      <button className={`${styles.ea} ${styles.eaDel}`} onClick={()=>setDeleteId(s.id)}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Employee panel — send schedules */}
      {isAdmin && weekEmployees.length > 0 && (
        <div className={styles.employeePanel}>
          <div className={styles.employeePanelTitle}>Send schedules — {fmtWeek(weekStart)}</div>
          <div className={styles.employeeList}>
            {weekEmployees.map(emp => (
              <div key={emp.name} className={styles.employeeRow}>
                <div className={styles.empAvatar}>{emp.name.slice(0,2).toUpperCase()}</div>
                <div className={styles.empInfo}>
                  <div className={styles.empName}>{emp.name}</div>
                  <div className={styles.empShiftCount}>{emp.shifts.length} shift{emp.shifts.length!==1?'s':''} this week</div>
                </div>
                <button
                  className={`${styles.sendBtn} ${!emp.email?styles.sendBtnDisabled:''}`}
                  onClick={()=>emp.email&&setEmailEmployee(emp)}
                  title={!emp.email?'No email on file — edit a shift to add one':''}
                >
                  {emp.email ? '✉ Send schedule' : 'No email'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && <ShiftModal shift={editShift} weekDays={weekDays} onSave={handleSave} onClose={()=>{setShowModal(false);setEditShift(null)}} />}
      {emailEmployee && <EmailModal employee={emailEmployee} weekLabel={fmtWeek(weekStart)} shifts={emailEmployee.shifts} onClose={()=>setEmailEmployee(null)} />}

      {deleteId && (
        <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&setDeleteId(null)}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmTitle}>Delete shift?</div>
            <div className={styles.confirmMsg}>This shift will be permanently removed.</div>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={()=>setDeleteId(null)}>Cancel</button>
              <button className={styles.deleteBtn} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
