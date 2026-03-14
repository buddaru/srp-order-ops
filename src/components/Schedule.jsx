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
  d.setDate(d.getDate() - d.getDay()); return d
}
function getWeekDays(ws) {
  return Array.from({length:7}, (_,i) => { const d=new Date(ws); d.setDate(d.getDate()+i); return d })
}
function fmtWeek(ws) {
  const we = new Date(ws); we.setDate(we.getDate()+6)
  return `${ws.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${we.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`
}
function fmt12(t) {
  if (!t) return ''
  const [h,m] = t.split(':').map(Number)
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`
}
function shiftHours(s) {
  if (!s.start_time || !s.end_time) return 0
  const [sh,sm] = s.start_time.split(':').map(Number)
  const [eh,em] = s.end_time.split(':').map(Number)
  return Math.max(0, (eh*60+em - sh*60-sm)/60)
}
function fmtHrs(h) {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

// ── Employee Modal ──
function EmployeeModal({ employee, onSave, onClose }) {
  const isEdit = !!employee?.id
  const [name, setName]   = useState(employee?.name || '')
  const [email, setEmail] = useState(employee?.email || '')
  const [role, setRole]   = useState(employee?.default_role || 'Baker')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setError('Name required'); return }
    setSaving(true)
    const row = { name: name.trim(), email: email.trim(), default_role: role }
    if (isEdit) {
      await supabase.from('employees').update(row).eq('id', employee.id)
    } else {
      await supabase.from('employees').insert([row])
    }
    onSave()
  }

  return (
    <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={styles.modal} style={{maxWidth:400}}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{isEdit ? 'Edit employee' : 'Add employee'}</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Full name</label>
            <input className={styles.finput} value={name} onChange={e=>{setName(e.target.value);setError('')}} placeholder="Jane Smith" autoFocus />
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Email (for schedule notifications)</label>
            <input className={styles.finput} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className={styles.formRow} style={{marginBottom:0}}>
            <label className={styles.flabel}>Default role</label>
            <div className={styles.roleGrid}>
              {ROLES.map(r => (
                <button key={r} className={`${styles.roleChip} ${role===r?styles.roleChipSel:''}`}
                  style={role===r?{background:ROLE_COLORS[r].bg,color:ROLE_COLORS[r].text,borderColor:ROLE_COLORS[r].dot}:{}}
                  onClick={()=>setRole(r)}>{r}</button>
              ))}
            </div>
          </div>
          {error && <div className={styles.errorMsg}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Shift Modal ──
function ShiftModal({ shift, employees, weekDays, onSave, onDelete, onClose }) {
  const isEdit = !!shift?.id
  const [empId, setEmpId]         = useState(shift?.employee_id || (employees[0]?.id || ''))
  const [date, setDate]           = useState(shift?.shift_date || toDS(weekDays[0]))
  const [startTime, setStartTime] = useState(shift?.start_time || '09:00')
  const [endTime, setEndTime]     = useState(shift?.end_time || '17:00')
  const [role, setRole]           = useState(shift?.role || employees[0]?.default_role || 'Baker')
  const [notes, setNotes]         = useState(shift?.notes || '')
  const [saving, setSaving]       = useState(false)
  const [errors, setErrors]       = useState({})
  const [confirmDel, setConfirmDel] = useState(false)

  const selectedEmp = employees.find(e => e.id === empId)

  // When employee changes, update role to their default
  const handleEmpChange = (id) => {
    setEmpId(id)
    const emp = employees.find(e => e.id === id)
    if (emp) setRole(emp.default_role || 'Baker')
  }

  const validate = () => {
    const e = {}
    if (!empId) e.emp = true
    if (!date) e.date = true
    if (!startTime) e.start = true
    if (!endTime) e.end = true
    return e
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const emp = employees.find(x => x.id === empId)
    const row = {
      employee_id: empId,
      employee_name: emp?.name || '',
      employee_email: emp?.email || '',
      shift_date: date,
      start_time: startTime,
      end_time: endTime,
      role, notes: notes.trim()
    }
    if (isEdit) {
      await supabase.from('shifts').update(row).eq('id', shift.id)
    } else {
      await supabase.from('shifts').insert([row])
    }
    onSave()
  }

  const handleDelete = async () => {
    await supabase.from('shifts').delete().eq('id', shift.id)
    onDelete()
  }

  if (confirmDel) return (
    <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&setConfirmDel(false)}>
      <div className={styles.confirmBox}>
        <div className={styles.confirmTitle}>Delete this shift?</div>
        <div className={styles.confirmMsg}>This shift for <strong>{selectedEmp?.name || shift?.employee_name}</strong> on {parseDS(date).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})} will be permanently removed.</div>
        <div className={styles.confirmActions}>
          <button className={styles.cancelBtn} onClick={()=>setConfirmDel(false)}>Cancel</button>
          <button className={styles.deleteBtn} onClick={handleDelete}>Delete shift</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{isEdit ? 'Edit shift' : 'Add shift'}</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          {employees.length === 0 ? (
            <div className={styles.noEmpMsg}>No employees yet. Add employees first using the Employees button.</div>
          ) : (
            <>
              <div className={styles.formRow}>
                <label className={styles.flabel}>Employee</label>
                <select className={`${styles.finput} ${errors.emp?styles.invalid:''}`} value={empId}
                  onChange={e=>{handleEmpChange(e.target.value);setErrors(v=>({...v,emp:false}))}}>
                  <option value="">Select employee…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className={styles.formRow}>
                <label className={styles.flabel}>Date</label>
                <select className={`${styles.finput} ${errors.date?styles.invalid:''}`} value={date}
                  onChange={e=>{setDate(e.target.value);setErrors(v=>({...v,date:false}))}}>
                  {weekDays.map(d => (
                    <option key={toDS(d)} value={toDS(d)}>{d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formRow2}>
                <div>
                  <label className={styles.flabel}>Start time</label>
                  <input className={`${styles.finput} ${errors.start?styles.invalid:''}`} type="time" value={startTime}
                    onChange={e=>{setStartTime(e.target.value);setErrors(v=>({...v,start:false}))}} />
                </div>
                <div>
                  <label className={styles.flabel}>End time</label>
                  <input className={`${styles.finput} ${errors.end?styles.invalid:''}`} type="time" value={endTime}
                    onChange={e=>{setEndTime(e.target.value);setErrors(v=>({...v,end:false}))}} />
                </div>
              </div>
              <div className={styles.formRow}>
                <label className={styles.flabel}>Role for this shift</label>
                <div className={styles.roleGrid}>
                  {ROLES.map(r => (
                    <button key={r} className={`${styles.roleChip} ${role===r?styles.roleChipSel:''}`}
                      style={role===r?{background:ROLE_COLORS[r].bg,color:ROLE_COLORS[r].text,borderColor:ROLE_COLORS[r].dot}:{}}
                      onClick={()=>setRole(r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div className={styles.formRow} style={{marginBottom:0}}>
                <label className={styles.flabel}>Notes (optional)</label>
                <textarea className={styles.finput} value={notes} onChange={e=>setNotes(e.target.value)}
                  placeholder="Any special instructions…" style={{height:52,resize:'none'}} />
              </div>
            </>
          )}
        </div>
        <div className={styles.modalFooter3}>
          {isEdit && <button className={styles.deleteBtn} style={{justifySelf:'start'}} onClick={()=>setConfirmDel(true)}>Delete shift</button>}
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving || employees.length===0}>{saving?'Saving…':'Save shift'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Email Modal ──
function EmailModal({ employee, weekLabel, shifts, onClose }) {
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const handleSend = async () => {
    setSending(true); setError('')
    try {
      const res = await fetch('/api/send-schedule', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ employee, weekLabel, shifts })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send')
      setSent(true)
    } catch(err) { setError(err.message); setSending(false) }
  }

  return (
    <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={styles.modal} style={{maxWidth:400}}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{sent?'Schedule sent!':'Send schedule'}</div>
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
                    <span className={styles.shiftPreviewRole} style={{background:ROLE_COLORS[s.role]?.bg,color:ROLE_COLORS[s.role]?.text}}>{s.role}</span>
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
            : <><button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
               <button className={styles.saveBtn} onClick={handleSend} disabled={sending}>{sending?'Sending…':'Send schedule'}</button></>
          }
        </div>
      </div>
    </div>
  )
}

// ── Main ──
export default function Schedule() {
  const { isAdmin } = useAuth()
  const [shifts, setShifts]         = useState([])
  const [employees, setEmployees]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [weekStart, setWeekStart]   = useState(() => getWeekStart(new Date()))
  const [view, setView]             = useState('calendar')
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [editShift, setEditShift]   = useState(null)
  const [showEmpPanel, setShowEmpPanel] = useState(false)
  const [editEmp, setEditEmp]       = useState(null)
  const [showEmpModal, setShowEmpModal] = useState(false)
  const [deleteEmpId, setDeleteEmpId] = useState(null)
  const [emailEmployee, setEmailEmployee] = useState(null)
  const [copyingWeek, setCopyingWeek] = useState(false)
  const [toast, setToast]           = useState('')

  const weekDays = getWeekDays(weekStart)
  const weekEnd  = weekDays[6]

  const loadAll = async () => {
    setLoading(true)
    const [{ data: s }, { data: e }] = await Promise.all([
      supabase.from('shifts').select('*').order('shift_date').order('start_time'),
      supabase.from('employees').select('*').order('name'),
    ])
    setShifts(s || [])
    setEmployees(e || [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const weekShifts = useMemo(() => {
    const ws = toDS(weekStart), we = toDS(weekEnd)
    return shifts.filter(s => s.shift_date >= ws && s.shift_date <= we)
  }, [shifts, weekStart])

  // ── Hour tallies ──
  const dayHours = useMemo(() => {
    const map = {}
    weekDays.forEach(d => { map[toDS(d)] = 0 })
    weekShifts.forEach(s => { map[s.shift_date] = (map[s.shift_date] || 0) + shiftHours(s) })
    return map
  }, [weekShifts, weekDays])

  const weekTotalHours = useMemo(() => weekShifts.reduce((s,x) => s + shiftHours(x), 0), [weekShifts])

  const handleSave     = () => { setShowShiftModal(false); setEditShift(null); loadAll() }
  const handleEmpSave  = () => { setShowEmpModal(false); setEditEmp(null); loadAll() }
  const handleShiftDel = () => { setShowShiftModal(false); setEditShift(null); loadAll() }

  const handleCopyLastWeek = async () => {
    const prevStart = new Date(weekStart); prevStart.setDate(prevStart.getDate()-7)
    const prevEnd   = new Date(prevStart); prevEnd.setDate(prevEnd.getDate()+6)
    const ps = toDS(prevStart), pe = toDS(prevEnd)
    const prev = shifts.filter(s => s.shift_date >= ps && s.shift_date <= pe)
    if (!prev.length) { setToast('No shifts found for last week'); setTimeout(()=>setToast(''),3000); return }
    setCopyingWeek(true)
    const newShifts = prev.map(s => {
      const d = parseDS(s.shift_date); d.setDate(d.getDate()+7)
      return { employee_id:s.employee_id, employee_name:s.employee_name, employee_email:s.employee_email, shift_date:toDS(d), start_time:s.start_time, end_time:s.end_time, role:s.role, notes:s.notes }
    })
    await supabase.from('shifts').insert(newShifts)
    setCopyingWeek(false)
    setToast(`Copied ${newShifts.length} shifts from last week`)
    setTimeout(()=>setToast(''),3000)
    loadAll()
  }

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
              <button className={styles.copyBtn} onClick={()=>setShowEmpPanel(v=>!v)}>
                👥 Employees {employees.length > 0 ? `(${employees.length})` : ''}
              </button>
              <button className={styles.copyBtn} onClick={handleCopyLastWeek} disabled={copyingWeek}>
                {copyingWeek?'Copying…':'↩ Copy last week'}
              </button>
              <button className={styles.addBtn} onClick={()=>{setEditShift(null);setShowShiftModal(true)}}>+ Add shift</button>
            </>
          )}
        </div>
      </div>

      {/* Employee panel */}
      {isAdmin && showEmpPanel && (
        <div className={styles.empPanel}>
          <div className={styles.empPanelHeader}>
            <div className={styles.empPanelTitle}>Employees</div>
            <button className={styles.addBtn} style={{fontSize:11,padding:'5px 12px'}} onClick={()=>{setEditEmp(null);setShowEmpModal(true)}}>+ Add employee</button>
          </div>
          {employees.length === 0 ? (
            <div className={styles.empPanelEmpty}>No employees yet. Add your first team member.</div>
          ) : (
            <div className={styles.empList}>
              {employees.map(e => (
                <div key={e.id} className={styles.empListRow}>
                  <div className={styles.empAvatar}>{e.name.slice(0,2).toUpperCase()}</div>
                  <div className={styles.empInfo}>
                    <div className={styles.empName}>{e.name}</div>
                    <div className={styles.empMeta}>{e.email || 'No email'} · <span className={styles.empRole} style={{color:ROLE_COLORS[e.default_role]?.text}}>{e.default_role}</span></div>
                  </div>
                  <div className={styles.empActions}>
                    <button className={styles.ea} onClick={()=>{setEditEmp(e);setShowEmpModal(true)}}>Edit</button>
                    <button className={`${styles.ea} ${styles.eaDel}`} onClick={()=>setDeleteEmpId(e.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Week nav */}
      <div className={styles.weekNav}>
        <div className={styles.weekNavLeft}>
          <button className={styles.weekArrow} onClick={()=>{const d=new Date(weekStart);d.setDate(d.getDate()-7);setWeekStart(d)}}>‹</button>
          <div className={styles.weekLabel}>{fmtWeek(weekStart)}</div>
          <button className={styles.weekArrow} onClick={()=>{const d=new Date(weekStart);d.setDate(d.getDate()+7);setWeekStart(d)}}>›</button>
          <button className={styles.todayBtn} onClick={()=>setWeekStart(getWeekStart(new Date()))}>Today</button>
        </div>
        <div className={styles.weekHoursBadge}>
          Week total: <strong>{fmtHrs(weekTotalHours)}</strong>
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
        <div className={styles.calendarWrap}>
          <div className={styles.calGrid}>
            {weekDays.map(day => {
              const ds = toDS(day)
              const dayShifts = weekShifts.filter(s => s.shift_date === ds)
              const isToday = ds === todayDS
              const hrs = dayHours[ds] || 0
              return (
                <div key={ds} className={`${styles.calDay} ${isToday?styles.calDayToday:''}`}>
                  <div className={styles.calDayHeader}>
                    <div className={styles.calDayName}>{DAYS[day.getDay()]}</div>
                    <div className={`${styles.calDayNum} ${isToday?styles.calDayNumToday:''}`}>{day.getDate()}</div>
                    {isAdmin && <button className={styles.calAddBtn} onClick={()=>{setEditShift({shift_date:ds});setShowShiftModal(true)}}>+</button>}
                  </div>
                  {hrs > 0 && <div className={styles.calDayHours}>{fmtHrs(hrs)}</div>}
                  <div className={styles.calDayShifts}>
                    {dayShifts.length === 0
                      ? <div className={styles.calEmpty}>—</div>
                      : dayShifts.map(s => (
                        <div key={s.id} className={styles.calShift}
                          style={{background:ROLE_COLORS[s.role]?.bg, borderLeft:`3px solid ${ROLE_COLORS[s.role]?.dot}`}}
                          onClick={()=>isAdmin&&(setEditShift(s),setShowShiftModal(true))}>
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
        <div className={styles.listWrap}>
          {weekShifts.length === 0 ? (
            <div className={styles.empty}>No shifts scheduled for this week.</div>
          ) : (
            <div className={styles.listTable}>
              <div className={styles.listHeader}>
                <div>Employee</div><div>Day</div><div>Time</div><div>Role</div><div>Hours</div>{isAdmin&&<div></div>}
              </div>
              {weekShifts.map(s => (
                <div key={s.id} className={styles.listRow} style={{gridTemplateColumns:isAdmin?'1.5fr 1fr 1fr 100px 60px 100px':'1.5fr 1fr 1fr 100px 60px'}}>
                  <div className={styles.listName}>
                    <div className={styles.listAvatar}>{s.employee_name.slice(0,2).toUpperCase()}</div>
                    <div>
                      <div className={styles.listNameText}>{s.employee_name}</div>
                      {s.notes && <div className={styles.listNotes}>{s.notes}</div>}
                    </div>
                  </div>
                  <div className={styles.listDay}>{parseDS(s.shift_date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
                  <div className={styles.listTime}>{fmt12(s.start_time)} – {fmt12(s.end_time)}</div>
                  <div><span className={styles.rolePill} style={{background:ROLE_COLORS[s.role]?.bg,color:ROLE_COLORS[s.role]?.text}}>{s.role}</span></div>
                  <div className={styles.listHours}>{fmtHrs(shiftHours(s))}</div>
                  {isAdmin && (
                    <div className={styles.listActions}>
                      <button className={styles.ea} onClick={()=>{setEditShift(s);setShowShiftModal(true)}}>Edit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Send schedules panel */}
      {isAdmin && weekEmployees.length > 0 && (
        <div className={styles.employeePanel}>
          <div className={styles.employeePanelTitle}>Send schedules — {fmtWeek(weekStart)}</div>
          <div className={styles.employeeList}>
            {weekEmployees.map(emp => (
              <div key={emp.name} className={styles.employeeRow}>
                <div className={styles.empAvatar}>{emp.name.slice(0,2).toUpperCase()}</div>
                <div className={styles.empInfo}>
                  <div className={styles.empName}>{emp.name}</div>
                  <div className={styles.empShiftCount}>
                    {emp.shifts.length} shift{emp.shifts.length!==1?'s':''} · {fmtHrs(emp.shifts.reduce((s,x)=>s+shiftHours(x),0))}
                  </div>
                </div>
                <button
                  className={`${styles.sendBtn} ${!emp.email?styles.sendBtnDisabled:''}`}
                  onClick={()=>emp.email&&setEmailEmployee(emp)}
                  title={!emp.email?'No email on file':''}
                >{emp.email?'✉ Send schedule':'No email'}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showShiftModal && <ShiftModal shift={editShift} employees={employees} weekDays={weekDays} onSave={handleSave} onDelete={handleShiftDel} onClose={()=>{setShowShiftModal(false);setEditShift(null)}} />}
      {showEmpModal  && <EmployeeModal employee={editEmp} onSave={handleEmpSave} onClose={()=>{setShowEmpModal(false);setEditEmp(null)}} />}
      {emailEmployee && <EmailModal employee={emailEmployee} weekLabel={fmtWeek(weekStart)} shifts={emailEmployee.shifts} onClose={()=>setEmailEmployee(null)} />}

      {deleteEmpId && (
        <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&setDeleteEmpId(null)}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmTitle}>Delete employee?</div>
            <div className={styles.confirmMsg}>This will remove the employee profile. Their past shifts will remain.</div>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={()=>setDeleteEmpId(null)}>Cancel</button>
              <button className={styles.deleteBtn} onClick={async()=>{await supabase.from('employees').delete().eq('id',deleteEmpId);setDeleteEmpId(null);loadAll()}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
