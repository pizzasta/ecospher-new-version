import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getSharedAudioContext } from '../lib/sampleAudio'
import './SignalLockIn.css'

// ── Signal Lock-In ──────────────────────────────────────────────────────────
// The one moment the app "hears you arrive." After you name your signal, the
// room dims, faint radio static tunes in, distant voices ghost past, and your
// name lands on a low bass pulse as the orb blooms once and settles.
//
// Cinematic, not flashy. Audio is synthesized (no asset files) and only ever
// starts from the user's tap — respecting autoplay rules. Everything degrades:
// muted, audio-failed, mic-denied and reduced-motion all still reach the end.

interface SignalLockInProps {
  signalName: string
  onComplete: () => void
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && !!window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// looping white-noise source — the bed for hiss and ghosted voices
function makeNoise(ctx: AudioContext, seconds = 2): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  return src
}

interface LockInAudio { analyser: AnalyserNode; stop: () => void }

// The whole ~6s soundscape, scheduled against the audio clock so it stays in
// sync no matter how the main thread stutters. Returns an analyser (for the
// orb's audio-reactivity) and a stop() that tears every node down.
function startLockInAudio(ctx: AudioContext): LockInAudio {
  const master = ctx.createGain()
  master.gain.value = 0.9
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  master.connect(analyser)
  analyser.connect(ctx.destination)

  const t0 = ctx.currentTime
  const nodes: AudioScheduledSourceNode[] = []

  // 1 — tape hiss bed, fading in like a room going quiet
  const hiss = makeNoise(ctx, 3)
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200
  const hissGain = ctx.createGain()
  hissGain.gain.setValueAtTime(0.0001, t0)
  hissGain.gain.exponentialRampToValueAtTime(0.05, t0 + 1.2)
  hissGain.gain.setValueAtTime(0.05, t0 + 4.8)
  hissGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 6.4)
  hiss.connect(hp); hp.connect(lp); lp.connect(hissGain); hissGain.connect(master)
  hiss.start(t0); hiss.stop(t0 + 6.5); nodes.push(hiss)

  // 2 — old-radio tuning sweep
  const sweep = ctx.createOscillator(); sweep.type = 'sawtooth'
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 11
  const sweepGain = ctx.createGain()
  sweep.frequency.setValueAtTime(240, t0 + 1.4)
  sweep.frequency.exponentialRampToValueAtTime(1300, t0 + 2.2)
  sweep.frequency.exponentialRampToValueAtTime(520, t0 + 2.8)
  bp.frequency.setValueAtTime(320, t0 + 1.4)
  bp.frequency.exponentialRampToValueAtTime(1600, t0 + 2.8)
  sweepGain.gain.setValueAtTime(0.0001, t0 + 1.4)
  sweepGain.gain.exponentialRampToValueAtTime(0.03, t0 + 1.65)
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.9)
  sweep.connect(bp); bp.connect(sweepGain); sweepGain.connect(master)
  sweep.start(t0 + 1.4); sweep.stop(t0 + 3); nodes.push(sweep)

  // 3 — distant voice fragments: filtered noise, never quite words
  ;[2.5, 3.1, 3.8].forEach((at, i) => {
    const vn = makeNoise(ctx, 1)
    const vbp = ctx.createBiquadFilter(); vbp.type = 'bandpass'; vbp.Q.value = 7
    const vg = ctx.createGain()
    vbp.frequency.setValueAtTime(380 + i * 190, t0 + at)
    vbp.frequency.linearRampToValueAtTime(640 + i * 150, t0 + at + 0.4)
    vg.gain.setValueAtTime(0.0001, t0 + at)
    vg.gain.exponentialRampToValueAtTime(0.038, t0 + at + 0.08)
    vg.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.5)
    vn.connect(vbp); vbp.connect(vg); vg.connect(master)
    vn.start(t0 + at); vn.stop(t0 + at + 0.55); nodes.push(vn)
  })

  // 4 — the low warm sub pulse on the name reveal: one clean hit
  const sub = ctx.createOscillator(); sub.type = 'sine'
  const subGain = ctx.createGain()
  sub.frequency.setValueAtTime(62, t0 + 4.4)
  sub.frequency.exponentialRampToValueAtTime(46, t0 + 5.05)
  subGain.gain.setValueAtTime(0.0001, t0 + 4.4)
  subGain.gain.exponentialRampToValueAtTime(0.2, t0 + 4.47)
  subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.1)
  sub.connect(subGain); subGain.connect(master)
  sub.start(t0 + 4.4); sub.stop(t0 + 5.2); nodes.push(sub)

  return {
    analyser,
    stop: () => {
      nodes.forEach(n => { try { n.stop() } catch { /* already stopped */ } })
      try { master.disconnect() } catch { /* already gone */ }
    },
  }
}

