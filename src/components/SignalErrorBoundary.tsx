import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { recoverFromCrash } from '../lib/recovery'

type Props = { children: ReactNode }
type State = { hasError: boolean; confirmReset: boolean }

/**
 * Last-resort boundary: if anything throws during render, show a themed
 * recovery screen instead of a blank page. A bare reload can loop forever on a
 * deterministic crash (e.g. malformed persisted state), so we also offer a
 * "reset & recover" escape hatch that clears local state before reloading.
 */
export default class SignalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, confirmReset: false }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ecosphere] signal interrupted:', error, info.componentStack)
  }

  private handleReset = () => {
    if (!this.state.confirmReset) {
      this.setState({ confirmReset: true })
      return
    }
    // clears service worker, caches, localStorage + audio db, then reloads
    void recoverFromCrash()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { confirmReset } = this.state

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
        <p style={{ color: 'rgba(180, 190, 220, 0.6)', fontSize: '13px', margin: 0, maxWidth: '340px' }}>
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
        <button
          onClick={this.handleReset}
          style={{
            background: 'transparent',
            border: 'none',
            color: confirmReset ? '#ff9bb4' : 'rgba(150, 160, 190, 0.55)',
            cursor: 'pointer',
            fontSize: '11px',
            letterSpacing: '0.06em',
            marginTop: '2px',
            padding: '6px 12px',
            textDecoration: 'underline',
          }}
          type="button"
        >
          {confirmReset ? 'tap again to clear this device & start fresh' : 'still stuck? reset & recover'}
        </button>
      </main>
    )
  }
}
