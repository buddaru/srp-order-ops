import { useState, useEffect, useMemo } from 'react'
import { supabase, safeQuery } from '../lib/supabase'
import { getCache, setCache } from '../lib/cache'
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
const TAX_RATE = 0.153 // ~15.3% employer FICA

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
  if (!s.start_time||!s.end_time) return 0
  const [sh,sm]=s.start_time.split(':').map(Number)
  const [eh,em]=s.end_time.split(':').map(Number)
  return Math.max(0,(eh*60+em-sh*60-sm)/60)
}
function fmtHrs(h) { return h%1===0?`${h}h`:`${h.toFixed(1)}h` }
function fmtMoney(n) { return '$'+Math.round(n).toLocaleString() }

// ── Employee Modal ──
function EmployeeModal({ employee, onSave, onClose }) {
  const isEdit = !!employee?.id
  const [name, setName]       = useState(employee?.name||'')
  const [email, setEmail]     = useState(employee?.email||'')
  const [phone, setPhone]     = useState(employee?.phone||'')
  const [payRate, setPayRate] = useState(employee?.pay_rate||'')
  const [role, setRole]       = useState(employee?.default_role||'Baker')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setError('Name required'); return }
    setSaving(true)
    const row = { name:name.trim(), email:email.trim(), phone:phone.trim(), pay_rate:parseFloat(payRate)||null, default_role:role }
    if (isEdit) { await supabase.from('employees').update(row).eq('id',employee.id) }
    else { await supabase.from('employees').insert([row]) }
    onSave()
  }

  return (
    <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={styles.modal} style={{maxWidth:420}}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{isEdit?'Edit employee':'Add employee'}</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Full name</label>
            <input className={styles.finput} value={name} onChange={e=>{setName(e.target.value);setError('')}} placeholder="Jane Smith" autoFocus />
          </div>
          <div className={styles.formRow2}>
            <div>
              <label className={styles.flabel}>Email</label>
              <input className={styles.finput} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
            <div>
              <label className={styles.flabel}>Phone</label>
              <input className={styles.finput} type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(555) 000-0000" />
            </div>
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Pay rate ($/hr)</label>
            <input className={styles.finput} type="number" min="0" step="0.01" value={payRate} onChange={e=>setPayRate(e.target.value)} placeholder="15.00" />
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
  const [empId, setEmpId]         = useState(shift?.employee_id||(employees[0]?.id||''))
  const [date, setDate]           = useState(shift?.shift_date||toDS(weekDays[0]))
  const [startTime, setStartTime] = useState(shift?.start_time||'09:00')
  const [endTime, setEndTime]     = useState(shift?.end_time||'17:00')
  const [role, setRole]           = useState(shift?.role||employees[0]?.default_role||'Baker')
  const [notes, setNotes]         = useState(shift?.notes||'')
  const [saving, setSaving]       = useState(false)
  const [errors, setErrors]       = useState({})
  const [confirmDel, setConfirmDel] = useState(false)

  const handleEmpChange = (id) => {
    setEmpId(id)
    const emp = employees.find(e=>e.id===id)
    if (emp) setRole(emp.default_role||'Baker')
  }

  const validate = () => {
    const e={}
    if (!empId) e.emp=true
    if (!date) e.date=true
    if (!startTime) e.start=true
    if (!endTime) e.end=true
    return e
  }

  const handleSave = async () => {
    const e=validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const emp = employees.find(x=>x.id===empId)
    const row = { employee_id:empId, employee_name:emp?.name||'', employee_email:emp?.email||'', shift_date:date, start_time:startTime, end_time:endTime, role, notes:notes.trim() }
    if (isEdit) { await supabase.from('shifts').update(row).eq('id',shift.id) }
    else { await supabase.from('shifts').insert([row]) }
    onSave()
  }

  const handleDelete = async () => { await supabase.from('shifts').delete().eq('id',shift.id); onDelete() }

  const selectedEmp = employees.find(e=>e.id===empId)

  if (confirmDel) return (
    <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&setConfirmDel(false)}>
      <div className={styles.confirmBox}>
        <div className={styles.confirmTitle}>Delete this shift?</div>
        <div className={styles.confirmMsg}>Shift for <strong>{selectedEmp?.name||shift?.employee_name}</strong> on {parseDS(date).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})} will be removed.</div>
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
          <div className={styles.modalTitle}>{isEdit?'Edit shift':'Add shift'}</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          {employees.length===0 ? (
            <div className={styles.noEmpMsg}>No employees yet. Add employees first using the Employees button.</div>
          ) : (
            <>
              <div className={styles.formRow}>
                <label className={styles.flabel}>Employee</label>
                <select className={`${styles.finput} ${errors.emp?styles.invalid:''}`} value={empId}
                  onChange={e=>{handleEmpChange(e.target.value);setErrors(v=>({...v,emp:false}))}}>
                  <option value="">Select employee…</option>
                  {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className={styles.formRow}>
                <label className={styles.flabel}>Date</label>
                <select className={`${styles.finput} ${errors.date?styles.invalid:''}`} value={date}
                  onChange={e=>{setDate(e.target.value);setErrors(v=>({...v,date:false}))}}>
                  {weekDays.map(d=>(
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
                  {ROLES.map(r=>(
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
          {isEdit && <button className={styles.deleteBtn} onClick={()=>setConfirmDel(true)}>Delete shift</button>}
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving||employees.length===0}>{saving?'Saving…':'Save shift'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Send All Modal ──
function SendAllModal({ employees, weekShifts, weekLabel, onClose }) {
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError]     = useState('')

  // Build per-employee shift lists
  const empShifts = useMemo(() => {
    const map = {}
    weekShifts.forEach(s => {
      if (!s.employee_email) return
      if (!map[s.employee_name]) map[s.employee_name] = { name:s.employee_name, email:s.employee_email, shifts:[] }
      map[s.employee_name].shifts.push(s)
    })
    return Object.values(map)
  }, [weekShifts])

  const noEmail = useMemo(() => {
    const names = new Set(weekShifts.map(s=>s.employee_name))
    return [...names].filter(n => !weekShifts.find(s=>s.employee_name===n&&s.employee_email))
  }, [weekShifts])

  const handleSendAll = async () => {
    setSending(true); setError('')
    const sent=[], failed=[]
    for (const emp of empShifts) {
      try {
        const res = await fetch('/api/send-schedule', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ employee:emp, weekLabel, shifts:emp.shifts })
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        sent.push(emp.name)
      } catch(e) { failed.push(emp.name) }
    }
    setResults({ sent, failed })
    setSending(false)
  }

  return (
    <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={styles.modal} style={{maxWidth:420}}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{results?'Schedules sent':'Send all schedules'}</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          {results ? (
            <>
              {results.sent.length>0 && (
                <div className={styles.sentBlock}>
                  <div className={styles.sentIcon}>✓</div>
                  <div>
                    <div className={styles.sentTitle}>Sent to {results.sent.length} {results.sent.length===1?'employee':'employees'}</div>
                    <div className={styles.sentNames}>{results.sent.join(', ')}</div>
                  </div>
                </div>
              )}
              {results.failed.length>0 && (
                <div className={styles.failedBlock}>Failed: {results.failed.join(', ')}</div>
              )}
            </>
          ) : (
            <>
              <div className={styles.sendSummary}>
                Sending schedule for <strong>{weekLabel}</strong> to <strong>{empShifts.length} {empShifts.length===1?'employee':'employees'}</strong>.
              </div>
              {empShifts.map(emp=>(
                <div key={emp.name} className={styles.sendEmpRow}>
                  <div className={styles.sendEmpDot} />
                  <div className={styles.sendEmpName}>{emp.name}</div>
                  <div className={styles.sendEmpEmail}>{emp.email}</div>
                  <div className={styles.sendEmpCount}>{emp.shifts.length} shift{emp.shifts.length!==1?'s':''}</div>
                </div>
              ))}
              {noEmail.length>0 && (
                <div className={styles.noEmailNote}>
                  {noEmail.join(', ')} {noEmail.length===1?'has':'have'} no email — they won't receive a schedule.
                </div>
              )}
              {error && <div className={styles.errorMsg}>{error}</div>}
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          {results
            ? <button className={styles.saveBtn} style={{gridColumn:'1/-1'}} onClick={onClose}>Done</button>
            : <>
                <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                <button className={styles.saveBtn} onClick={handleSendAll} disabled={sending||empShifts.length===0}>
                  {sending?'Sending…':`Send to ${empShifts.length}`}
                </button>
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
  const [shifts, setShifts]         = useState([])
  const [employees, setEmployees]   = useState([])
  const [loading, setLoading]       = useState(false)
  const [weekStart, setWeekStart]   = useState(()=>getWeekStart(new Date()))
  const [view, setView]             = useState('calendar')
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [editShift, setEditShift]   = useState(null)
  const [showEmpPanel, setShowEmpPanel] = useState(false)
  const [editEmp, setEditEmp]       = useState(null)
  const [showEmpModal, setShowEmpModal] = useState(false)
  const [deleteEmpId, setDeleteEmpId] = useState(null)
  const [showSendAll, setShowSendAll] = useState(false)
  const [copyingWeek, setCopyingWeek] = useState(false)
  const [toast, setToast]           = useState('')
  const [withTax, setWithTax]       = useState(false)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [mobileDay, setMobileDay]   = useState(() => toDS(new Date()))

  const weekDays = getWeekDays(weekStart)
  const weekEnd  = weekDays[6]

  const loadAll = async () => {
    // Show cached data instantly
    const cached = getCache('schedule-all')
    if (cached) {
      setShifts(cached.shifts)
      setEmployees(cached.employees)
      setLoading(false)
    } else {
      setLoading(true)
    }
    const [r1, r2] = await Promise.all([
      safeQuery(() => supabase.from('shifts').select('*').order('shift_date').order('start_time')),
      safeQuery(() => supabase.from('employees').select('*').order('name')),
    ])
    const shifts = r1.data || []
    const employees = r2.data || []
    setShifts(shifts)
    setEmployees(employees)
    setCache('schedule-all', { shifts, employees })
    setLoading(false)
  }

  useEffect(()=>{
    loadAll()
    const onVisible = () => { if (document.visibilityState === 'visible') loadAll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  },[])

  const weekShifts = useMemo(()=>{
    const ws=toDS(weekStart), we=toDS(weekEnd)
    return shifts.filter(s=>s.shift_date>=ws&&s.shift_date<=we)
  },[shifts,weekStart])

  // Build employee map for pay rate lookup
  const empMap = useMemo(()=>{
    const m={}; employees.forEach(e=>{ m[e.id]=e }); return m
  },[employees])

  // Hour and wage tallies
  const dayTotals = useMemo(()=>{
    const hrs={}, wages={}
    weekDays.forEach(d=>{ const ds=toDS(d); hrs[ds]=0; wages[ds]=0 })
    weekShifts.forEach(s=>{
      const h=shiftHours(s)
      const rate=empMap[s.employee_id]?.pay_rate||0
      const ds=s.shift_date
      hrs[ds]=(hrs[ds]||0)+h
      wages[ds]=(wages[ds]||0)+h*rate
    })
    return { hrs, wages }
  },[weekShifts,weekDays,empMap])

  const weekTotalHrs  = Object.values(dayTotals.hrs).reduce((a,b)=>a+b,0)
  const weekTotalWage = Object.values(dayTotals.wages).reduce((a,b)=>a+b,0)
  const weekTotalDisp = withTax ? weekTotalWage*(1+TAX_RATE) : weekTotalWage
  const wageLbl       = withTax ? 'Est. wages + tax' : 'Est. wages'

  const handleSave     = ()=>{ setShowShiftModal(false); setEditShift(null); loadAll() }
  const handleEmpSave  = ()=>{ setShowEmpModal(false); setEditEmp(null); loadAll() }
  const handleShiftDel = ()=>{ setShowShiftModal(false); setEditShift(null); loadAll() }

  const handleCopyLastWeek = async ()=>{
    const prevStart=new Date(weekStart); prevStart.setDate(prevStart.getDate()-7)
    const prevEnd=new Date(prevStart); prevEnd.setDate(prevEnd.getDate()+6)
    const ps=toDS(prevStart), pe=toDS(prevEnd)
    const prev=shifts.filter(s=>s.shift_date>=ps&&s.shift_date<=pe)
    if (!prev.length){ setToast('No shifts found for last week'); setTimeout(()=>setToast(''),3000); return }
    setCopyingWeek(true)
    const newShifts=prev.map(s=>{
      const d=parseDS(s.shift_date); d.setDate(d.getDate()+7)
      return { employee_id:s.employee_id, employee_name:s.employee_name, employee_email:s.employee_email, shift_date:toDS(d), start_time:s.start_time, end_time:s.end_time, role:s.role, notes:s.notes }
    })
    await supabase.from('shifts').insert(newShifts)
    setCopyingWeek(false)
    setToast(`Copied ${newShifts.length} shifts from last week`)
    setTimeout(()=>setToast(''),3000)
    loadAll()
  }

  const todayDS = toDS(new Date())

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.topbar}>
        <div className={styles.pageTitle}>Schedule</div>
        <div className={styles.topbarRight}>
          {isAdmin && (
            <>
              <button className={styles.addBtn} onClick={()=>{setEditShift(null);setShowShiftModal(true)}}>+ Add shift</button>
              <div className={styles.menuWrap}>
                <button className={styles.hamburger} onClick={()=>setMenuOpen(v=>!v)}>
                  <span/><span/><span/>
                </button>
                {menuOpen && (
                  <>
                    <div className={styles.menuBackdrop} onClick={()=>setMenuOpen(false)} />
                    <div className={styles.menuDropdown}>
                      <button className={styles.menuItem} onClick={()=>{setShowEmpPanel(v=>!v);setMenuOpen(false)}}>
                        👥 Employees{employees.length>0?` (${employees.length})`:''}
                      </button>
                      <button className={styles.menuItem} onClick={()=>{handleCopyLastWeek();setMenuOpen(false)}} disabled={copyingWeek}>
                        ↩ {copyingWeek?'Copying…':'Copy last week'}
                      </button>
                      <button className={styles.menuItem} onClick={()=>{setShowSendAll(true);setMenuOpen(false)}}>
                        ✉ Send schedule
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Employee panel */}
      {isAdmin && showEmpPanel && (
        <div className={styles.empPanel}>
          <div className={styles.empPanelHeader}>
            <div className={styles.empPanelTitle}>Employees</div>
            <div style={{display:'flex',gap:8}}>
              <button className={styles.addBtn} style={{fontSize:11,padding:'5px 12px'}} onClick={()=>{setEditEmp(null);setShowEmpModal(true)}}>+ Add employee</button>
              <button className={styles.copyBtn} style={{fontSize:11,padding:'5px 12px'}} onClick={()=>setShowEmpPanel(false)}>Hide ✕</button>
            </div>
          </div>
          {employees.length===0 ? (
            <div className={styles.empPanelEmpty}>No employees yet.</div>
          ) : (
            <div className={styles.empList}>
              {employees.map(e=>(
                <div key={e.id} className={styles.empListRow}>
                  <div className={styles.empAvatar}>{e.name.slice(0,2).toUpperCase()}</div>
                  <div className={styles.empInfo}>
                    <div className={styles.empName}>{e.name}</div>
                    <div className={styles.empMeta}>
                      {e.email||'No email'} · {e.phone||'No phone'} · <span style={{color:ROLE_COLORS[e.default_role]?.text}}>{e.default_role}</span>{isAdmin&&e.pay_rate?` · $${e.pay_rate}/hr`:''}
                    </div>
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
        <div className={styles.weekStats}>
          <div className={styles.weekStat}><span className={styles.wsVal}>{weekShifts.length}</span><span className={styles.wsLbl}>shifts</span></div>
          <div className={styles.weekStatDiv}/>
          <div className={styles.weekStat}><span className={styles.wsVal}>{fmtHrs(weekTotalHrs)}</span><span className={styles.wsLbl}>total hours</span></div>
          {isAdmin&&weekTotalWage>0&&(
            <>
              <div className={styles.weekStatDiv}/>
              <div className={styles.weekStat}>
                <button className={styles.wageToggleBtn} onClick={()=>setWithTax(v=>!v)} title="Click to toggle payroll tax estimate">
                  <span className={styles.wsVal}>{fmtMoney(weekTotalDisp)}</span>
                  <span className={styles.wsLbl}>{wageLbl}</span>
                </button>
              </div>
            </>
          )}
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
      ) : view==='calendar' ? (
        /* ── Calendar / Grid view ── */
        <>
        {/* Mobile day strip */}
        <div className={styles.mobileDayNav}>
          <button className={styles.weekArrow} onClick={()=>{const d=parseDS(mobileDay);d.setDate(d.getDate()-1);setMobileDay(toDS(d))}}>‹</button>
          <div className={styles.mobileDayLabel}>
            {parseDS(mobileDay).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}
            {mobileDay===todayDS&&<span className={styles.mobileTodayBadge}>Today</span>}
          </div>
          <button className={styles.weekArrow} onClick={()=>{const d=parseDS(mobileDay);d.setDate(d.getDate()+1);setMobileDay(toDS(d))}}>›</button>
        </div>
        {/* Mobile day view */}
        <div className={styles.mobileDayView}>
          {(() => {
            const dayShifts = weekShifts.filter(s=>s.shift_date===mobileDay)
            if (dayShifts.length===0) return <div className={styles.mobileDayEmpty}>No shifts scheduled</div>
            return dayShifts.map(s=>(
              <div key={s.id} className={styles.mobileDayShift}
                style={{background:ROLE_COLORS[s.role]?.bg, borderLeft:`4px solid ${ROLE_COLORS[s.role]?.dot}`}}
                onClick={()=>isAdmin&&(setEditShift(s),setShowShiftModal(true))}>
                <div className={styles.mdsTime}>{fmt12(s.start_time)} – {fmt12(s.end_time)} · {fmtHrs(shiftHours(s))}</div>
                <div className={styles.mdsName}>{s.employee_name}</div>
                <div className={styles.mdsRole} style={{color:ROLE_COLORS[s.role]?.text}}>{s.role}</div>
                {s.notes&&<div className={styles.mdsNotes}>{s.notes}</div>}
              </div>
            ))
          })()}
          {isAdmin&&<button className={styles.mobileAddShift} onClick={()=>{setEditShift({shift_date:mobileDay});setShowShiftModal(true)}}>+ Add shift for this day</button>}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.schedTable}>
            <thead>
              <tr>
                <th className={styles.empCol}>Employee</th>
                {weekDays.map(day=>{
                  const ds=toDS(day)
                  const isToday=ds===todayDS
                  return (
                    <th key={ds} className={`${styles.dayCol} ${isToday?styles.todayCol:''}`}>
                      <div className={styles.thDay}>{DAYS[day.getDay()]}</div>
                      <div className={`${styles.thNum} ${isToday?styles.thNumToday:''}`}>{day.getDate()}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {employees.length===0 ? (
                <tr><td colSpan={8} className={styles.empty}>No employees yet. Add employees to start scheduling.</td></tr>
              ) : employees.map(emp=>{
                const empShifts = weekShifts.filter(s=>s.employee_id===emp.id)
                return (
                  <tr key={emp.id}>
                    <td className={styles.empCell}>
                      <div className={styles.empRow}>
                        <div className={styles.empAvatar}>{emp.name.slice(0,2).toUpperCase()}</div>
                        <div>
                          <div className={styles.empName}>{emp.name}</div>
                          <div className={styles.empMeta2}>{emp.default_role}{(() => {
                            const h = weekShifts.filter(s=>s.employee_id===emp.id).reduce((sum,s)=>sum+shiftHours(s),0)
                            return h > 0 ? ` · ${fmtHrs(h)} this week` : ''
                          })()}</div>
                        </div>
                      </div>
                    </td>
                    {weekDays.map(day=>{
                      const ds=toDS(day)
                      const isToday=ds===todayDS
                      const dayShifts=empShifts.filter(s=>s.shift_date===ds)
                      return (
                        <td key={ds} className={`${styles.shiftCell} ${isToday?styles.todayCell:''}`}
                          onClick={()=>isAdmin&&(setEditShift({shift_date:ds,employee_id:emp.id}),setShowShiftModal(true))}>
                          {dayShifts.map(s=>(
                            <div key={s.id} className={styles.shiftBlock}
                              style={{background:ROLE_COLORS[s.role]?.bg, borderLeft:`3px solid ${ROLE_COLORS[s.role]?.dot}`}}
                              onClick={e=>{e.stopPropagation();isAdmin&&(setEditShift(s),setShowShiftModal(true))}}>
                              <div className={styles.shiftTime}>{fmt12(s.start_time)} – {fmt12(s.end_time)}</div>
                              <div className={styles.shiftRole} style={{color:ROLE_COLORS[s.role]?.text}}>{s.role} · {fmtHrs(shiftHours(s))}</div>
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className={styles.footerRow}>
                <td className={styles.footerLabel}>Scheduled hours</td>
                {weekDays.map(day=>{
                  const ds=toDS(day)
                  const h=dayTotals.hrs[ds]||0
                  return <td key={ds} className={styles.footerHrs}>{h>0?fmtHrs(h):'—'}</td>
                })}
              </tr>
              {isAdmin&&weekTotalWage>0&&(
                <tr className={styles.footerRow}>
                  <td className={styles.footerLabel}>{wageLbl}</td>
                  {weekDays.map(day=>{
                    const ds=toDS(day)
                    const w=dayTotals.wages[ds]||0
                    const disp=withTax?w*(1+TAX_RATE):w
                    return <td key={ds} className={styles.footerWages}>{w>0?fmtMoney(disp):'—'}</td>
                  })}
                </tr>
              )}
            </tfoot>
          </table>
        </div>
        </>
      ) : (
        /* ── List view ── */
        <div className={styles.listWrap}>
          {weekShifts.length===0 ? (
            <div className={styles.empty}>No shifts scheduled for this week.</div>
          ) : (
            <div className={styles.listTable}>
              <div className={styles.listHeader}>
                <div>Employee</div><div>Day</div><div>Time</div><div>Role</div><div>Hours</div>{isAdmin&&<div></div>}
              </div>
              {weekShifts.map(s=>(
                <div key={s.id} className={styles.listRow}
                  style={{gridTemplateColumns:isAdmin?'1.5fr 1fr 1fr 100px 60px 80px':'1.5fr 1fr 1fr 100px 60px'}}>
                  <div className={styles.listName}>
                    <div className={styles.listAvatar}>{s.employee_name.slice(0,2).toUpperCase()}</div>
                    <div>
                      <div className={styles.listNameText}>{s.employee_name}</div>
                      {s.notes&&<div className={styles.listNotes}>{s.notes}</div>}
                    </div>
                  </div>
                  <div className={styles.listDay}>{parseDS(s.shift_date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
                  <div className={styles.listTime}>{fmt12(s.start_time)} – {fmt12(s.end_time)}</div>
                  <div><span className={styles.rolePill} style={{background:ROLE_COLORS[s.role]?.bg,color:ROLE_COLORS[s.role]?.text}}>{s.role}</span></div>
                  <div className={styles.listHours}>{fmtHrs(shiftHours(s))}</div>
                  {isAdmin&&(
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

      {showShiftModal && <ShiftModal shift={editShift} employees={employees} weekDays={weekDays} onSave={handleSave} onDelete={handleShiftDel} onClose={()=>{setShowShiftModal(false);setEditShift(null)}} />}
      {showEmpModal  && <EmployeeModal employee={editEmp} onSave={handleEmpSave} onClose={()=>{setShowEmpModal(false);setEditEmp(null)}} />}
      {showSendAll   && <SendAllModal employees={employees} weekShifts={weekShifts} weekLabel={fmtWeek(weekStart)} onClose={()=>setShowSendAll(false)} />}

      {deleteEmpId && (
        <div className={styles.overlay} onClick={e=>e.target===e.currentTarget&&setDeleteEmpId(null)}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmTitle}>Delete employee?</div>
            <div className={styles.confirmMsg}>This removes the employee profile. Their past shifts will remain.</div>
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
