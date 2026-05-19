import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLocation } from 'react-router-dom'
import { useCurrentLocation } from '../context/LocationContext'
import styles from './Settings.module.css'

export default function Settings() {
  const { profile, user } = useAuth()
  const location = useLocation()
  const { currentLocation, isLocationAdmin, reload: reloadLocation } = useCurrentLocation()

  const [name, setName]             = useState(profile?.full_name || '')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg]       = useState('')
  const [nameErr, setNameErr]       = useState('')

  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [savingPw, setSavingPw]     = useState(false)
  const [pwMsg, setPwMsg]           = useState('')
  const [pwErr, setPwErr]           = useState('')

  const [locAddress, setLocAddress] = useState('')
  const [locPhone,   setLocPhone]   = useState('')
  const [locWebsite, setLocWebsite] = useState('')
  const [savingLoc,  setSavingLoc]  = useState(false)
  const [locMsg,     setLocMsg]     = useState('')
  const [locErr,     setLocErr]     = useState('')

  useEffect(() => {
    if (location.search.includes('reset=1')) {
      setTimeout(() => document.getElementById('pw-section')?.scrollIntoView({ behavior: 'smooth' }), 200)
    }
  }, [])

  useEffect(() => {
    const c = currentLocation?.settings?.contact || {}
    setLocAddress(c.address || '')
    setLocPhone(c.phone     || '')
    setLocWebsite(c.website || '')
  }, [currentLocation])

  const email = profile?.email || user?.email || '—'

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

  const handleChangePassword = async () => {
    if (!newPw) { setPwErr('Enter a new password'); return }
    if (newPw.length < 6) { setPwErr('Password must be at least 6 characters'); return }
    if (newPw !== confirmPw) { setPwErr('Passwords do not match'); return }
    setSavingPw(true); setPwErr(''); setPwMsg('')
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      setNewPw(''); setConfirmPw('')
      setPwMsg('Password updated.')
      setTimeout(() => setPwMsg(''), 3000)
    } catch (err) {
      setPwErr(err.message || 'Could not update password')
    } finally {
      setSavingPw(false)
    }
  }

  const handleSaveLocation = async () => {
    if (!currentLocation) return
    setSavingLoc(true); setLocErr(''); setLocMsg('')
    try {
      const existingSettings = currentLocation.settings || {}
      const { error } = await supabase
        .from('locations')
        .update({
          settings: {
            ...existingSettings,
            contact: {
              address: locAddress.trim(),
              phone:   locPhone.trim(),
              website: locWebsite.trim(),
            },
          },
        })
        .eq('id', currentLocation.id)
      if (error) throw error
      await reloadLocation()
      setLocMsg('Location info saved.')
      setTimeout(() => setLocMsg(''), 3000)
    } catch (err) {
      setLocErr(err.message || 'Could not save location info')
    } finally {
      setSavingLoc(false)
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
        </div>
      </div>

      <div className={styles.section} id="pw-section">
        <div className={styles.sectionLabel}>Password</div>
        <div className={styles.card}>
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
            <button className={styles.saveBtn} onClick={handleChangePassword} disabled={savingPw} style={{ alignSelf: 'flex-start' }}>
              {savingPw ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </div>
      </div>

      {isLocationAdmin && currentLocation && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Location — {currentLocation.name}</div>
          <div className={styles.card}>
            <div className={styles.editRow}>
              <div className={styles.editLabel}>Address</div>
              <textarea
                className={styles.editInput}
                value={locAddress}
                onChange={e => { setLocAddress(e.target.value); setLocErr(''); setLocMsg('') }}
                placeholder={'123 Main St\nCarson, CA 90745'}
                rows={2}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            <div className={styles.editRow}>
              <div className={styles.editLabel}>Phone</div>
              <div className={styles.editControl}>
                <input
                  className={styles.editInput}
                  value={locPhone}
                  onChange={e => { setLocPhone(e.target.value); setLocErr(''); setLocMsg('') }}
                  placeholder="(310) 555-0142"
                />
              </div>
            </div>
            <div className={styles.editRow} style={{ borderBottom: 'none' }}>
              <div className={styles.editLabel}>Website</div>
              <div className={styles.editControl}>
                <input
                  className={styles.editInput}
                  value={locWebsite}
                  onChange={e => { setLocWebsite(e.target.value); setLocErr(''); setLocMsg('') }}
                  placeholder="sweetredpeach.com"
                />
                <button className={styles.saveBtn} onClick={handleSaveLocation} disabled={savingLoc}>
                  {savingLoc ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
            {locErr && <div className={styles.fieldErr} style={{ padding: '0 16px 12px' }}>{locErr}</div>}
            {locMsg && <div className={styles.fieldOk}  style={{ padding: '0 16px 12px' }}>{locMsg}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
