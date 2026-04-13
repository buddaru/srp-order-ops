import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useBusiness } from '../context/BusinessContext'
import { supabase } from '../lib/supabase'
import { useLocation } from 'react-router-dom'
import styles from './Settings.module.css'

export default function Settings() {
  const { profile, user, isAdmin } = useAuth()
  const { settings, save: saveBusiness } = useBusiness()
  const location = useLocation()

  const [name, setName]           = useState(profile?.full_name || '')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg]     = useState('')
  const [nameErr, setNameErr]     = useState('')

  const [curPw, setCurPw]         = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw]   = useState(false)
  const [pwMsg, setPwMsg]         = useState('')
  const [pwErr, setPwErr]         = useState('')

  // Business settings (admin only)
  const [bizName, setBizName]         = useState(settings.business_name || '')
  const [bizCity, setBizCity]         = useState(settings.city || '')
  const [smsReady, setSmsReady]       = useState(settings.sms_ready || '')
  const [smsPickup, setSmsPickup]     = useState(settings.sms_pickup || '')
  const [savingBiz, setSavingBiz]     = useState(false)
  const [bizMsg, setBizMsg]           = useState('')
  const [bizErr, setBizErr]           = useState('')

  // Sync business fields when context loads
  useEffect(() => {
    setBizName(settings.business_name || '')
    setBizCity(settings.city || '')
    setSmsReady(settings.sms_ready || '')
    setSmsPickup(settings.sms_pickup || '')
  }, [settings])

  // If redirected from password reset email, focus the password section
  useEffect(() => {
    if (location.search.includes('reset=1')) {
      setTimeout(() => document.getElementById('pw-section')?.scrollIntoView({ behavior: 'smooth' }), 200)
    }
  }, [])

  const email = profile?.email || user?.email || '—'
  const role  = profile?.role || '—'

  const handleSaveName = async () => {
    if (!name.trim()) { setNameErr('Name cannot be empty'); return }
    setSavingName(true); setNameErr(''); setNameMsg('')
    try {
      const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user.id)
      if (error) throw error
      setNameMsg('Name updated.')
      setTimeout(() => setNameMsg(''), 3000)
    } catch (err) {
      setNameErr(err.message || 'Could not save name')
    } finally {
      setSavingName(false)
    }
  }

  const handleSaveBusiness = async () => {
    if (!bizName.trim()) { setBizErr('Business name is required'); return }
    setSavingBiz(true); setBizErr(''); setBizMsg('')
    try {
      await saveBusiness({
        business_name: bizName.trim(),
        city: bizCity.trim(),
        sms_ready: smsReady.trim(),
        sms_pickup: smsPickup.trim(),
      })
      setBizMsg('Business settings saved.')
      setTimeout(() => setBizMsg(''), 3000)
    } catch (err) {
      setBizErr(err.message || 'Could not save settings')
    } finally {
      setSavingBiz(false)
    }
  }

  const handleChangePassword = async () => {    if (!newPw) { setPwErr('Enter a new password'); return }
    if (newPw.length < 6) { setPwErr('Password must be at least 6 characters'); return }
    if (newPw !== confirmPw) { setPwErr('Passwords do not match'); return }
    setSavingPw(true); setPwErr(''); setPwMsg('')
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      setCurPw(''); setNewPw(''); setConfirmPw('')
      setPwMsg('Password updated.')
      setTimeout(() => setPwMsg(''), 3000)
    } catch (err) {
      setPwErr(err.message || 'Could not update password')
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Settings</h1>
      <p className={styles.sub}>Manage your account and preferences.</p>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Profile</div>
        <div className={styles.card}>
          <div className={styles.editRow}>
            <div className={styles.editLabel}>Name</div>
            <div className={styles.editControl}>
              <input
                className={styles.editInput}
                value={name}
                onChange={e => { setName(e.target.value); setNameErr(''); setNameMsg('') }}
                placeholder="Your name"
              />
              <button className={styles.saveBtn} onClick={handleSaveName} disabled={savingName}>
                {savingName ? 'Saving…' : 'Save'}
              </button>
            </div>
            {nameErr && <div className={styles.fieldErr}>{nameErr}</div>}
            {nameMsg && <div className={styles.fieldOk}>{nameMsg}</div>}
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Email</span>
            <span className={styles.rowVal}>{email}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Role</span>
            <span className={styles.rowVal} style={{textTransform:'capitalize'}}>{role}</span>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Business</div>
          <div className={styles.card}>
            <div className={styles.editRow}>
              <div className={styles.editLabel}>Business name</div>
              <div className={styles.editControl}>
                <input className={styles.editInput} value={bizName} onChange={e => { setBizName(e.target.value); setBizErr(''); setBizMsg('') }} placeholder="e.g. Sweet Red Peach" />
              </div>
            </div>
            <div className={styles.editRow}>
              <div className={styles.editLabel}>City</div>
              <div className={styles.editControl}>
                <input className={styles.editInput} value={bizCity} onChange={e => { setBizCity(e.target.value); setBizErr(''); setBizMsg('') }} placeholder="e.g. Carson" />
              </div>
            </div>
            <div className={styles.editRow} style={{borderBottom:'none'}}>
              <div className={styles.editLabel}>SMS templates <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,fontSize:11,color:'var(--text-muted)'}}>— use {'{name}'} for customer first name, {'{business}'} for your business + city</span></div>
              <div className={styles.pwForm} style={{padding:0,gap:10,marginTop:8}}>
                <div className={styles.pwField}>
                  <label className={styles.pwLabel}>Order ready</label>
                  <textarea className={styles.editInput} style={{height:64,resize:'vertical'}} value={smsReady} onChange={e => { setSmsReady(e.target.value); setBizErr(''); setBizMsg('') }} />
                </div>
                <div className={styles.pwField}>
                  <label className={styles.pwLabel}>Order picked up</label>
                  <textarea className={styles.editInput} style={{height:64,resize:'vertical'}} value={smsPickup} onChange={e => { setSmsPickup(e.target.value); setBizErr(''); setBizMsg('') }} />
                </div>
                {bizErr && <div className={styles.fieldErr}>{bizErr}</div>}
                {bizMsg && <div className={styles.fieldOk}>{bizMsg}</div>}
                <button className={styles.saveBtn} onClick={handleSaveBusiness} disabled={savingBiz} style={{alignSelf:'flex-start'}}>
                  {savingBiz ? 'Saving…' : 'Save business settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.section} id="pw-section">        <div className={styles.card}>
          <div className={styles.pwForm}>
            <div className={styles.pwField}>
              <label className={styles.pwLabel}>New password</label>
              <input
                type="password"
                className={styles.editInput}
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setPwErr(''); setPwMsg('') }}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div className={styles.pwField}>
              <label className={styles.pwLabel}>Confirm new password</label>
              <input
                type="password"
                className={styles.editInput}
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setPwErr(''); setPwMsg('') }}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>
            {pwErr && <div className={styles.fieldErr}>{pwErr}</div>}
            {pwMsg && <div className={styles.fieldOk}>{pwMsg}</div>}
            <button className={styles.saveBtn} onClick={handleChangePassword} disabled={savingPw} style={{alignSelf:'flex-start'}}>
              {savingPw ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
