import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { clearStaleBuild, recoverFromCrash } from '../lib/recovery'
import { rearmStorageHeal } from '../lib/storageHeal'
import { CRASH_LOOP_THRESHOLD, clearCrashLog, isCrashLooping, recordCrash } from '../lib/crashLoop'

type Props = { children: ReactNode }
type State = { hasError: boolean; confirmReset: boolean; looping: boolean }

const HEALTHY_BOOT_MS = 8000

/**
 * Last-resort boundary: if anything throws during render, show a themed
 * recovery screen instead of a blank page.
 *
 * A bare reload can loop forever on a deterministic crash (e.g. malformed
 * persisted state), so recovery is layered:
 *  - "re-tune" re-arms the boot-time storage heal before reloading, so the next
 *    boot can re-sanitize persisted data instead of fast-pathing past it.
 *  - once crashes repeat past a threshold (a true loop the reload can't fix),
 *    we escalate automatically and lead with the "reset & recover" escape hatch
 *    that clears local state, so the user is never stranded on this screen.
 */
export default class SignalErrorBoundary extends Component<Props, State> {
  // seed from prior reloads: a boundary constructed after a loop already knows.
  state: State = { hasError: false, confirmReset: false, looping: isCrashLooping() }

  private healthyTimer?: number

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  componentDidMount() {
    // a boot that mounts without crashing is healthy — forget past crashes after
    // a short grace period so a stale loop count can't escalate a later,
    // unrelated error. if we mounted straight into the fallback, leave it be.
    if (!this.state.hasError) {
      this.healthyTimer = window.setTimeout(() => clearCrashLog(), HEALTHY_BOOT_MS)
    }
  }

  componentWillUnmount() {
    if (this.healthyTimer) window.clearTimeout(this.healthyTimer)
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ecosphere] signal interrupted:', error, info.componentStack)
    // never let a pending "healthy boot" timer wipe the crash we just recorded.
    if (this.healthyTimer) { window.clearTimeout(this.healthyTimer); this.healthyTimer = undefined }
    const count = recordCrash()
    if (count >= CRASH_LOOP_THRESHOLD && !this.state.looping) {
      this.setState({ looping: true })
    }
  }

  private handleRetune = () => {
    // re-sanitize persisted state on the next boot, then drop stale SW/cache and
    // reload. the heal re-run is what breaks data-induced loops a bare reload
    // can't. never let a stuck unregister block the reload.
    rearmStorageHeal()
    void clearStaleBuild().finally(() => window.location.reload())
  }

  private handleReset = () => {
    if (!this.state.confirmReset) {
      this.setState({ confirmReset: true })
      return
    }
    // clears service worker, caches, localStorage + audio db, then reloads
    clearCrashLog()
    void recoverFromCrash()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { confirmReset, looping } = this.state

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
        <h1 style={{ fontSize: '26px', fontWeight: 900, margin: 0 }}>
          {looping ? 'the signal keeps dropping' : 'the frequency dropped for a moment'}
        </h1>
        <p style={{ color: 'rgba(180, 190, 220, 0.6)', fontSize: '13px', margin: 0, maxWidth: '340px' }}>
          {looping
            ? 'something on this device keeps interrupting the signal. clearing it will get you back in — nothing on your account is lost.'
            : 'nothing was lost. re-tune to rejoin the ecosystem.'}
        </p>

        {/* When looping, lead with the reset that actually clears the cause; a
            plain re-tune has already failed, so it drops to the secondary slot. */}
        {looping ? (
          <>
            <button
              onClick={this.handleReset}
              style={primaryButtonStyle}
              type="button"
            >
              {confirmReset ? 'tap again to clear this device & start fresh' : 'clear this device & recover'}
            </button>
            <button
              onClick={this.handleRetune}
              style={secondaryButtonStyle}
              type="button"
            >
              try a plain re-tune instead
            </button>
          </>
        ) : (
          <>
            <button
              onClick={this.handleRetune}
              style={primaryButtonStyle}
              type="button"
            >
              re-tune signal
            </button>
            <button
              onClick={this.handleReset}
              style={{ ...secondaryButtonStyle, color: confirmReset ? '#ff9bb4' : secondaryButtonStyle.color }}
              type="button"
            >
              {confirmReset ? 'tap again to clear this device & start fresh' : 'still stuck? reset & recover'}
            </button>
          </>
        )}
      </main>
    )
  }
}

const primaryButtonStyle = {
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
} as const

const secondaryButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: 'rgba(150, 160, 190, 0.55)',
  cursor: 'pointer',
  fontSize: '11px',
  letterSpacing: '0.06em',
  marginTop: '2px',
  padding: '6px 12px',
  textDecoration: 'underline',
} as const
