import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { carrierView } from '../lib/carrierProfile'
import type { CarrierView } from '../lib/carrierProfile'
import { isTuned, toggleTune, carrierTunedCount } from '../lib/carrierFollow'
import { readTraces, addTrace } from '../lib/profileTraces'
import type { Trace } from '../lib/profileTraces'
import { moderatePublicSignalText } from '../lib/signalModeration'
import { playSampleBuffer } from '../lib/sampleAudio'
import { formatRelativeTime } from '../lib/notifications'
import './CarrierProfile.css'

// Tap a handle anywhere → open that carrier's profile. Dispatch:
//   window.dispatchEvent(new CustomEvent('ecosphere:viewCarrier',
//     { detail: { handle, line?, seed? } }))
type ViewDetail = { handle: string; line?: string; seed?: number }

export default function CarrierProfile() {
  const [view, setView] = useState<CarrierView | null>(null)
  const [line, setLine] = useState<string | undefined>(undefined)
  const [seed, setSeed] = useState(0)
  const [tuned, setTuned] = useState(false)
  const [traces, setTraces] = useState<Trace[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onView = (event: Event) => {
      const detail = (event as CustomEvent<ViewDetail>).detail
      if (!detail?.handle) return
      const v = carrierView(detail.handle)
      setView(v)
      setLine(detail.line)
      setSeed(detail.seed ?? Math.abs(Math.round(v.hz * 17)))
      setTuned(isTuned(v.handle))
      setTraces(readTraces(v.handle))
      setDraft(''); setError(null)
    }
    window.addEventListener('ecosphere:viewCarrier', onView)
    return () => window.removeEventListener('ecosphere:viewCarrier', onView)
  }, [])

  if (!view) return null

  const close = () => setView(null)
  const onTune = () => setTuned(toggleTune(view.handle))
  const playAnthem = () => { void playSampleBuffer('voice', seed, 5000, 0.3) }
  const leave = () => {
    const clean = draft.trim().replace(/\s+/g, ' ').slice(0, 80)
    if (!clean) return
    if (moderatePublicSignalText(clean).status === 'flagged') { setError('that one can’t be left here'); return }
    setTraces(addTrace(view.handle, clean)); setDraft(''); setError(null)
  }

  return (
    <div className="carrier-profile-veil" role="dialog" aria-modal="true" aria-label={`carrier ${view.handle}`} onClick={close}>
      <div className="carrier-profile" style={{ '--carrier-color': view.color } as CSSProperties} onClick={e => e.stopPropagation()}>
        <button type="button" className="carrier-close" onClick={close} aria-label="close">✕</button>

        <div className="carrier-head">
          <span className="carrier-sigil" aria-hidden="true">{view.sigil}</span>
          <div className="carrier-id">
            <strong>◈ {view.handle}</strong>
            <span className="carrier-hz">{view.hz.toFixed(1)} Hz</span>
          </div>
          <em className="carrier-weather">{view.weather}</em>
        </div>

        <button type="button" className="carrier-anthem" onClick={playAnthem}>
          <span className="carrier-anthem-play" aria-hidden="true">▶</span>
          <span className="carrier-anthem-meta">
            <strong>their frequency</strong>
            <em>{line ? `"${line.length > 64 ? line.slice(0, 64) + '…' : line}"` : 'tap to hear what they sound like'}</em>
          </span>
        </button>

        <div className="carrier-actions">
          <button type="button" className={`carrier-tune${tuned ? ' on' : ''}`} onClick={onTune}>
            {tuned ? '◉ tuned in' : '◌ tune to this carrier'}
          </button>
          <span className="carrier-tune-count">{carrierTunedCount(view.handle)} tuned in</span>
        </div>

        <div className="carrier-guestbook">
          <span className="carrier-guestbook-label">leave a trace on their frequency</span>
          <div className="carrier-guestbook-row">
            <input
              type="text"
              maxLength={80}
              value={draft}
              aria-label="leave a trace"
              placeholder="say something that drifts…"
              onChange={e => { setDraft(e.target.value); setError(null) }}
              onKeyDown={e => { if (e.key === 'Enter') leave() }}
            />
            <button type="button" onClick={leave}>leave</button>
          </div>
          {error && <span className="carrier-guestbook-error" role="alert">{error}</span>}
          {traces.length > 0 && (
            <ul className="carrier-traces">
              {traces.map(t => (
                <li key={t.id}><span>{t.text}</span><em>{formatRelativeTime(t.at)}</em></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
