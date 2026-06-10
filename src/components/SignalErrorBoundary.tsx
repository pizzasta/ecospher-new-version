import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/**
 * Last-resort boundary: if anything throws during render, show a themed
 * recovery screen instead of a blank page.
 */
export default class SignalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ecosphere] signal interrupted:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main
        style={{
          alignItems: 'center',
          background: 'radial-gradient(circle at 50% 40%, rgba(255, 45, 120, 0.12), transparent 40%), #030712',
          color: '#f0f4ff',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          gap: '14px',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ color: '#ff2d78', fontSize: '11px', fontWeight: 800, letterSpacing: '0.24em' }}>
          SIGNAL INTERRUPTED
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 900, margin: 0 }}>the frequency dropped for a moment</h1>
        <p style={{ color: 'rgba(180, 190, 220, 0.6)', fontSize: '13px', margin: 0 }}>
          nothing was lost. re-tune to rejoin the ecosystem.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'rgba(255, 45, 120, 0.16)',
            border: '1px solid rgba(255, 45, 120, 0.45)',
            borderRadius: '999px',
            color: '#ff2d78',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            marginTop: '8px',
            padding: '12px 26px',
            textTransform: 'uppercase',
          }}
          type="button"
        >
          re-tune signal
        </button>
      </main>
    )
  }
}
