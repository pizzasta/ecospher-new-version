import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  makeParticipants, simCarrierIndex, carrierTurn, carrierRemaining, clock,
  HOLD_MS, YOUR_CAP_MS,
} from '../lib/carrierRoom'
import type { Participant } from '../lib/carrierRoom'
import { readAvatar, sigilGlyph } from '../lib/avatar'
import { playSampleBuffer, stopPreviewBuffer } from '../lib/sampleAudio'
import './CarrierRoom.css'

// One frequency, one carrier. You arrive as a listener (always); request the
// carrier to join the queue; hold it when it reaches you, capped and yielding
// gently. Anonymous sigils only. Simulated carriers for this local slice.

type YouState = 'listening' | 'queued' | 'carrier'
interface Reaction { id: number; glyph: string; color: string; left: number }

export default function CarrierRoom({ frequency, onLeave, seed = 7 }: {
  frequency: { label: string; hz: string }
  onLeave: () => void
  seed?: number
}) {
  const participants = useMemo<Participant[]>(() => makeParticipants(seed, 6), [seed])
  const you = useMemo(() => ({ sigil: sigilGlyph(readAvatar()) || '◉', color: '#9ae8ff' }), [])

  const [now, setNow] = useState(() => Date.now())
  const [youState, setYouState] = useState<YouState>('listening')
  const [youMuted, setYouMuted] = useState(true)
  const [note, setNote] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Reaction[]>([])
  const yourStartRef = useRef(0)
  const queuedTurnRef = useRef<number | null>(null)
  const lastCarrierKeyRef = useRef<string>('')

  const flash = (text: string) => { setNote(text); window.setTimeout(() => setNote(n => (n === text ? null : n)), 4200) }

  // the clock
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  // carrier resolution + hand-off
  const simIdx = simCarrierIndex(now, participants.length)
  const simCarrier = participants[simIdx]
  const youAreCarrier = youState === 'carrier'
  const activeColor = youAreCarrier ? you.color : simCarrier.color
  const activeSigil = youAreCarrier ? you.sigil : simCarrier.sigil

  useEffect(() => {
    if (youState === 'queued' && queuedTurnRef.current !== null && carrierTurn(now) > queuedTurnRef.current) {
      queuedTurnRef.current = null
      yourStartRef.current = now
      setYouState('carrier')
      setYouMuted(false)
      flash("the carrier's yours · you're on the air")
    }
    if (youState === 'carrier' && now - yourStartRef.current >= YOUR_CAP_MS) {
      setYouState('listening')
      setYouMuted(true)
      flash('your turn faded · passing it on')
    }
  }, [now, youState])

  // a soft murmur each time the carrier passes — the room never sits dead
  useEffect(() => {
    const key = youAreCarrier ? 'you' : simCarrier.id
    if (key !== lastCarrierKeyRef.current) {
      lastCarrierKeyRef.current = key
      if (!youAreCarrier || !youMuted) {
        const s = key === 'you' ? 4242 : simIdx * 313 + 17
        void playSampleBuffer(simIdx % 3 === 0 ? 'whisper' : 'voice', s, 4200, 0.1)
      }
    }
  }, [simCarrier.id, youAreCarrier, youMuted, simIdx])

  // drift away → your signal drops to static
  useEffect(() => {
    const onHidden = () => {
      if (document.hidden) {
        if (youState === 'carrier') { setYouState('listening'); setYouMuted(true); flash('you drifted — your signal dropped to static') }
        else if (youState === 'queued') { queuedTurnRef.current = null; setYouState('listening'); flash('you drifted off the line') }
      }
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [youState])

  useEffect(() => () => { stopPreviewBuffer() }, [])

  const requestCarrier = () => {
    queuedTurnRef.current = carrierTurn(now)
    setYouState('queued')
    flash('you requested the carrier · you’re next when it passes')
  }
  const leaveQueue = () => { queuedTurnRef.current = null; setYouState('listening'); flash('you stepped out of line') }
  const yieldCarrier = () => { setYouState('listening'); setYouMuted(true); flash('you let the carrier go') }

  const react = (glyph: string) => {
    const r: Reaction = { id: Date.now() + Math.random(), glyph, color: activeColor, left: 30 + Math.random() * 40 }
    setReactions(prev => [...prev, r])
    window.setTimeout(() => setReactions(prev => prev.filter(x => x.id !== r.id)), 1600)
    void playSampleBuffer('tone', Math.floor(Math.random() * 800) + 200, 700, 0.06)
  }

  // breathing waveform level
  const level = youAreCarrier && youMuted ? 0.12 : 0.45 + Math.sin(now / 700) * 0.25
  const remaining = youAreCarrier ? YOUR_CAP_MS - (now - yourStartRef.current) : carrierRemaining(now)
  const remainPct = youAreCarrier ? Math.max(0, remaining / YOUR_CAP_MS) : remaining / HOLD_MS

  const nextUp = [1, 2, 3].map(k => participants[(simIdx + k) % participants.length])
  const listeners = participants.filter((_, i) => i !== simIdx)

  return (
    <div className="carrier-room" style={{ '--carrier-color': activeColor } as CSSProperties}>
      <div className="cr-atmosphere" aria-hidden="true"><span /><span /><span /></div>

      <header className="cr-head">
        <div className="cr-freq">
          <span className="cr-freq-glyph" aria-hidden="true">∿</span>
          <div>
            <strong>{frequency.hz} · {frequency.label}</strong>
            <em>{participants.length} drifting here · queue mode</em>
          </div>
        </div>
        <button type="button" className="cr-leave" onClick={onLeave} aria-label="leave the frequency">✕</button>
      </header>

      {/* the carrier — one breathing sigil */}
      <div className="cr-carrier-zone">
        <div className={`cr-carrier${youAreCarrier ? ' cr-carrier--you' : ''}${youAreCarrier && youMuted ? ' cr-carrier--muted' : ''}`}>
          <span className="cr-carrier-halo" aria-hidden="true" />
          <span className="cr-carrier-sigil">{activeSigil}</span>
          <span className="cr-carrier-ring" style={{ '--remain': remainPct.toFixed(3) } as CSSProperties} aria-hidden="true" />
          {reactions.map(r => (
            <span key={r.id} className="cr-reaction" style={{ left: `${r.left}%`, color: r.color }}>{r.glyph}</span>
          ))}
        </div>
        <div className="cr-wave" aria-hidden="true" style={{ '--level': level.toFixed(2) } as CSSProperties}>
          {Array.from({ length: 28 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}
        </div>
        <div className="cr-carrier-status" role="status">
          {youAreCarrier
            ? (youMuted ? 'you hold the carrier · unmute to speak' : `on the air · ${clock(remaining)} left`)
            : `on the air · ${clock(remaining)} left`}
        </div>
      </div>

      {/* the queue */}
      <div className="cr-zone">
        <span className="cr-zone-label">next on the frequency</span>
        <div className="cr-queue">
          {youState === 'queued' && (
            <span className="cr-q-sigil cr-q-sigil--you" style={{ color: you.color }} title="you · next">{you.sigil}<i>you</i></span>
          )}
          {nextUp.map((p, i) => (
            <span key={p.id} className="cr-q-sigil" style={{ color: p.color }} title={`#${i + 1} in line`}>{p.sigil}</span>
          ))}
        </div>
      </div>

      {/* drifting listeners */}
      <div className="cr-zone">
        <span className="cr-zone-label">drifting here</span>
        <div className="cr-drift">
          {listeners.map((p, i) => (
            <span key={p.id} className="cr-drift-sigil" style={{ color: p.color, animationDelay: `${-i * 1.7}s` }}>{p.sigil}</span>
          ))}
        </div>
      </div>

      {note && <div className="cr-note" role="status">{note}</div>}

      {/* controls */}
      <footer className="cr-controls">
        {youState === 'listening' && (
          <button type="button" className="cr-btn cr-btn--primary" onClick={requestCarrier}>◌ request the carrier</button>
        )}
        {youState === 'queued' && (
          <button type="button" className="cr-btn" onClick={leaveQueue}>step out of line</button>
        )}
        {youState === 'carrier' && (
          <>
            <button type="button" className={`cr-btn cr-btn--mute${youMuted ? ' on' : ''}`} onClick={() => setYouMuted(m => !m)}>
              {youMuted ? '∿ take the carrier' : '🔇 self-mute'}
            </button>
            <button type="button" className="cr-btn" onClick={yieldCarrier}>let it go</button>
          </>
        )}
        <button type="button" className="cr-btn cr-btn--react" onClick={() => react('∿')}>∿ resonate</button>
        <button type="button" className="cr-btn cr-btn--react" onClick={() => react('◌')}>◌ stay</button>
        <button type="button" className="cr-btn cr-btn--leave" onClick={onLeave}>↑ leave quietly</button>
      </footer>

      {youState === 'listening' && (
        <p className="cr-floor-note">you're listening. request the carrier when you want to be heard.</p>
      )}
    </div>
  )
}
