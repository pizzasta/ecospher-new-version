import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  castPing, castCooldownRemaining, markCast, lockHarmony, listHarmonies,
  inboundPing, answerPing, playPingTone,
} from '../lib/echolocation'
import type { EchoReturn, LockedHarmony } from '../lib/echolocation'
import { chimeForHandle, playSignatureChime, readChime } from '../lib/signatureChime'
import { getHzProfile, getLocalHzProfile } from '../lib/hzSignature'
import type { HzProfile } from '../lib/hzSignature'
import { isTuned, toggleTune } from '../lib/carrierFollow'
import { getFamiliars, stageLabel } from '../lib/familiarFrequency'
import { speakSignal, speechSupported, cancelSpeech } from '../lib/speech'
import { playSampleBuffer } from '../lib/sampleAudio'
import { useEcosystemState } from '../hooks/useEcosystemState'
import './Echolocation.css'

// Echolocation — the anti-search. Nobody here has a name worth searching
// for, but everybody has a frequency. Cast yours into the dark and the only
// carriers who return are the ones who harmonise with it. You don't browse
// people — you hear whether you fit.

type Phase = 'idle' | 'casting' | 'returned'

const MOOD_GLYPH: Record<string, string> = {
  nocturne: '◑', bloom: '❋', drift: '∿', static: '▒', lost: '◌',
}

