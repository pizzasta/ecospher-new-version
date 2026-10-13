import { useRef, useState } from 'react'
import { analyzeVoice, describeGenome } from '../lib/voiceGenome'
import type { VoiceGenome } from '../lib/voiceGenome'
import { captureVoice } from '../lib/voiceCapture'
import { micErrorReason } from '../lib/audioBudget'
import './Node3D.css'

const TAKE_MS = 5000

/**
 * "Give it your voice": five seconds of anything — a sentence, your name, a
 * hum — grow a form that exists nowhere else. The audio is analysed in this
 * tab and dropped; only the genome's numbers are kept.
 */
export default function VoiceBirth({ onBorn, born = false }: { onBorn: (g: VoiceGenome) => void; born?: boolean }) {
  const [phase, setPhase] = useState<'idle' | 'listening' | 'growing'>('idle')
  const [level, setLevel] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const stop = useRef(false)

  const start = async () => {
    if (phase !== 'idle') return
    setNote(null)
    // created inside the tap, before any await, so iOS Safari doesn't leave it suspended
    let ctx: AudioContext
    try { ctx = new AudioContext(); void ctx.resume().catch(() => { /* resumed in capture */ }) } catch { setNote('this browser can’t listen'); return }
    stop.current = false
    setPhase('listening'); setLevel(0); setElapsed(0)
    try {
      const take = await captureVoice(ctx, TAKE_MS, (l, ms) => { setLevel(l); setElapsed(ms) }, () => stop.current)
      setPhase('growing')
      // let the analysis run a frame later so the "growing" state paints first
      await new Promise(r => window.setTimeout(r, 60))
      const genome = analyzeVoice(take.samples, take.sampleRate)
      if (!genome) { setNote('i barely heard you — try again a little closer'); return }
      setNote(`born: ${describeGenome(genome)}`)
      onBorn(genome)
    } catch (err) {
      const reason = micErrorReason(err)
      setNote(reason === 'permission' ? 'mic permission was declined' : 'the mic wouldn’t open')
    } finally {
      void ctx.close().catch(() => { /* closed */ })
      setPhase('idle'); setLevel(0)
    }
  }

  const secs = Math.max(0, Math.ceil((TAKE_MS - elapsed) / 1000))

  return (
    <div className="voice-birth">
      <button
        type="button"
        className={`voice-birth-btn${phase === 'listening' ? ' live' : ''}`}
        onClick={() => void start()}
        disabled={phase === 'growing'}
        style={{ '--vb-level': level } as React.CSSProperties}
      >
        <span className="voice-birth-ring" aria-hidden="true" />
        {phase === 'idle' && (born ? '❍ grow it again from your voice' : '❍ grow your form from your voice')}
        {phase === 'listening' && `listening… say anything · ${secs}`}
        {phase === 'growing' && 'growing…'}
      </button>
      <p className="voice-birth-hint">
        {note ?? 'five seconds of anything — a sentence, your name, a hum. it becomes a form no one else can have. the audio is never kept.'}
      </p>
    </div>
  )
}
