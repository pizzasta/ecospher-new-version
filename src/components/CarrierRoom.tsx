import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  makeParticipants, simCarrierIndex, carrierTurn, carrierRemaining, ringIndex, roundRobinIsYou,
  clock, FLOW_MODES, HOLD_MS, YOUR_CAP_MS,
} from '../lib/carrierRoom'
import type { Participant, FlowMode } from '../lib/carrierRoom'
import { readAvatar, sigilGlyph } from '../lib/avatar'
import { playSampleBuffer, stopPreviewBuffer } from '../lib/sampleAudio'
import { joinCarrierRoom, liveRoomsEnabled } from '../lib/carrierRoomLive'
import type { CarrierRoomSession, LivePeer } from '../lib/carrierRoomLive'
import { resolveSignalState, SIGNAL_GLYPH } from '../lib/signalState'
import RoomAtmosphere from './RoomAtmosphere'
import './CarrierRoom.css'

// half-thoughts that surface through the band when no one's saying much
const CR_AMBIENT = [
  'someone stayed longer than they meant to.',
  'still here.',
  'the frequency held.',
  'nobody left yet.',
  'quiet, but not empty.',
  'we drifted in at the same time.',
] as const

// One frequency. The keeper sets the flow; the carrier passes accordingly. You
// always arrive a listener. Anonymous sigils only. Simulated for this local
// slice — the same state machine will drive real-time audio later.

type YouState = 'listening' | 'queued' | 'carrier'
interface Reaction { id: number; glyph: string; color: string; left: number }

