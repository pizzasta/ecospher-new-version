import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DUET_MAX_MS, DUET_MIN_MS, duetSupported, openDuetAudio, startDuet } from '../lib/duet'
import type { DuetResult, DuetSession } from '../lib/duet'
import { micErrorReason } from '../lib/audioBudget'
import './DuetModal.css'

type Phase = 'ready' | 'loading' | 'recording' | 'review' | 'posting' | 'posted'

export default function DuetModal({ handle, line, color, loadOriginal, onPost, onClose }: {
  handle: string
  line: string
  color: string
  /** the signal's audio (real clip, or its synthesized voice) */
  loadOriginal: () => Promise<Blob | null>
  /** publish the finished duet; resolves false when it couldn't go out */
  onPost: (result: DuetResult, words: string) => Promise<boolean>
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [error, setError] = useState<string | null>(null)
  const [ms, setMs] = useState(0)
  const [level, setLevel] = useState(0)
  const [result, setResult] = useState<DuetResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [words, setWords] = useState('')
  const sessionRef = useRef<DuetSession | null>(null)
  const rafRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => () => {
    mountedRef.current = false
    cancelAnimationFrame(rafRef.current)
    sessionRef.current?.stop()
  }, [])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const begin = async () => {
    setError(null)
    if (!duetSupported()) { setError('this browser can’t record a duet'); return }
    // the audio context is born inside this tap, before any await (iOS Safari)
    let ctx: AudioContext
    try { ctx = openDuetAudio() } catch { setError('this browser can’t record a duet'); return }
    setPhase('loading')
    const original = await loadOriginal().catch(() => null)
    if (!mountedRef.current || !original) {
      void ctx.close().catch(() => { /* closed */ })
      if (mountedRef.current) { setError('couldn’t pull this signal’s audio — try another'); setPhase('ready') }
      return
    }
    try {
      const session = await startDuet(ctx, original, t => { if (mountedRef.current) setMs(t) })
      if (!mountedRef.current) { session.stop(); return }
      sessionRef.current = session
      setMs(0)
      setPhase('recording')
      const meter = () => { setLevel(session.level()); rafRef.current = requestAnimationFrame(meter) }
      rafRef.current = requestAnimationFrame(meter)
      const res = await session.done
      cancelAnimationFrame(rafRef.current)
      sessionRef.current = null
      if (!mountedRef.current) return
      if (!res) { setError('nothing was captured — try again'); setPhase('ready'); return }
      if (res.durationMs < DUET_MIN_MS) { setError('hold the line at least 3 seconds'); setPhase('ready'); return }
      setResult(res)
      setPreviewUrl(URL.createObjectURL(res.blob))
      setPhase('review')
    } catch (err) {
      if (!mountedRef.current) return
      const reason = micErrorReason(err)
      setError(reason === 'permission' ? 'microphone permission was declined' : reason === 'device' ? 'no microphone answered' : 'the mic wouldn’t open')
      setPhase('ready')
    }
  }

  const retake = () => {
    setResult(null)
    setPreviewUrl(null)
    setMs(0)
    void begin()
  }

  const release = async () => {
    if (!result) return
    setPhase('posting')
    const ok = await onPost(result, words)
    if (!mountedRef.current) return
    if (ok) setPhase('posted')
    else { setError('that one stays unsent — it didn’t pass screening'); setPhase('review') }
  }

  const secs = Math.min(DUET_MAX_MS, ms) / 1000
  const left = Math.max(0, (DUET_MAX_MS - ms) / 1000)

  // portaled to <body> so no card transform or stacking context can trap it under the nav
  return createPortal(
    <div className="duet-overlay" onClick={onClose}>
      <div
        className="duet-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Duet with @${handle}`}
        style={{ '--duet-color': color } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" className="duet-close" onClick={onClose} aria-label="close">✕</button>
        <div className="duet-kicker">DUET // TWO VOICES, ONE SIGNAL</div>
        <div className="duet-target">⧉ over @{handle}</div>
        <p className="duet-line">“{line.length > 90 ? `${line.slice(0, 90)}…` : line}”</p>

        <div className={`duet-stage duet-stage--${phase}`} aria-hidden="true">
          <div className="duet-track duet-track--them"><span>them</span><i style={{ width: phase === 'recording' ? `${Math.min(100, (ms / DUET_MAX_MS) * 100)}%` : phase === 'ready' || phase === 'loading' ? '0%' : '100%' }} /></div>
          <div className="duet-track duet-track--you"><span>you</span><i style={{ width: phase === 'recording' ? `${Math.min(100, (ms / DUET_MAX_MS) * 100)}%` : phase === 'ready' || phase === 'loading' ? '0%' : '100%', opacity: phase === 'recording' ? 0.45 + level * 0.55 : 1 }} /></div>
        </div>

        {phase === 'ready' && (
          <>
            <p className="duet-hint">their signal plays in your ears while you answer over it. up to {DUET_MAX_MS / 1000}s. headphones keep the line clean.</p>
            <button type="button" className="duet-go" onClick={() => void begin()}>● start duet</button>
          </>
        )}
        {phase === 'loading' && <p className="duet-hint" role="status">locking onto their frequency…</p>}
        {phase === 'recording' && (
          <>
            <p className="duet-live" role="status"><b>● LIVE</b> {secs.toFixed(1)}s · {left.toFixed(0)}s left</p>
            <button type="button" className="duet-go duet-go--stop" onClick={() => sessionRef.current?.stop()} disabled={ms < DUET_MIN_MS}>
              {ms < DUET_MIN_MS ? 'keep going…' : '■ lock it in'}
            </button>
          </>
        )}
        {(phase === 'review' || phase === 'posting') && previewUrl && (
          <>
            <audio className="duet-preview" src={previewUrl} controls preload="auto" />
            <input
              className="duet-words"
              type="text"
              maxLength={80}
              placeholder="add a few words (optional)"
              value={words}
              onChange={e => setWords(e.target.value)}
              aria-label="words to go with your duet"
            />
            <div className="duet-actions">
              <button type="button" className="duet-retake" onClick={retake} disabled={phase === 'posting'}>↺ retake</button>
              <button type="button" className="duet-go" onClick={() => void release()} disabled={phase === 'posting'}>
                {phase === 'posting' ? 'transmitting…' : 'release duet ∿'}
              </button>
            </div>
          </>
        )}
        {phase === 'posted' && (
          <>
            <p className="duet-done" role="status">⧉ duet is live on the feed</p>
            <button type="button" className="duet-go" onClick={onClose}>back to the feed</button>
          </>
        )}
        {error && <p className="duet-error" role="alert">{error}</p>}
      </div>
    </div>,
    document.body,
  )
}
