import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCurrentLocation } from '../context/LocationContext'
import styles from './Admin.module.css'
import PageHeader from './PageHeader'

function CreateUserModal({ onClose, onCreated, locationId }) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('employee')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSave = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) { setError('All fields are required'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, full_name: name.trim(), role, location_id: locationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create account')
      onCreated()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Add team member</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Full name</label>
            <input className="modal-input" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" autoFocus />
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Email</label>
            <input className="modal-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Temporary password</label>
            <input className="modal-input" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="They can change this in Settings" />
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Role</label>
            <div className={styles.roleToggle}>
              <button className={`${styles.roleBtn} ${role==='employee' ? styles.roleActive : ''}`} onClick={() => setRole('employee')}>Employee</button>
              <button className={`${styles.roleBtn} ${role==='admin' ? styles.roleActiveAdmin : ''}`} onClick={() => setRole('admin')}>Admin</button>
            </div>
          </div>
          {error && <div className={styles.errorMsg}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Creating…' : 'Create account'}</button>
        </div>
      </div>
    </div>
  )
}

function EditUserModal({ user, onClose, onSaved }) {
  const [name, setName]         = useState(user.full_name || '')
  const [role, setRole]         = useState(user.role || 'employee')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const updates = { full_name: name.trim(), role }
      const { error: profileErr } = await supabase.from('profiles').update(updates).eq('id', user.id)
      if (profileErr) throw profileErr
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update user')
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Edit account</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Full name</label>
            <input className="modal-input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Email</label>
            <div className={styles.emailReadOnly}>{user.email}</div>
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Role</label>
            <div className={styles.roleToggle}>
              <button className={`${styles.roleBtn} ${role==='employee' ? styles.roleActive : ''}`} onClick={() => setRole('employee')}>Employee</button>
              <button className={`${styles.roleBtn} ${role==='admin' ? styles.roleActiveAdmin : ''}`} onClick={() => setRole('admin')}>Admin</button>
            </div>
          </div>
          {error && <div className={styles.errorMsg}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Admin() {
  const { isAdmin } = useAuth()
  const { currentLocation } = useCurrentLocation() || {}
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser]     = useState(null)
  const [deleteId, setDeleteId]     = useState(null)

  const load = async () => {
    if (!currentLocation) { setLoading(false); return }
    setLoading(true)
    try {
      const [{ data: locMembers }, { data: orgMembers }] = await Promise.all([
        supabase.from('location_members').select('user_id, role').eq('location_id', currentLocation.id),
        supabase.from('organization_members').select('user_id, role').eq('organization_id', currentLocation.organization_id),
      ])

      const userIds = [...new Set([
        ...(locMembers || []).map(m => m.user_id),
        ...(orgMembers || []).map(m => m.user_id),
      ])]

      if (userIds.length === 0) { setUsers([]); setLoading(false); return }

      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds).order('full_name')

      const orgMap = Object.fromEntries((orgMembers || []).map(m => [m.user_id, m.role]))
      const locMap = Object.fromEntries((locMembers || []).map(m => [m.user_id, m.role]))

      setUsers((profiles || []).map(p => ({
        ...p,
        memberRole: orgMap[p.id] || locMap[p.id] || p.role,
      })))
    } catch (e) {
      console.error('Admin load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [currentLocation?.id])

  if (!isAdmin) return (
    <div className={styles.denied}>
      <div className={styles.deniedTitle}>Access denied</div>
      <div className={styles.deniedSub}>Admin access required</div>
    </div>
  )

  const handleDelete = async () => {
    await supabase.from('profiles').delete().eq('id', deleteId)
    setDeleteId(null)
    load()
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Team Management">
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Add account</button>
      </PageHeader>

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : (
        <div className={styles.listWrap}>
          <div className={styles.listHeader}>
            <div>Name</div>
            <div>Email</div>
            <div>Role</div>
            <div></div>
          </div>
          {users.map(u => (
            <div key={u.id} className={styles.userRow}>
              <div className={styles.nameCell}>
                <div className={styles.avatar}>{(u.full_name || u.email || '?').slice(0,2).toUpperCase()}</div>
                <div className={styles.userName}>{u.full_name || '—'}</div>
              </div>
              <div className={styles.userEmail}>{u.email}</div>
              <div>
                <span className={`${styles.roleBadge} ${['org_admin','org_owner','admin'].includes(u.memberRole) ? styles.roleAdmin : styles.roleEmployee}`}>
                  {['org_admin','org_owner'].includes(u.memberRole) ? 'Admin' : (u.memberRole || 'employee')}
                </span>
              </div>
              <div className={styles.actions}>
                <button className={styles.ea} onClick={() => setEditUser(u)}>Edit</button>
                <button className={`${styles.ea} ${styles.eaDel}`} onClick={() => setDeleteId(u.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={load} locationId={currentLocation?.id} />}
      {editUser   && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={load} />}

      {deleteId && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmTitle}>Delete account?</div>
            <div className={styles.confirmMsg}>This will permanently remove the account and cannot be undone.</div>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setDeleteId(null)}>Cancel</button>
              <button className={styles.deleteBtn} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