// Reveal beats, in ms from the user's tap. The audio above is scheduled to land
// on the same marks (tuning ~1.4s, voices ~2.5s, bass + name ~4.4s).
const BEATS = { darken: 0, static: 220, tuning: 1400, voices: 2600, reveal: 4400, settle: 5200, done: 5700 }
const REDUCED_BEATS = { darken: 0, static: 0, tuning: 0, voices: 0, reveal: 320, settle: 600, done: 950 }

export default function SignalLockIn({ signalName, onComplete }: SignalLockInProps) {
  const reduced = prefersReducedMotion()
  const [started, setStarted] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [beat, setBeat] = useState(-1)

  const orbRef = useRef<HTMLDivElement>(null)
  const waveRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<number[]>([])
  const rafRef = useRef<number>(0)
  const audioStopRef = useRef<(() => void) | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)

  const cleanupAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    audioStopRef.current?.()
    audioStopRef.current = null
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current = null
    orbRef.current?.style.setProperty('--sli-level', '0')
    waveRef.current?.style.setProperty('--sli-level', '0')
  }, [])

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout)
    cleanupAudio()
  }, [cleanupAudio])

  // attach the mic only if permission is ALREADY granted — never prompt mid-moment
  const tryMic = useCallback(async (ctx: AudioContext): Promise<AnalyserNode | null> => {
    try {
      const perms = navigator.permissions
      if (!perms?.query || !navigator.mediaDevices?.getUserMedia) return null
      const status = await perms.query({ name: 'microphone' as PermissionName })
      if (status.state !== 'granted') return null
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      const micAnalyser = ctx.createAnalyser()
      micAnalyser.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(micAnalyser) // not routed to output — read only
      return micAnalyser
    } catch {
      return null // fall back to simulated motion
    }
  }, [])

  const begin = useCallback(() => {
    if (started) return
    setStarted(true)

    const marks = reduced ? REDUCED_BEATS : BEATS
    ;(Object.values(marks)).forEach((ms, i) => {
      timersRef.current.push(window.setTimeout(() => setBeat(i), ms))
    })

    let outAnalyser: AnalyserNode | null = null
    if (soundOn) {
      const ctx = getSharedAudioContext()
      if (ctx) {
        if (ctx.state !== 'running') void ctx.resume().catch(() => { /* stays muted */ })
        try {
          const audio = startLockInAudio(ctx)
          outAnalyser = audio.analyser
          audioStopRef.current = audio.stop
          void tryMic(ctx).then(mic => { micAnalyserRef.current = mic })
        } catch { /* visuals carry the moment alone */ }
      }
    }

    // reactivity: drive the orb + waveform from real audio, or a gentle
    // simulated breath when there's no analyser (muted / audio unavailable).
    if (!reduced) {
      const out = outAnalyser ? new Uint8Array(outAnalyser.frequencyBinCount) : null
      const start = performance.now()
      const loop = () => {
        let level = 0
        if (outAnalyser && out) {
          outAnalyser.getByteTimeDomainData(out)
          level = rms(out) * 3
        }
        const mic = micAnalyserRef.current
        if (mic) {
          const buf = new Uint8Array(mic.frequencyBinCount)
          mic.getByteTimeDomainData(buf)
          level = Math.max(level, rms(buf) * 4)
        }
        if (!outAnalyser && !mic) {
          const t = (performance.now() - start) / 1000
          level = 0.18 + Math.sin(t * 1.6) * 0.12 + Math.sin(t * 4.3) * 0.04
        }
        level = Math.max(0, Math.min(1, level))
        orbRef.current?.style.setProperty('--sli-level', level.toFixed(3))
        waveRef.current?.style.setProperty('--sli-level', level.toFixed(3))
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
  }, [reduced, soundOn, started, tryMic])

  const finish = useCallback(() => {
    cleanupAudio()
    onComplete()
  }, [cleanupAudio, onComplete])

  const phase = !started ? 'await' : beat >= 6 ? 'done' : 'running'
  const orbClass = [
    'sli-orb',
    started && beat < 4 ? 'is-listening' : '',
    beat === 4 ? 'is-bloom' : '',
    beat >= 5 ? 'is-settled' : '',
  ].filter(Boolean).join(' ')

  return (
    <main className={`sli-shell beat-${Math.max(0, beat)} ${started ? 'is-started' : ''}`} aria-label="Signal lock-in">
      <button type="button" className="sli-skip" onClick={finish}>skip</button>

      {/* darkened edges + analog static + drifting glow */}
      <div className="sli-vignette" aria-hidden="true" />
      <div className="sli-static" aria-hidden="true" />
      <div className="sli-glow" aria-hidden="true" />
      <div className="sli-flicker" aria-hidden="true" />

      <section className="sli-stage">
        <div className={orbClass} ref={orbRef} aria-hidden="true">
          <span className="sli-orb-ring" />
          <span className="sli-orb-ring sli-orb-ring-two" />
          <span className="sli-orb-core" />
          <span className="sli-orb-bloom" />
        </div>

        <div className="sli-wave" ref={waveRef} aria-hidden="true">
          {Array.from({ length: 21 }, (_, i) => (
            <i key={i} style={{ '--wi': i, '--wo': `${Math.abs(i - 10) / 10}` } as CSSProperties} />
          ))}
        </div>

        <AnimatePresence>
          {started && beat >= 3 && beat < 4 && (
            <motion.p
              key="ghost"
              className="sli-ghost"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.5, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
            >
              …is someone there…
            </motion.p>
          )}
        </AnimatePresence>

        <div className="sli-readout">
          <AnimatePresence mode="wait">
            {phase === 'await' && (
              <motion.div key="await" className="sli-await"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}>
                <span className="sli-kicker">SIGNAL LOCK-IN</span>
                <p className="sli-await-line">the band is listening.</p>
                <div className="sli-await-actions">
                  <button type="button" className="sli-begin" onClick={begin}>lock in my signal</button>
                  <button
                    type="button"
                    className={`sli-sound-toggle ${soundOn ? 'on' : ''}`}
                    aria-pressed={soundOn}
                    onClick={() => setSoundOn(s => !s)}
                  >
                    {soundOn ? '♪ sound on' : '♪̶ muted'}
                  </button>
                </div>
              </motion.div>
            )}

            {started && beat >= 4 && (
              <motion.div key="name" className="sli-name-wrap"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                <span className="sli-name-label">signal locked</span>
                <motion.strong
                  className="sli-name"
                  initial={{ scale: reduced ? 1 : 1.16, opacity: 0, letterSpacing: '0.3em' }}
                  animate={{ scale: 1, opacity: 1, letterSpacing: '0.02em' }}
                  transition={{ duration: reduced ? 0.3 : 0.9, ease: [0.16, 1, 0.3, 1] }}
                >
                  {signalName}
                </motion.strong>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {phase === 'done' && (
            <motion.button
              key="enter"
              type="button"
              className="sli-enter"
              onClick={finish}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
              enter the drift
            </motion.button>
          )}
        </AnimatePresence>
      </section>
    </main>
  )
}

// root-mean-square of time-domain bytes (128 = silence)
function rms(buf: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) {
    const x = (buf[i] - 128) / 128
    sum += x * x
  }
  return Math.sqrt(sum / buf.length)
}
