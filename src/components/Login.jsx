import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import styles from './Login.module.css'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [mode, setMode]         = useState('login') // 'login' | 'reset'
  const [resetSent, setResetSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError('Incorrect email or password')
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setError('Enter your email address above'); return }
    setError('')
    setLoading(true)
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/settings?reset=1`,
      })
      if (resetErr) throw resetErr
      setResetSent(true)
    } catch (err) {
      setError(err.message || 'Could not send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <span className={styles.logoText}>cadro</span>
          <span className={styles.logoDot}></span>
        </div>
        <div className={styles.sub}>Operations Dashboard</div>

        {mode === 'login' ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                className={styles.input}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <input
                type="password"
                className={styles.input}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              type="button"
              className={styles.forgotLink}
              onClick={() => { setMode('reset'); setError(''); setResetSent(false) }}
            >
              Forgot password?
            </button>
          </form>
        ) : resetSent ? (
          <div className={styles.resetConfirm}>
            <div className={styles.resetIcon}>✉️</div>
            <div className={styles.resetTitle}>Check your email</div>
            <div className={styles.resetMsg}>We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link.</div>
            <button className={styles.backLink} onClick={() => { setMode('login'); setResetSent(false) }}>← Back to sign in</button>
          </div>
        ) : (
          <form onSubmit={handleReset} className={styles.form}>
            <div className={styles.resetHeading}>Reset your password</div>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                className={styles.input}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
                required
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <button
              type="button"
              className={styles.backLink}
              onClick={() => { setMode('login'); setError('') }}
            >
              ← Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