export default function CarrierRoom({ frequency, onLeave, seed = 7, keeper = true, recovered }: {
  frequency: { label: string; hz: string }
  onLeave: () => void
  seed?: number
  keeper?: boolean
  recovered?: { quietLabel: string }
}) {
  const participants = useMemo<Participant[]>(() => makeParticipants(seed, 6), [seed])
  const count = participants.length
  const you = useMemo(() => ({ sigil: sigilGlyph(readAvatar()) || '◉', color: '#9ae8ff' }), [])

  const [now, setNow] = useState(() => Date.now())
  const [mode, setMode] = useState<FlowMode>('queue')
  const [hushed, setHushed] = useState(false)
  const [nudge, setNudge] = useState(0) // shifts the sim rotation when the keeper clears
  const [youState, setYouState] = useState<YouState>('listening')
  const [youMuted, setYouMuted] = useState(true)
  const [note, setNote] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [livePeers, setLivePeers] = useState<LivePeer[]>([])
  const [unsettled, setUnsettled] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const yourStartRef = useRef(0)
  const queuedTurnRef = useRef<number | null>(null)
  const lastKeyRef = useRef('')
  const rrMineRef = useRef(false)
  const sessionRef = useRef<CarrierRoomSession | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)
  const nudgeRef = useRef(0)
  const youMutedRef = useRef(youMuted)
  useEffect(() => { youMutedRef.current = youMuted }, [youMuted])

  const flash = (text: string) => { setNote(text); window.setTimeout(() => setNote(n => (n === text ? null : n)), 4200) }

  const pushReaction = (glyph: string, color: string) => {
    const r: Reaction = { id: Date.now() + Math.random(), glyph, color, left: 30 + Math.random() * 40 }
    setReactions(prev => [...prev, r])
    window.setTimeout(() => setReactions(prev => prev.filter(x => x.id !== r.id)), 1600)
  }

  // real-time presence + reactions when a backend is configured (turn state
  // stays local here; the keeper-authoritative reducer is ready to drive it)
  useEffect(() => {
    if (!liveRoomsEnabled) return
    const session = joinCarrierRoom(
      'quiet-hours',
      { sigil: you.sigil, color: you.color, keeper, mode: 'queue' },
      { onPeers: setLivePeers, onReaction: glyph => pushReaction(glyph, '#9ae8ff') },
    )
    sessionRef.current = session
    return () => { session?.leave(); sessionRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const simNow = now + nudge
  const simIdx = simCarrierIndex(simNow, count)
  const simCarrier = participants[simIdx]

  // who holds the carrier, by mode
  const rrMine = mode === 'round-robin' && !hushed && roundRobinIsYou(simNow, count)
  const youAreCarrier = !hushed && mode !== 'listen-only' && (mode === 'round-robin' ? rrMine : youState === 'carrier')

  let primary: { sigil: string; color: string; isYou: boolean } | null = null
  let secondary: { sigil: string; color: string } | null = null
  if (!hushed && mode !== 'listen-only') {
    if (mode === 'round-robin') {
      const idx = ringIndex(simNow, count)
      primary = idx === count
        ? { sigil: you.sigil, color: you.color, isYou: true }
        : { sigil: participants[idx].sigil, color: participants[idx].color, isYou: false }
    } else if (mode === 'open-drift') {
      primary = { sigil: simCarrier.sigil, color: simCarrier.color, isYou: false }
      if (youState === 'carrier') secondary = { sigil: you.sigil, color: you.color }
    } else {
      primary = youState === 'carrier'
        ? { sigil: you.sigil, color: you.color, isYou: true }
        : { sigil: simCarrier.sigil, color: simCarrier.color, isYou: false }
    }
  }
  const activeColor = primary?.color ?? '#5a607e'
  const carrierState = primary
    ? resolveSignalState({ hushed, isCarrier: true, muted: primary.isYou ? youMuted : false })
    : (hushed ? 'hushed' : 'drifting')
  const staticWave = carrierState === 'held-dark' || carrierState === 'hushed'

  // real mic when you hold the carrier — the basis for mute, level, and
  // fail-closed mute-failure handling. Untouched when there's no mic API.
  const releaseMic = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (ctxRef.current) { void ctxRef.current.close().catch(() => {}); ctxRef.current = null }
    setMicLevel(0)
  }

  useEffect(() => {
    if (!youAreCarrier || hushed) { releaseMic(); return }
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
    if (!md?.getUserMedia) return // no mic API here — run the sim, no fault
    let cancelled = false
    void md.getUserMedia({ audio: true }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      setUnsettled(false)
      stream.getAudioTracks()[0]?.addEventListener('ended', () => {
        // fail closed: the mic dropped out mid-turn → drop off the carrier
        setUnsettled(true); setYouState('listening'); setYouMuted(true); flash('your signal dropped — re-tune the mic')
      })
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctx) return
        const ctx = new Ctx(); ctxRef.current = ctx
        const analyser = ctx.createAnalyser(); analyser.fftSize = 256
        ctx.createMediaStreamSource(stream).connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const loop = () => {
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v }
          const lvl = Math.min(1, Math.sqrt(sum / data.length) * 3)
          setMicLevel(lvl)
          if (youMutedRef.current && lvl > 0.22 && Date.now() - nudgeRef.current > 10000) {
            nudgeRef.current = Date.now()
            flash('you’re muted — unmute to be heard')
          }
          rafRef.current = requestAnimationFrame(loop)
        }
        loop()
      } catch { /* analyser is optional */ }
    }).catch(() => {
      if (cancelled) return
      // a real mute/mic failure → fail closed: leave the carrier, don't broadcast
      setUnsettled(true); setYouState('listening'); setYouMuted(true)
      flash('your signal won’t settle — re-tune the mic')
    })
    return () => { cancelled = true; releaseMic() }
  }, [youAreCarrier, hushed])

  useEffect(() => () => releaseMic(), [])

  // request-mode promotion / cap (queue + open-drift; keeper-led waits for a grant)
  useEffect(() => {
    if (mode === 'queue' && youState === 'queued' && queuedTurnRef.current !== null && carrierTurn(simNow) > queuedTurnRef.current) {
      queuedTurnRef.current = null
      yourStartRef.current = now
      setYouState('carrier'); setYouMuted(false)
      flash("the carrier's yours · you're on the air")
    }
    if (youState === 'carrier' && now - yourStartRef.current >= YOUR_CAP_MS) {
      setYouState('listening'); setYouMuted(true)
      flash('your turn faded · passing it on')
    }
  }, [now, simNow, youState, mode])

  // round-robin: the carrier comes to you on your slot, no asking
  useEffect(() => {
    if (mode !== 'round-robin') { rrMineRef.current = false; return }
    if (rrMine && !rrMineRef.current) { rrMineRef.current = true; setYouMuted(false); flash('the carrier came to you · unmute to speak') }
    if (!rrMine && rrMineRef.current) { rrMineRef.current = false; setYouMuted(true) }
  }, [rrMine, mode])

  // a soft murmur each time the carrier changes — the room never sits dead
  useEffect(() => {
    const key = hushed ? 'hush' : mode === 'listen-only' ? 'listen' : (primary?.isYou ? 'you' : (primary?.sigil ?? '') + simIdx)
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key
      if (!hushed && mode !== 'listen-only' && !(primary?.isYou && youMuted)) {
        void playSampleBuffer(simIdx % 3 === 0 ? 'whisper' : 'voice', simIdx * 313 + 17, 4200, 0.1)
      }
    }
  }, [primary?.sigil, primary?.isYou, hushed, mode, youMuted, simIdx])

  // drift away → your signal drops to static
  useEffect(() => {
    const onHidden = () => {
      if (!document.hidden) return
      if (youState === 'carrier') { setYouState('listening'); setYouMuted(true); flash('you drifted — your signal dropped to static') }
      else if (youState === 'queued') { queuedTurnRef.current = null; setYouState('listening'); flash('you drifted off the line') }
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  }, [youState])

  useEffect(() => () => { stopPreviewBuffer() }, [])

  const resetForMode = (next: FlowMode) => {
    setMode(next); setHushed(false); setYouState('listening'); setYouMuted(true)
    queuedTurnRef.current = null; rrMineRef.current = false
    flash(FLOW_MODES.find(f => f.value === next)?.hint ?? '')
  }

  const liveCarrierCount = (primary ? 1 : 0) + (secondary ? 1 : 0)

  const requestCarrier = () => {
    if (mode === 'open-drift') {
      if (liveCarrierCount < 2) { yourStartRef.current = now; setYouState('carrier'); setYouMuted(false); flash('you joined the carrier') }
      else { queuedTurnRef.current = carrierTurn(simNow); setYouState('queued'); flash('two carriers already — you’re next') }
      return
    }
    queuedTurnRef.current = carrierTurn(simNow)
    setYouState('queued')
    flash(mode === 'keeper-led' ? 'you raised your signal · waiting on the keeper' : 'you requested the carrier · you’re next when it passes')
  }
  const leaveQueue = () => { queuedTurnRef.current = null; setYouState('listening'); flash('you stepped out of line') }
  const yieldCarrier = () => { setYouState('listening'); setYouMuted(true); flash('you let the carrier go') }

  // keeper controls
  const grantSelf = () => { yourStartRef.current = now; queuedTurnRef.current = null; setYouState('carrier'); setYouMuted(false); flash('the keeper handed you the carrier') }
  const clearFrequency = () => {
    if (youAreCarrier) { setYouState('listening'); setYouMuted(true) }
    setNudge(n => n + carrierRemaining(simNow))
    flash('the keeper cleared the frequency')
  }
  const toggleHush = () => {
    setHushed(h => {
      const next = !h
      flash(next ? 'the frequency went quiet · everyone’s just here now' : 'the band opened back up')
      return next
    })
  }

  const react = (glyph: string) => {
    pushReaction(glyph, activeColor)
    sessionRef.current?.react(glyph)
    void playSampleBuffer('tone', Math.floor(Math.random() * 800) + 200, 700, 0.06)
  }

  const level = !primary || (primary.isYou && youMuted) ? 0.12
    : primary.isYou && streamRef.current ? Math.max(0.15, micLevel)
    : 0.45 + Math.sin(now / 700) * 0.25
  const remaining = youAreCarrier && mode !== 'round-robin' ? YOUR_CAP_MS - (now - yourStartRef.current) : carrierRemaining(simNow)
  const remainPct = youAreCarrier && mode !== 'round-robin' ? Math.max(0, remaining / YOUR_CAP_MS) : remaining / HOLD_MS
  const nextUp = [1, 2, 3].map(k => participants[(simIdx + k) % count])
  const listeners = participants.filter((_, i) => i !== simIdx)

  const statusLine = hushed
    ? 'hushed · just the ambient band'
    : mode === 'listen-only'
      ? 'a listening frequency · drop an async signal anytime'
      : primary?.isYou && youMuted
        ? 'you hold the carrier · unmute to speak'
        : `on the air · ${clock(remaining)} left`

  return (
    <div className="carrier-room" style={{ '--carrier-color': activeColor } as CSSProperties}>
      <RoomAtmosphere
        accent={activeColor}
        level={level}
        whisperLines={hushed || mode === 'listen-only' || !primary ? CR_AMBIENT : undefined}
      />
      <div className={`cr-vignette${hushed ? ' cr-vignette--hushed' : ''}`} aria-hidden="true" />

      <header className="cr-head">
        <div className="cr-freq">
          <span className="cr-freq-glyph" aria-hidden="true">∿</span>
          <div className="cr-freq-text">
            <span className="cr-freq-hz">{frequency.hz}<i>Hz</i></span>
            <strong className="cr-freq-name">{frequency.label}</strong>
            <em>
              {livePeers.length > 0 ? <span className="cr-live">◉ live · {livePeers.length}</span> : `${count} drifting here`}
              {' · '}{FLOW_MODES.find(f => f.value === mode)?.label} mode
            </em>
          </div>
        </div>
        <button type="button" className="cr-leave" onClick={onLeave} aria-label="leave the frequency">✕</button>
      </header>

      {recovered && (
        <div className="cr-recovered" role="status">
          <span aria-hidden="true">↺</span> recovered frequency · {recovered.quietLabel} · you're the first carrier back — muted until you're ready
        </div>
      )}

      {unsettled && (
        <div className="cr-unsettled" role="alert">
          <span aria-hidden="true">⚠</span> your signal won't settle — the mic didn't come through. you've dropped to listening.
          <button type="button" className="cr-retune" onClick={() => { setUnsettled(false); requestCarrier() }}>re-tune</button>
        </div>
      )}

      {/* keeper: flow-mode selector */}
      {keeper && (
        <div className="cr-keeper">
          <span className="cr-keeper-label">keeper · flow</span>
          <div className="cr-modes" role="radiogroup" aria-label="Flow mode">
            {FLOW_MODES.map(f => (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={mode === f.value}
                className={`cr-mode${mode === f.value ? ' on' : ''}`}
                title={f.hint}
                onClick={() => resetForMode(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* the carrier */}
      <div className="cr-carrier-zone">
        {primary ? (
          <>
            <div className={`cr-carrier${primary.isYou ? ' cr-carrier--you' : ''}${primary.isYou && youMuted ? ' cr-carrier--muted' : ''}`}>
              <span className="cr-carrier-halo" aria-hidden="true" />
              <span className="cr-carrier-sigil">{primary.sigil}</span>
              <span className="cr-carrier-state" aria-hidden="true">{SIGNAL_GLYPH[carrierState]}</span>
              <span className="cr-carrier-ring" style={{ '--remain': remainPct.toFixed(3) } as CSSProperties} aria-hidden="true" />
              {reactions.map(r => (
                <span key={r.id} className="cr-reaction" style={{ left: `${r.left}%`, color: r.color }}>{r.glyph}</span>
              ))}
            </div>
            {secondary && (
              <span className="cr-cocarrier" style={{ color: secondary.color }} title="second carrier (open drift)">+ {secondary.sigil} you</span>
            )}
          </>
        ) : (
          <div className="cr-carrier cr-carrier--empty" aria-hidden="true">
            <span className="cr-carrier-sigil">{hushed ? '◌' : '·'}</span>
          </div>
        )}
        <div className={`cr-wave${staticWave ? ' cr-wave--static' : ''}`} aria-hidden="true" style={{ '--level': level.toFixed(2) } as CSSProperties}>
          {Array.from({ length: 28 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}
        </div>
        <div className="cr-carrier-status" role="status">{statusLine}</div>
      </div>

      {/* the queue */}
      {mode !== 'listen-only' && mode !== 'round-robin' && (
        <div className="cr-zone">
          <span className="cr-zone-label">next on the frequency</span>
          <div className="cr-queue">
            {youState === 'queued' && (
              <span className="cr-q-sigil cr-q-sigil--you" style={{ color: you.color }} title="you · waiting">
                {you.sigil}<i>you</i>
                {keeper && mode === 'keeper-led' && (
                  <button type="button" className="cr-grant" onClick={grantSelf}>grant</button>
                )}
              </span>
            )}
            {nextUp.map((p, i) => (
              <span key={p.id} className="cr-q-sigil" style={{ color: p.color }} title={`#${i + 1} in line`}>{p.sigil}</span>
            ))}
          </div>
        </div>
      )}

      {/* drifting listeners */}
      <div className="cr-zone">
        <span className="cr-zone-label">drifting here</span>
        <div className="cr-drift">
          {livePeers.map((p, i) => (
            <span key={p.key} className="cr-drift-sigil cr-drift-sigil--live" style={{ color: p.color, animationDelay: `${-i * 1.3}s` }} title="here right now">{p.sigil}</span>
          ))}
          {listeners.map((p, i) => (
            <span key={p.id} className="cr-drift-sigil" style={{ color: p.color, animationDelay: `${-i * 1.7}s` }}>{p.sigil}</span>
          ))}
        </div>
      </div>

      {note && <div className="cr-note" role="status">{note}</div>}

      {/* keeper controls */}
      {keeper && (
        <div className="cr-keeper-controls">
          <button type="button" className="cr-btn cr-btn--keeper" onClick={clearFrequency} disabled={hushed || mode === 'listen-only'}>⊘ clear the frequency</button>
          <button type="button" className={`cr-btn cr-btn--keeper${hushed ? ' on' : ''}`} onClick={toggleHush}>{hushed ? '∿ open the band' : '🔇 hush all'}</button>
        </div>
      )}

      {/* your controls */}
      <footer className="cr-controls">
        {mode !== 'round-robin' && mode !== 'listen-only' && youState === 'listening' && (
          <button type="button" className="cr-btn cr-btn--primary" onClick={requestCarrier}>
            {mode === 'open-drift' ? '◌ join the carrier' : '◌ request the carrier'}
          </button>
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
        {mode === 'round-robin' && rrMine && (
          <button type="button" className={`cr-btn cr-btn--mute${youMuted ? ' on' : ''}`} onClick={() => setYouMuted(m => !m)}>
            {youMuted ? '∿ unmute · it’s your turn' : '🔇 self-mute'}
          </button>
        )}
        <button type="button" className="cr-btn cr-btn--react" onClick={() => react('∿')}>∿ resonate</button>
        <button type="button" className="cr-btn cr-btn--react" onClick={() => react('◌')}>◌ stay</button>
        <button type="button" className="cr-btn cr-btn--leave" onClick={onLeave}>↑ leave quietly</button>
      </footer>

      {mode === 'round-robin' && !rrMine && <p className="cr-floor-note">round-robin · the carrier comes to everyone in turn. yours is coming.</p>}
      {mode === 'listen-only' && <p className="cr-floor-note">a listening frequency — no live carriers, just signals drifting through.</p>}
      {mode !== 'round-robin' && mode !== 'listen-only' && youState === 'listening' && (
        <p className="cr-floor-note">you're listening. request the carrier when you want to be heard.</p>
      )}
    </div>
  )
}
