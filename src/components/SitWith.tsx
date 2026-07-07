import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { HOLD_MS, hasSatWith, sitWith, stillnessLine } from '../lib/stillness'
import { getSharedAudioContext } from '../lib/sampleAudio'
import './SitWith.css'

// Press and hold to sit with a voice — no words, no reaction, just staying.
// The hold is long on purpose: presence should cost a breath.

export default function SitWith({ signalId, color = '#9b5de9' }: { signalId: string; color?: string }) {
  const [sat, setSat] = useState(() => hasSatWith(signalId))
  const [holding, setHolding] = useState(false)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef(0)
  const startRef = useRef(0)
  const oscRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null)

  const stopBreath = () => {
    const b = oscRef.current
    if (b) {
      try {
        const ctx = getSharedAudioContext()
        if (ctx) {
          b.gain.gain.cancelScheduledValues(ctx.currentTime)
          b.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2)
        }
        b.osc.stop((getSharedAudioContext()?.currentTime ?? 0) + 0.25)
      } catch { /* already silent */ }
      oscRef.current = null
    }
  }

  const startBreath = () => {
    const ctx = getSharedAudioContext()
    if (!ctx || ctx.state !== 'running') return
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 82 // a low, chest-deep hum that swells with the hold
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + HOLD_MS / 1000)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    oscRef.current = { osc, gain }
  }

  const cancelHold = () => {
    cancelAnimationFrame(rafRef.current)
    setHolding(false)
    setProgress(0)
    stopBreath()
  }

  const beginHold = () => {
    if (sat) return
    setHolding(true)
    startRef.current = Date.now()
    startBreath()
    const tick = () => {
      const p = Math.min(1, (Date.now() - startRef.current) / HOLD_MS)
      setProgress(p)
      if (p >= 1) {
        sitWith(signalId)
        setSat(true)
        setHolding(false)
        stopBreath()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); stopBreath() }, [])

  return (
    <div className="sitwith" style={{ '--sit-color': color, '--sit-p': progress } as CSSProperties}>
      {sat ? (
        <span className="sitwith-done" role="status">
          <i aria-hidden="true">◌</i> {stillnessLine(signalId)}
        </span>
      ) : (
        <button
          type="button"
          className={`sitwith-btn${holding ? ' sitwith-btn--holding' : ''}`}
          onPointerDown={beginHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          title="hold — no words, just stay a moment"
        >
          <span className="sitwith-ring" aria-hidden="true" />
          ◌ {holding ? 'stay…' : 'sit with it'}
        </button>
      )}
    </div>
  )
}
