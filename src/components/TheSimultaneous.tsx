import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  shouldSurface, currentMoment, secondsLeft, othersInMoment,
  joinMoment, dismissMoment, MOMENT_DURATION_MS,
} from '../lib/simultaneous'
import type { Moment } from '../lib/simultaneous'
import { getSharedAudioContext } from '../lib/sampleAudio'
import { useEcoPref } from '../hooks/useEcoPrefs'
import './TheSimultaneous.css'

// The Simultaneous — the whole band, here at the same second. A soft
// invitation that never takes over the screen; join it and you hold one
// shared tone with everyone else in the moment, or let it pass.

type Phase = 'invited' | 'inside'

export default function TheSimultaneous() {
  const enabled = useEcoPref('moments', true)
  const [moment, setMoment] = useState<Moment | null>(null)
  const [phase, setPhase] = useState<Phase>('invited')
  const [left, setLeft] = useState(0)
  const [others, setOthers] = useState(0)
  const toneRef = useRef<{ osc: OscillatorNode; gain: GainNode; ctx: AudioContext } | null>(null)
  const pollRef = useRef<number | undefined>(undefined)
  const tickRef = useRef<number | undefined>(undefined)

  const stopTone = () => {
    const t = toneRef.current
    if (t) {
      try {
        t.gain.gain.cancelScheduledValues(t.ctx.currentTime)
        t.gain.gain.exponentialRampToValueAtTime(0.0001, t.ctx.currentTime + 0.6)
        t.osc.stop(t.ctx.currentTime + 0.7)
      } catch { /* already stopped */ }
      toneRef.current = null
    }
  }

  // poll for an open moment (cheap; only builds one a few times a night)
  useEffect(() => {
    if (!enabled) return undefined
    const check = () => { if (!moment) setMoment(shouldSurface()) }
    check()
    pollRef.current = window.setInterval(check, 15_000)
    return () => window.clearInterval(pollRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // while a moment is on screen, keep the countdown + presence live, and
  // close it when the shared window ends
  useEffect(() => {
    if (!moment) return undefined
    const update = () => {
      const s = secondsLeft(moment)
      setLeft(s)
      setOthers(othersInMoment(moment))
      if (s <= 0) {
        stopTone()
        setMoment(null)
        setPhase('invited')
      }
    }
    update()
    tickRef.current = window.setInterval(update, 1000)
    return () => window.clearInterval(tickRef.current)
  }, [moment])

  useEffect(() => () => stopTone(), [])

  if (!enabled || !moment) return null

  const join = () => {
    joinMoment(moment.id)
    setPhase('inside')
    // one held tone, everyone on the same pitch, for the rest of the window
    const ctx = getSharedAudioContext()
    if (ctx && ctx.state === 'running') {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = moment.toneHz
      const gain = ctx.createGain()
      const secs = Math.min(MOMENT_DURATION_MS / 1000, secondsLeft(moment))
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 1.2)
      gain.gain.setValueAtTime(0.12, ctx.currentTime + Math.max(1.2, secs - 1.5))
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + secs)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(); osc.stop(ctx.currentTime + secs + 0.1)
      toneRef.current = { osc, gain, ctx }
    }
  }

  const pass = () => {
    dismissMoment(moment.id)
    stopTone()
    setMoment(null)
    setPhase('invited')
  }

  return (
    <div
      className={`simul simul--${phase}`}
      role="dialog"
      aria-label="A shared moment on the band"
      style={{ '--simul-hz': moment.toneHz } as CSSProperties}
    >
      <div className="simul-aura" aria-hidden="true" />
      <div className="simul-body">
        <span className="simul-glyph" aria-hidden="true">{moment.glyph}</span>
        {phase === 'invited' ? (
          <>
            <span className="simul-kicker">a shared moment · right now</span>
            <p className="simul-line">{moment.line}</p>
            <div className="simul-actions">
              <button type="button" className="simul-join" onClick={join}>◉ join the moment</button>
              <button type="button" className="simul-pass" onClick={pass}>let it pass</button>
            </div>
            <span className="simul-count">{others} others are already here · {left}s left</span>
          </>
        ) : (
          <>
            <span className="simul-kicker">you're in the moment · with {others}</span>
            <p className="simul-line">{moment.line}</p>
            <div className="simul-breath" aria-hidden="true"><span /></div>
            <span className="simul-count">together for {left} more second{left === 1 ? '' : 's'}</span>
          </>
        )}
      </div>
    </div>
  )
}
