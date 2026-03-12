import { useEffect } from 'react'
import styles from './Toast.module.css'

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [toast, onClose])

  return (
    <div className={`${styles.toast} ${toast ? styles.show : ''}`}>
      <button className={styles.close} onClick={onClose}>×</button>
      {toast && (
        <>
          <div className={styles.label}>{toast.label}</div>
          <div className={styles.customer}>{toast.customer}</div>
          <div className={styles.msg}>{toast.msg}</div>
        </>
      )}
    </div>
  )
}
