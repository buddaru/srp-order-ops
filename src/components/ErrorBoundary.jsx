import { Component } from 'react'
import * as Sentry from '@sentry/react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('Uncaught error:', error, info)
    Sentry.captureException(error, { extra: info })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '24px',
        background: 'var(--bg, #faf9f7)',
        fontFamily: "'DM Sans', sans-serif",
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '40px' }}>⚠️</div>
        <div style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--text, #131710)',
          letterSpacing: '-0.02em',
        }}>
          Something went wrong
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-muted, #6B7280)', maxWidth: '400px', lineHeight: 1.6 }}>
          An unexpected error occurred. Your data is safe — refresh the page to continue.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '8px',
            background: '#131710',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 22px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Refresh page
        </button>
        {process.env.NODE_ENV === 'development' && this.state.error && (
          <pre style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            fontSize: '11px',
            color: '#DC2626',
            textAlign: 'left',
            maxWidth: '600px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}>
            {this.state.error.toString()}
          </pre>
        )}
      </div>
    )
  }
}
