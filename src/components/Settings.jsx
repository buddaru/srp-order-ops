import { useAuth } from '../context/AuthContext'
import styles from './Settings.module.css'

export default function Settings() {
  const { profile, user } = useAuth()
  const name  = profile?.full_name || user?.email || '—'
  const email = profile?.email || user?.email || '—'
  const role  = profile?.role || '—'

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>
      <p className={styles.sub}>Manage your account and preferences.</p>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Account</div>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Name</span>
            <span className={styles.rowVal}>{name}</span>
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

      <div className={styles.section}>
        <div className={styles.sectionLabel}>More settings coming soon</div>
        <div className={styles.placeholder}>
          Notifications, team management, integrations, and more will appear here.
        </div>
      </div>
    </div>
  )
}