export default function Echolocation() {
  const { ecosystemState } = useEcosystemState()
  const identity = ecosystemState.userSignalIdentity ?? 'unclaimed'
  const [me, setMe] = useState<HzProfile>(() => getLocalHzProfile(identity))
  const [phase, setPhase] = useState<Phase>('idle')
  const [returns, setReturns] = useState<EchoReturn[]>([])
  const [pending, setPending] = useState(0)
  const [cooldown, setCooldown] = useState(() => Math.ceil(castCooldownRemaining() / 1000))
  const [locked, setLocked] = useState<string[]>(() => listHarmonies().map(h => h.handle))
  const [tunedTick, setTunedTick] = useState(0)
  const [harmonies, setHarmonies] = useState<LockedHarmony[]>(() => listHarmonies())
  const [inbound, setInbound] = useState<EchoReturn | null>(null)
  const [answered, setAnswered] = useState(false)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    void getHzProfile(identity).then(setMe).catch(() => { /* local hz stands */ })
  }, [identity])

  // tonight's teaser: who's out there without giving them away
  const teaser = useMemo(() => {
    const out = castPing(me.hz)
    return out.length > 0 ? out[0].interval : null
  }, [me.hz])

  // being found: some nights, a harmonising carrier casts toward you first
  useEffect(() => {
    setInbound(inboundPing(me.hz))
  }, [me.hz])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const t = window.setInterval(() => setCooldown(Math.ceil(castCooldownRemaining() / 1000)), 1000)
    return () => window.clearInterval(t)
  }, [cooldown])

  useEffect(() => {
    const timers = timersRef.current
    return () => { timers.forEach(id => window.clearTimeout(id)); cancelSpeech() }
  }, [])

  const familiarFor = (handle: string): string | null => {
    const f = getFamiliars().find(x => x.handle === handle)
    return f ? stageLabel(f.stage) : null
  }

  const cast = () => {
    if (phase === 'casting' || castCooldownRemaining() > 0) return
    markCast()
    setPhase('casting')
    setReturns([])
    // your ping goes out in your own chime — the voice you picked for your signature
    if (!playSignatureChime(me.hz, readChime(), 0, 1.8)) playPingTone(me.hz, 0, 1.8, 0.24)
    const found = castPing(me.hz)
    setPending(found.length)
    found.forEach((ret, i) => {
      const delay = 1700 + i * 1900 + Math.random() * 600
      timersRef.current.push(window.setTimeout(() => {
        playSignatureChime(ret.hz, chimeForHandle(ret.handle), 0, 1.2, 0.55)
        setReturns(prev => [...prev, ret])
        setPending(p => p - 1)
      }, delay))
    })
    timersRef.current.push(window.setTimeout(() => {
      setPhase('returned')
      setCooldown(Math.ceil(castCooldownRemaining() / 1000))
    }, found.length === 0 ? 3400 : 1700 + (found.length - 1) * 1900 + 900))
  }

  const hear = (ret: EchoReturn) => {
    // your chime, theirs, then the two together — the harmony heard, not explained
    const mine = readChime()
    const theirs = chimeForHandle(ret.handle)
    const a = playSignatureChime(me.hz, mine, 0, 1.1, 0.85)
    playSignatureChime(ret.hz, theirs, 0.7, 1.1, 0.85)
    playSignatureChime(me.hz, mine, 1.7, 2.2, 0.65)
    playSignatureChime(ret.hz, theirs, 1.7, 2.2, 0.65)
    if (!a) void playSampleBuffer('tone', ret.seed, 2600, 0.2)
    if (speechSupported()) {
      // the chord first, then the voice behind it
      timersRef.current.push(window.setTimeout(() => speakSignal(ret.line, ret.seed), 2600))
    }
  }

  const echoBack = () => {
    if (!inbound) return
    answerPing(inbound)
    setAnswered(true)
    setLocked(prev => [...prev, inbound.handle])
    setHarmonies(listHarmonies())
    // their ping again, then your answer riding after it
    playSignatureChime(inbound.hz, chimeForHandle(inbound.handle), 0, 1.2, 0.8)
    playSignatureChime(me.hz, readChime(), 0.9, 1.6)
  }

  const lock = (ret: EchoReturn) => {
    lockHarmony(ret)
    setLocked(prev => [...prev, ret.handle])
    setHarmonies(listHarmonies())
  }

  const openCarrier = (ret: EchoReturn) => {
    window.dispatchEvent(new CustomEvent('ecosphere:viewCarrier', { detail: { handle: ret.handle, line: ret.line, seed: ret.seed } }))
  }

  return (
    <section className="echoloc" aria-label="Echolocation" style={{ '--el-color': me.color } as CSSProperties}>
      <header className="echoloc-head">
        <div className="echoloc-title-row">
          <span className="echoloc-kicker">ECHOLOCATION</span>
          <span className="echoloc-hz" title="your signature frequency">{me.hz.toFixed(1)} Hz · you</span>
        </div>
        <p className="echoloc-sub">
          no search out here. cast your frequency into the dark — only the carriers who
          harmonise with it can find their way back.
        </p>
        {teaser && phase === 'idle' && (
          <p className="echoloc-teaser"><i aria-hidden="true" />someone {teaser} from you is drifting tonight</p>
        )}
      </header>

      {inbound && !answered && (
        <div className="echoloc-inbound" style={{ '--ret-color': inbound.color } as CSSProperties}>
          <p className="echoloc-inbound-line">
            <i aria-hidden="true" />
            <button type="button" className="echoloc-handle" onClick={() => openCarrier(inbound)}>{inbound.handle}</button>
            {' '}cast a ping tonight — you harmonise, {inbound.interval}.
          </p>
          <button type="button" className="echoloc-inbound-answer" onClick={echoBack}>
            ∿ echo back — bind each other
          </button>
        </div>
      )}
      {inbound && answered && (
        <p className="echoloc-inbound-done" role="status">
          ◈ you and {inbound.handle} found each other — bound to your constellation
        </p>
      )}

      <div className={`echoloc-field echoloc-field--${phase}`}>
        <button
          type="button"
          className="echoloc-cast"
          disabled={phase === 'casting' || cooldown > 0}
          onClick={cast}
        >
          <span className="echoloc-cast-ring" aria-hidden="true"><i /><i /><i /></span>
          {phase === 'casting'
            ? 'ping travelling the band…'
            : cooldown > 0
              ? `the band settles · ${cooldown}s`
              : '◉ cast your frequency'}
        </button>
        {phase === 'casting' && pending > 0 && returns.length === 0 && (
          <p className="echoloc-listening" role="status">listening for returns…</p>
        )}
      </div>

      {returns.length > 0 && (
        <ul className="echoloc-returns">
          {returns.map(ret => (
            <li key={ret.handle} className="echoloc-return" style={{ '--ret-color': ret.color } as CSSProperties}>
              <div className="echoloc-return-top">
                <button type="button" className="echoloc-handle" onClick={() => openCarrier(ret)}>
                  <span aria-hidden="true">{MOOD_GLYPH[ret.mood] ?? '◍'}</span> {ret.handle}
                </button>
                <span className="echoloc-interval">{ret.interval} · {Math.round(ret.purity * 100)}% pure</span>
              </div>
              <p className="echoloc-line">"{ret.line}"</p>
              {familiarFor(ret.handle) && (
                <span className="echoloc-familiar">◈ {familiarFor(ret.handle)} — you've crossed before</span>
              )}
              <div className="echoloc-actions">
                <button type="button" onClick={() => hear(ret)}>▶ hear the harmony</button>
                <button type="button" onClick={() => { toggleTune(ret.handle); setTunedTick(t => t + 1) }} data-tick={tunedTick}>
                  {isTuned(ret.handle) ? '◉ tuned' : '○ tune in'}
                </button>
                <button
                  type="button"
                  className={locked.includes(ret.handle) ? 'echoloc-locked' : ''}
                  disabled={locked.includes(ret.handle)}
                  onClick={() => lock(ret)}
                >
                  {locked.includes(ret.handle) ? '◈ harmony locked' : '◇ lock the harmony'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {phase === 'returned' && returns.length === 0 && (
        <p className="echoloc-quiet" role="status">
          nothing harmonised tonight. the band shifts as the night moves — drift a while and cast again.
        </p>
      )}

      {harmonies.length > 0 && (
        <footer className="echoloc-kept">
          <span className="echoloc-kept-label">your constellation</span>
          <div className="echoloc-kept-row">
            {harmonies.map(h => (
              <button
                key={h.handle}
                type="button"
                className={`echoloc-kept-chip${h.mutual ? ' echoloc-kept-chip--mutual' : ''}`}
                style={{ '--ret-color': h.color } as CSSProperties}
                title={`${h.interval}${h.mutual ? ' · you answered each other' : ''} · ${new Date(h.lockedAt).toLocaleDateString()}`}
                onClick={() => window.dispatchEvent(new CustomEvent('ecosphere:viewCarrier', { detail: { handle: h.handle } }))}
              >
                <i aria-hidden="true" />{h.mutual ? '✦ ' : ''}{h.handle}
                {familiarFor(h.handle) && <em> · {familiarFor(h.handle)}</em>}
              </button>
            ))}
          </div>
        </footer>
      )}
    </section>
  )
}
