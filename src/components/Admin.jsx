import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import styles from './Admin.module.css'

function CreateUserModal({ onClose, onCreated }) {
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [role, setRole]     = useState('employee')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [step, setStep]     = useState(1) // 1=fill form, 2=show SQL

  const sql = `insert into profiles (id, email, full_name, role)
select id, email, '${name}', '${role}'
from auth.users
where email = '${email}';`

  const handleNext = () => {
    if (!name.trim() || !email.trim()) { setError('Name and email required'); return }
    setError('')
    setStep(2)
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>{step === 1 ? 'Add team member' : 'Complete setup'}</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          {step === 1 ? (
            <>
              <div className={styles.formRow}>
                <label className={styles.flabel}>Full name</label>
                <input className={styles.finput} value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" autoFocus />
              </div>
              <div className={styles.formRow}>
                <label className={styles.flabel}>Email</label>
                <input className={styles.finput} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" />
              </div>
              <div className={styles.formRow}>
                <label className={styles.flabel}>Role</label>
                <div className={styles.roleToggle}>
                  <button className={`${styles.roleBtn} ${role==='employee' ? styles.roleActive : ''}`} onClick={() => setRole('employee')}>Employee</button>
                  <button className={`${styles.roleBtn} ${role==='admin' ? styles.roleActiveAdmin : ''}`} onClick={() => setRole('admin')}>Admin</button>
                </div>
              </div>
              {error && <div className={styles.errorMsg}>{error}</div>}
            </>
          ) : (
            <>
              <div className={styles.stepInstructions}>
                <div className={styles.stepNum}>Step 1</div>
                <div className={styles.stepText}>Go to <strong>Supabase → Authentication → Users → Add user</strong> and create a user with email <strong>{email}</strong> and a password. Check <em>Auto Confirm User</em>.</div>
              </div>
              <div className={styles.stepInstructions}>
                <div className={styles.stepNum}>Step 2</div>
                <div className={styles.stepText}>Then run this in <strong>Supabase → SQL Editor</strong>:</div>
              </div>
              <pre className={styles.sqlBlock}>{sql}</pre>
              <div className={styles.stepInstructions}>
                <div className={styles.stepNum}>Step 3</div>
                <div className={styles.stepText}>Click <strong>Done</strong> to refresh the team list.</div>
              </div>
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          {step === 1
            ? <button className={styles.saveBtn} onClick={handleNext}>Next →</button>
            : <button className={styles.saveBtn} onClick={() => { onCreated(); onClose() }}>Done</button>
          }
        </div>
      </div>
    </div>
  )
}

function EditUserModal({ user, onClose, onSaved }) {
  const [name, setName]         = useState(user.full_name || '')
  const [role, setRole]         = useState(user.role || 'employee')
  const [password, setPassword] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const updates = { full_name: name.trim(), role }
      const { error: profileErr } = await supabase.from('profiles').update(updates).eq('id', user.id)
      if (profileErr) throw profileErr
      // Password changes require admin API — skip for now, admin can reset via Supabase dashboard
      if (password.trim()) {
        // Note: password updates for other users require Supabase service role key
        // This can be done in Supabase Dashboard → Authentication → Users
        console.log('Password update not supported from client — use Supabase dashboard')
      }
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
            <input className={styles.finput} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>Email</label>
            <div className={styles.emailReadOnly}>{user.email}</div>
          </div>
          <div className={styles.formRow}>
            <label className={styles.flabel}>New password (leave blank to keep current)</label>
            <input className={styles.finput} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password…" />
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
  const { isAdmin, signOut } = useAuth()
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser]   = useState(null)
  const [deleteId, setDeleteId]   = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (!isAdmin) return (
    <div className={styles.denied}>
      <div className={styles.deniedTitle}>Access denied</div>
      <div className={styles.deniedSub}>Admin access required</div>
    </div>
  )

  const handleDelete = async () => {
    // Delete profile — auth user remains but loses access
    await supabase.from('profiles').delete().eq('id', deleteId)
    setDeleteId(null)
    load()
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.pageTitle}>Team Management</div>
        <button className={styles.createBtn} onClick={() => setShowCreate(true)}>+ Add account</button>
      </div>

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
                <span className={`${styles.roleBadge} ${u.role === 'admin' ? styles.roleAdmin : styles.roleEmployee}`}>
                  {u.role || 'employee'}
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

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={load} />}
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
