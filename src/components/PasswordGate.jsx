import { useState } from 'react'
import styles from './PasswordGate.module.css'

const KEY = 'srp_auth'
const PASS = import.meta.env.VITE_APP_PASSWORD

export const isAuthed = () => localStorage.getItem(KEY) === PASS

export default function PasswordGate({ children }) {
  const [authed, setAuthed] = useState(isAuthed)
  const [input, setInput]   = useState('')
  const [error, setError]   = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input === PASS) {
      localStorage.setItem(KEY, PASS)
      setAuthed(true)
    } else {
      setError(true)
      setInput('')
      setTimeout(() => setError(false), 2000)
    }
  }

  if (authed) return children

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>🍑</div>
        <div className={styles.brand}>Sweet Red Peach</div>
        <div className={styles.sub}>Operations Dashboard</div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="password"
            className={`${styles.input} ${error ? styles.shake : ''}`}
            placeholder="Enter password"
            value={input}
            onChange={e => setInput(e.target.value)}
            autoFocus
          />
          {error && <div className={styles.error}>Incorrect password</div>}
          <button type="submit" className={styles.btn}>Sign in</button>
        </form>
      </div>
    </div>
  )
}
