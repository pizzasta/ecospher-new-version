import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { CSSProperties, MutableRefObject } from 'react'
import '../rooms.css'

// ═══════════════════════════════════════════════════════════════
// ROOMS — live ecosystem of anonymous frequency spaces
// ═══════════════════════════════════════════════════════════════

// ─── Types ─────────────────────────────────────────────────────
type RoomStateName =
  | 'quiet-bloom'
  | 'signal-storm'
  | 'dead-silence'
  | 'resonance-spike'
  | 'static-interference'

interface AudioProfile {
  oscFreq: number
  detune: number
  filterFreq: number
  noiseLevel: number
}

interface SignalDef {
  id: string
  title: string
  duration: number // seconds
  url?: string // real blob url for user fragments
  mine?: boolean
}

interface RoomDef {
  id: string
  name: string
  tagline: string
  frequency: string
  accentRgb: string // "r,g,b"
  baseListeners: number
  baseResonance: number
  initialState: RoomStateName
  audio: AudioProfile
  signals: SignalDef[]
  feed: string[]
}

interface FloatWhisper {
  id: number
  text: string
  top: number
  dur: number
  mine: boolean
}

interface ReactionPop {
  id: number
  glyph: string
  left: number
}

interface SignalNode {
  id: number
  left: number
  top: number
  dur: number
  delay: number
  size: number
  fragment: string
}

// ─── Mock data ─────────────────────────────────────────────────
const ROOMS: RoomDef[] = [
  {
    id: 'drift-field',
    name: '3am drift field',
    tagline: 'for the ones still transmitting after everyone left',
    frequency: '36.6 hz',
    accentRgb: '0,212,255',
    baseListeners: 23,
    baseResonance: 48,
    initialState: 'quiet-bloom',
    audio: { oscFreq: 54, detune: 7, filterFreq: 420, noiseLevel: 0.18 },
    signals: [
      { id: 'df-1', title: 'untitled hum, looped twice', duration: 42 },
      { id: 'df-2', title: 'breath against the window', duration: 18 },
      { id: 'df-3', title: 'half a sentence, then static', duration: 27 },
    ],
    feed: [
      'a carrier replayed the same 6 seconds twice',
      'someone arrived without a sound',
      'a whisper dissolved before anyone caught it',
      'two signals overlapped for a moment',
    ],
  },
  {
    id: 'static-garden',
    name: 'static garden',
    tagline: 'restless noise, growing into something warm',
    frequency: '92.4 hz',
    accentRgb: '255,45,120',
    baseListeners: 61,
    baseResonance: 72,
    initialState: 'static-interference',
    audio: { oscFreq: 66, detune: 11, filterFreq: 920, noiseLevel: 0.3 },
    signals: [
      { id: 'sg-1', title: 'rain recorded through a wall', duration: 51 },
      { id: 'sg-2', title: 'laughter, pitched down', duration: 14 },
      { id: 'sg-3', title: 'a kettle and a confession', duration: 33 },
    ],
    feed: [
      'the static thickened, then settled',
      'a fragment bloomed near the east edge',
      'someone reacted with ✦ and left',
      'three carriers synced by accident',
    ],
  },
  {
    id: 'long-hallway',
    name: 'the long hallway',
    tagline: 'every echo here takes a while to come back',
    frequency: '47.0 hz',
    accentRgb: '155,93,233',
    baseListeners: 14,
    baseResonance: 35,
    initialState: 'dead-silence',
    audio: { oscFreq: 48, detune: 4, filterFreq: 300, noiseLevel: 0.12 },
    signals: [
      { id: 'lh-1', title: 'footsteps that never arrive', duration: 64 },
      { id: 'lh-2', title: 'a door, opened gently', duration: 9 },
      { id: 'lh-3', title: 'reverb of a name', duration: 22 },
    ],
    feed: [
      'an echo returned from 3 cycles ago',
      'a carrier paused mid-hallway',
      'something distant answered, faintly',
      'the silence stretched, comfortably',
    ],
  },
  {
    id: 'low-battery',
    name: 'low battery lounge',
    tagline: 'dim signals welcome. nothing here needs to be loud.',
    frequency: '28.8 hz',
    accentRgb: '255,128,160',
    baseListeners: 37,
    baseResonance: 41,
    initialState: 'quiet-bloom',
    audio: { oscFreq: 40, detune: 3, filterFreq: 220, noiseLevel: 0.15 },
    signals: [
      { id: 'lb-1', title: 'humming at 4 percent', duration: 38 },
      { id: 'lb-2', title: 'blanket static, very soft', duration: 47 },
      { id: 'lb-3', title: 'the last voice memo of the night', duration: 19 },
    ],
    feed: [
      'a carrier dimmed to standby',
      'someone left a warm fragment by the door',
      'the room exhaled together',
      'a tired signal found a corner',
    ],
  },
  {
    id: 'resonance-chambers',
    name: 'resonance chambers',
    tagline: 'where overlapping feelings amplify each other',
    frequency: '72.2 hz',
    accentRgb: '122,160,255',
    baseListeners: 88,
    baseResonance: 83,
    initialState: 'resonance-spike',
    audio: { oscFreq: 72, detune: 9, filterFreq: 640, noiseLevel: 0.22 },
    signals: [
      { id: 'rc-1', title: 'twelve hums, braided', duration: 56 },
      { id: 'rc-2', title: 'collective inhale', duration: 11 },
      { id: 'rc-3', title: 'a chord nobody planned', duration: 29 },
    ],
    feed: [
      'resonance crossed 80% and held',
      'two strangers hit the same note',
      'the chamber rang for a full minute',
      'a spike rippled through every carrier',
    ],
  },
  {
    id: 'dead-air-archive',
    name: 'dead air archive',
    tagline: 'recordings of silence, catalogued with care',
    frequency: '??.? hz',
    accentRgb: '120,230,150',
    baseListeners: 7,
    baseResonance: 18,
    initialState: 'static-interference',
    audio: { oscFreq: 36, detune: 2, filterFreq: 180, noiseLevel: 0.1 },
    signals: [
      { id: 'da-1', title: 'tape hiss, archived 3 cycles ago', duration: 73 },
      { id: 'da-2', title: 'the pause before an answer', duration: 8 },
      { id: 'da-3', title: 'an empty room, listening back', duration: 41 },
    ],
    feed: [
      'a new silence was filed under "almost"',
      'the archive flickered, briefly',
      'a carrier checked out an old quiet',
      'nothing happened. it was recorded.',
    ],
  },
]

const ROOM_STATES: RoomStateName[] = [
  'quiet-bloom',
  'signal-storm',
  'dead-silence',
  'resonance-spike',
  'static-interference',
]

const WEATHER: Record<RoomStateName, string[]> = {
  'quiet-bloom': ['warm fog', 'soft drizzle of static', 'slow golden haze'],
  'signal-storm': ['signal storm approaching', 'electric crosswinds', 'frequency squall'],
  'dead-silence': ['flat air, no wind', 'vacuum stillness', 'pressure drop, total hush'],
  'resonance-spike': ['aurora interference', 'rising harmonic pressure', 'shimmering overtones'],
  'static-interference': ['light static rain', 'grainy haze', 'intermittent crackle fronts'],
}

const ACTIVITY_LABEL: Record<RoomStateName, string> = {
  'quiet-bloom': 'gently blooming',
  'signal-storm': 'surging',
  'dead-silence': 'holding its breath',
  'resonance-spike': 'amplifying',
  'static-interference': 'flickering',
}

const STATE_GLYPH: Record<RoomStateName, string> = {
  'quiet-bloom': '✦',
  'signal-storm': '∿',
  'dead-silence': '◌',
  'resonance-spike': '◑',
  'static-interference': '⋯',
}

const STATE_INTENSITY: Record<RoomStateName, number> = {
  'quiet-bloom': 0.45,
  'signal-storm': 1,
  'dead-silence': 0.12,
  'resonance-spike': 0.85,
  'static-interference': 0.6,
}

const REACTION_GLYPHS = ['∿', '✦', '◌', '⋯', '◑']

const NODE_FRAGMENTS = [
  'someone hummed here, once',
  'this node remembers rain',
  'a held breath, suspended',
  'half of a lullaby',
  'the shape of a sigh',
  'an unsent goodnight',
  'static, but kind',
  'a frequency someone misses',
  'the quiet part of a song',
]

const AMBIENT_WHISPERS = [
  'still here.',
  'do you feel that?',
  'the resonance remembers.',
  'not alone.',
  'almost audible.',
  'drifting back.',
  'the signal keeps returning.',
  'you found the quiet part.',
]

// ─── Small utils ───────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

function evolveState(prev: RoomStateName, energy: number): RoomStateName {
  if (energy > 60 && Math.random() < 0.6) return 'resonance-spike'
  if (Math.random() < 0.45) return prev
  const pool = ROOM_STATES.filter(s => s !== prev)
  return pool[Math.floor(Math.random() * pool.length)]
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ─── Ambient audio engine (Web Audio, graceful no-op) ──────────
class AmbientEngine {
  failed = false
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private filter: BiquadFilterNode | null = null
  private oscA: OscillatorNode | null = null
  private oscB: OscillatorNode | null = null
  private noiseGain: GainNode | null = null
  private data: Uint8Array<ArrayBuffer> | null = null

  private ensure(): boolean {
    if (this.failed) return false
    if (this.ctx) return true
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) {
        this.failed = true
        return false
      }
      const ctx = new Ctor()
      const master = ctx.createGain()
      master.gain.value = 0
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      master.connect(analyser)
      analyser.connect(ctx.destination)

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 400
      filter.Q.value = 0.9
      filter.connect(master)

      // slow breathing on the filter cutoff
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.07
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 90
      lfo.connect(lfoGain)
      lfoGain.connect(filter.frequency)
      lfo.start()

      const oscA = ctx.createOscillator()
      oscA.type = 'sine'
      const oscB = ctx.createOscillator()
      oscB.type = 'triangle'
      const oscGain = ctx.createGain()
      oscGain.gain.value = 0.5
      oscA.connect(oscGain)
      oscB.connect(oscGain)
      oscGain.connect(filter)
      oscA.start()
      oscB.start()

      // soft filtered noise bed
      const len = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const ch = buf.getChannelData(0)
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * 0.4
      const noiseSrc = ctx.createBufferSource()
      noiseSrc.buffer = buf
      noiseSrc.loop = true
      const noiseGain = ctx.createGain()
      noiseGain.gain.value = 0.15
      noiseSrc.connect(noiseGain)
      noiseGain.connect(filter)
      noiseSrc.start()

      this.ctx = ctx
      this.master = master
      this.analyser = analyser
      this.filter = filter
      this.oscA = oscA
      this.oscB = oscB
      this.noiseGain = noiseGain
      this.data = new Uint8Array(new ArrayBuffer(analyser.fftSize))
      return true
    } catch {
      this.failed = true
      return false
    }
  }

  // layered per-room voicing: different osc freq / detune / filter per room
  tune(profile: AudioProfile) {
    if (!this.ensure() || !this.ctx) return
    try {
      const t = this.ctx.currentTime
      this.oscA?.frequency.setTargetAtTime(profile.oscFreq, t, 0.6)
      this.oscB?.frequency.setTargetAtTime(profile.oscFreq * 2.01, t, 0.6)
      this.oscB?.detune.setTargetAtTime(profile.detune * 10, t, 0.6)
      this.filter?.frequency.setTargetAtTime(profile.filterFreq, t, 0.8)
      this.noiseGain?.gain.setTargetAtTime(profile.noiseLevel, t, 0.8)
    } catch {
      /* no-op */
    }
  }

  // smooth gain ramp on enter / leave / toggle
  setOn(on: boolean) {
    if (!this.ensure() || !this.ctx || !this.master) return
    try {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      const t = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(t)
      this.master.gain.setTargetAtTime(on ? 0.17 : 0.0001, t, on ? 0.7 : 0.35)
    } catch {
      /* no-op */
    }
  }

  level(): number {
    if (!this.analyser || !this.data) return 0
    try {
      this.analyser.getByteTimeDomainData(this.data)
      let sum = 0
      for (let i = 0; i < this.data.length; i++) {
        const v = (this.data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / this.data.length)
      return clamp(rms * 5, 0, 1)
    } catch {
      return 0
    }
  }

  dispose() {
    try {
      void this.ctx?.close()
    } catch {
      /* no-op */
    }
    this.ctx = null
  }
}

// ─── Shared live-room simulation ───────────────────────────────
function useLiveRoomSim(room: RoomDef, energyRef?: MutableRefObject<number>) {
  const [listeners, setListeners] = useState(room.baseListeners)
  const [resonance, setResonance] = useState(room.baseResonance)
  const [state, setState] = useState<RoomStateName>(room.initialState)
  const [weather, setWeather] = useState(() => WEATHER[room.initialState][0])
  const stateRef = useRef(state)
  stateRef.current = state

  // listener count drifts up and down
  useEffect(() => {
    const t = setInterval(() => {
      setListeners(prev => {
        const s = stateRef.current
        const bias = s === 'resonance-spike' ? 1 : s === 'dead-silence' ? -1 : 0
        const delta = Math.floor(Math.random() * 5) - 2 + bias
        return clamp(prev + delta, 1, 240)
      })
    }, 3400 + Math.random() * 1800)
    return () => clearInterval(t)
  }, [room.id])

  // resonance fluctuates toward a state-dependent target
  useEffect(() => {
    const t = setInterval(() => {
      setResonance(prev => {
        const s = stateRef.current
        const target =
          s === 'resonance-spike' ? 88 :
          s === 'signal-storm' ? 74 :
          s === 'quiet-bloom' ? 52 :
          s === 'static-interference' ? 44 : 14
        const pull = (target - prev) * 0.25
        const jitter = (Math.random() - 0.5) * 9
        return clamp(prev + pull + jitter, 4, 99)
      })
    }, 2600)
    return () => clearInterval(t)
  }, [room.id])

  // room state evolves on timers (+ activity energy when provided)
  useEffect(() => {
    const t = setInterval(() => {
      setState(prev => evolveState(prev, energyRef?.current ?? 0))
    }, 9000 + Math.random() * 5000)
    return () => clearInterval(t)
  }, [room.id, energyRef])

  // emotional weather follows the state
  useEffect(() => {
    const pool = WEATHER[state]
    setWeather(pool[Math.floor(Math.random() * pool.length)])
  }, [state])

  return { listeners, resonance, state, weather }
}

// ─── Live waveform (canvas, rAF writes pixels only) ────────────
function LiveWaveform({ accentRgb, intensity, className }: {
  accentRgb: string
  intensity: number
  className: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intensityRef = useRef(intensity)
  intensityRef.current = intensity

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = prefersReducedMotion()
    canvas.width = canvas.offsetWidth || 240
    canvas.height = canvas.offsetHeight || 34

    let raf = 0
    let t = Math.random() * 100
    const bars = 36
    const draw = () => {
      t += 0.045
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)
      const k = 0.25 + intensityRef.current * 0.75
      for (let i = 0; i < bars; i++) {
        const ph = i / bars
        const amp = Math.abs(Math.sin(t + ph * 6.5) * Math.sin(t * 0.7 + ph * 13)) * k
        const h = Math.max(1.5, amp * H * 0.92)
        const x = (i + 0.5) * (W / bars)
        ctx.fillStyle = `rgba(${accentRgb},${0.22 + amp * 0.6})`
        ctx.fillRect(x - 1, (H - h) / 2, 2, h)
      }
      if (!reduced) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [accentRgb])

  return <canvas ref={canvasRef} className={className} />
}

// ─── Room card ─────────────────────────────────────────────────
function RoomCard({ room, onEnter }: { room: RoomDef; onEnter: () => void }) {
  const { listeners, resonance, state, weather } = useLiveRoomSim(room)
  const [feedIdx, setFeedIdx] = useState(() => Math.floor(Math.random() * room.feed.length))

  // ambient activity feed line rotates
  useEffect(() => {
    const t = setInterval(() => {
      setFeedIdx(i => (i + 1) % room.feed.length)
    }, 6800 + Math.random() * 2400)
    return () => clearInterval(t)
  }, [room.feed.length])

  return (
    <article
      className={`room-card eco-room-card room-state--${state}`}
      onClick={onEnter}
      style={{ '--room-accent-rgb': room.accentRgb } as CSSProperties}
    >
      <div className="eco-card-aura" aria-hidden="true" />
      <header className="eco-card-top">
        <span className="eco-card-state">{ACTIVITY_LABEL[state]}</span>
        <span className="eco-card-freq">{room.frequency}</span>
      </header>
      <h3 className="room-name">{room.name}</h3>
      <p className="eco-card-tagline">{room.tagline}</p>
      <div className="eco-card-weather">
        <span className="eco-weather-glyph" aria-hidden="true">{STATE_GLYPH[state]}</span>
        {weather}
      </div>
      <LiveWaveform accentRgb={room.accentRgb} intensity={STATE_INTENSITY[state]} className="eco-card-wave" />
      <div className="eco-card-resonance">
        <div className="eco-resonance-track">
          <div className="eco-resonance-fill" style={{ width: `${resonance}%` }} />
        </div>
        <span className="eco-resonance-num">{Math.round(resonance)}% resonance</span>
      </div>
      <footer className="eco-card-bottom">
        <span className="eco-card-listeners">
          <i className="eco-live-dot" aria-hidden="true" />
          {listeners} listening
        </span>
        <span className="eco-card-feedline">{room.feed[feedIdx]}</span>
      </footer>
    </article>
  )
}

// ─── In-room immersive view ────────────────────────────────────
interface RoomViewProps {
  room: RoomDef
  leaving: boolean
  ambientOn: boolean
  audioBlocked: boolean
  onToggleAmbient: () => void
  onExit: () => void
  onDrift: () => void
  engine: AmbientEngine | null
}

function RoomView({ room, leaving, ambientOn, audioBlocked, onToggleAmbient, onExit, onDrift, engine }: RoomViewProps) {
  const energyRef = useRef(0)
  const [energy, setEnergy] = useState(0)
  const { listeners, resonance, state, weather } = useLiveRoomSim(room, energyRef)
  const [signals, setSignals] = useState<SignalDef[]>(room.signals)
  const [playback, setPlayback] = useState<{ id: string; elapsed: number; duration: number } | null>(null)
  const [whispers, setWhispers] = useState<FloatWhisper[]>([])
  const [whisperText, setWhisperText] = useState('')
  const [pops, setPops] = useState<ReactionPop[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [recStatus, setRecStatus] = useState<'idle' | 'recording'>('idle')
  const [recElapsed, setRecElapsed] = useState(0)
  const recElapsedRef = useRef(0)
  const [touchedNode, setTouchedNode] = useState<number | null>(null)

  const shellRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fragmentCountRef = useRef(0)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const noticeTimerRef = useRef<number | null>(null)

  energyRef.current = energy

  const bumpEnergy = useCallback((amount: number) => {
    setEnergy(e => clamp(e + amount, 0, 100))
  }, [])

  const showNotice = useCallback((text: string) => {
    setNotice(text)
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3200)
  }, [])

  // drifting particles + signal nodes are stable per room
  const particles = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1.5 + Math.random() * 3,
        dur: 14 + Math.random() * 18,
        delay: -Math.random() * 24,
        alpha: 0.15 + Math.random() * 0.4,
      })),
    [room.id] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const nodes = useMemo<SignalNode[]>(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        left: 8 + Math.random() * 84,
        top: 16 + Math.random() * 52,
        dur: 16 + Math.random() * 14,
        delay: -Math.random() * 20,
        size: 10 + Math.random() * 10,
        fragment: NODE_FRAGMENTS[(i * 3 + room.name.length) % NODE_FRAGMENTS.length],
      })),
    [room.id] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const carrierCount = clamp(Math.round(listeners / 14) + 2, 2, 6)
  const carriers = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        tag: `carrier_${String((i * 37 + room.name.length * 7) % 90 + 10)}`,
        delay: i * 0.5,
      })),
    [room.id] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // tune the drone to this room when it mounts (layered audio per room id)
  useEffect(() => {
    engine?.tune(room.audio)
  }, [engine, room.id, room.audio])

  // audio-reactive visuals: publish level into --room-level (direct DOM write, no React state)
  useEffect(() => {
    const shell = shellRef.current
    if (!ambientOn || !engine) {
      shell?.style.setProperty('--room-level', '0')
      return
    }
    let raf = 0
    let smooth = 0
    const loop = () => {
      smooth += (engine.level() - smooth) * 0.12
      shell?.style.setProperty('--room-level', smooth.toFixed(3))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      shell?.style.setProperty('--room-level', '0')
    }
  }, [ambientOn, engine])

  // energy slowly dissipates
  useEffect(() => {
    const t = setInterval(() => setEnergy(e => Math.max(0, e - 2)), 2500)
    return () => clearInterval(t)
  }, [])

  // ambient whispers drift through occasionally
  useEffect(() => {
    const t = setInterval(() => {
      if (Math.random() < 0.4) {
        const text = AMBIENT_WHISPERS[Math.floor(Math.random() * AMBIENT_WHISPERS.length)]
        spawnWhisper(text, false)
      }
    }, 7000)
    return () => clearInterval(t)
     
  }, [room.id])

  // fake playback timer
  useEffect(() => {
    if (!playback) return
    const t = setInterval(() => {
      setPlayback(p => {
        if (!p) return null
        const next = p.elapsed + 0.25
        if (next >= p.duration) return null
        return { ...p, elapsed: next }
      })
    }, 250)
    return () => clearInterval(t)
  }, [playback?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // recording timer with soft cap
  useEffect(() => {
    if (recStatus !== 'recording') return
    const t = setInterval(() => {
      const next = recElapsedRef.current + 0.25
      if (next >= 8) {
        stopRecording()
        return
      }
      recElapsedRef.current = next
      setRecElapsed(next)
    }, 250)
    return () => clearInterval(t)
     
  }, [recStatus])

  // cleanup on unmount: stop mic + any real audio
  useEffect(() => {
    return () => {
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
      } catch { /* no-op */ }
      streamRef.current?.getTracks().forEach(tr => tr.stop())
      if (audioElRef.current) {
        audioElRef.current.pause()
        audioElRef.current = null
      }
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    }
  }, [])

  const spawnWhisper = (text: string, mine: boolean) => {
    const id = ++idRef.current
    const w: FloatWhisper = {
      id,
      text,
      top: 14 + Math.random() * 58,
      dur: 13 + Math.random() * 7,
      mine,
    }
    setWhispers(prev => [...prev.slice(-7), w])
    window.setTimeout(() => {
      setWhispers(prev => prev.filter(x => x.id !== id))
    }, w.dur * 1000)
  }

  const handleWhisperSubmit = () => {
    const text = whisperText.trim()
    if (!text) return
    spawnWhisper(text, true)
    setWhisperText('')
    bumpEnergy(5)
  }

  const handleReaction = (glyph: string) => {
    const id = ++idRef.current
    setPops(prev => [...prev.slice(-9), { id, glyph, left: 12 + Math.random() * 76 }])
    window.setTimeout(() => setPops(prev => prev.filter(p => p.id !== id)), 1700)
    bumpEnergy(7)
  }

  const handleNodeTouch = (node: SignalNode) => {
    setTouchedNode(node.id)
    window.setTimeout(() => setTouchedNode(cur => (cur === node.id ? null : cur)), 900)
    spawnWhisper(node.fragment, false)
    bumpEnergy(4)
  }

  const stopRealAudio = () => {
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current = null
    }
  }

  const handleReplay = (sig: SignalDef) => {
    stopRealAudio()
    if (playback?.id === sig.id) {
      setPlayback(null)
      return
    }
    if (sig.url) {
      try {
        const el = new Audio(sig.url)
        el.onended = () => setPlayback(null)
        el.play().catch(() => { /* fall back to fake playback timer */ })
        audioElRef.current = el
      } catch { /* fall through to fake playback */ }
    }
    setPlayback({ id: sig.id, elapsed: 0, duration: sig.duration })
    bumpEnergy(3)
  }

  const startRecording = async () => {
    if (recStatus === 'recording') return
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showNotice('this device has no way to listen. fragment not captured.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const n = ++fragmentCountRef.current
        const dur = Math.max(1, Math.round(recElapsedRef.current))
        setSignals(sigs => [
          { id: `mine-${Date.now()}`, title: `your fragment ${n} — released here`, duration: dur, url, mine: true },
          ...sigs,
        ])
        recElapsedRef.current = 0
        setRecElapsed(0)
        stream.getTracks().forEach(tr => tr.stop())
        streamRef.current = null
        spawnWhisper('a new fragment settles into the room', false)
        bumpEnergy(10)
      }
      recorderRef.current = rec
      rec.start()
      recElapsedRef.current = 0
      setRecElapsed(0)
      setRecStatus('recording')
    } catch {
      showNotice('the room couldn’t hear you — mic unavailable. it’s okay.')
      setRecStatus('idle')
    }
  }

  const stopRecording = () => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    } catch { /* no-op */ }
    setRecStatus('idle')
  }

  return (
    <div
      ref={shellRef}
      className={`eco-room-shell room-state--${state} ${leaving ? 'eco-room-shell--leaving' : ''}`}
      style={{ '--room-accent-rgb': room.accentRgb } as CSSProperties}
    >
      <div className="eco-room-aura" aria-hidden="true" />

      {/* drifting particles */}
      <div className="eco-particle-field" aria-hidden="true">
        {particles.map(p => (
          <span
            key={p.id}
            className="eco-particle"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              opacity: p.alpha,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* floating clickable signal nodes */}
      <div className="eco-node-field">
        {nodes.map(n => (
          <button
            key={n.id}
            type="button"
            className={`eco-signal-node ${touchedNode === n.id ? 'eco-signal-node--touched' : ''}`}
            style={{
              left: `${n.left}%`,
              top: `${n.top}%`,
              width: n.size,
              height: n.size,
              animationDuration: `${n.dur}s`,
              animationDelay: `${n.delay}s`,
            }}
            onClick={() => handleNodeTouch(n)}
            aria-label="touch a drifting signal node"
          />
        ))}
      </div>

      {/* floating whispers */}
      <div className="eco-whisper-field" aria-hidden="true">
        {whispers.map(w => (
          <span
            key={w.id}
            className={`eco-float-whisper ${w.mine ? 'eco-float-whisper--mine' : ''}`}
            style={{ top: `${w.top}%`, animationDuration: `${w.dur}s` }}
          >
            {w.text}
          </span>
        ))}
      </div>

      {/* reaction pops */}
      <div className="eco-pop-field" aria-hidden="true">
        {pops.map(p => (
          <span key={p.id} className="eco-reaction-pop" style={{ left: `${p.left}%` }}>
            {p.glyph}
          </span>
        ))}
      </div>

      {/* header */}
      <header className="eco-room-header">
        <button type="button" className="eco-room-back" onClick={onExit}>← surface</button>
        <div className="eco-room-title-wrap">
          <span className="eco-room-statechip">{state.replace(/-/g, ' ')}</span>
          <h2 className="eco-room-title">{room.name}</h2>
          <p className="eco-room-tagline">{room.tagline}</p>
        </div>
        <button type="button" className="eco-room-drift" onClick={onDrift}>drift elsewhere ⇝</button>
      </header>

      {/* live vitals */}
      <div className="eco-room-vitals">
        <span className="eco-vital">
          <i className="eco-live-dot" aria-hidden="true" />
          {listeners} listening
        </span>
        <span className="eco-vital eco-vital--weather">
          <span aria-hidden="true">{STATE_GLYPH[state]}</span> {weather}
        </span>
        <span className="eco-vital eco-vital--freq">{room.frequency}</span>
      </div>

      <div className="eco-room-meters">
        <div className="eco-meter">
          <span className="eco-meter-label">resonance</span>
          <div className="eco-meter-track">
            <div className="eco-meter-fill eco-meter-fill--resonance" style={{ width: `${resonance}%` }} />
          </div>
          <span className="eco-meter-num">{Math.round(resonance)}%</span>
        </div>
        <div className="eco-meter">
          <span className="eco-meter-label">room energy</span>
          <div className="eco-meter-track">
            <div className="eco-meter-fill eco-meter-fill--energy" style={{ width: `${energy}%` }} />
          </div>
          <span className="eco-meter-num">{energy}%</span>
        </div>
      </div>

      {/* active carriers */}
      <div className="eco-carrier-strip">
        {carriers.slice(0, carrierCount).map(c => (
          <span key={c.id} className="eco-carrier" style={{ animationDelay: `${c.delay}s` }}>
            <i className="eco-carrier-pulse" aria-hidden="true" />
            {c.tag}
          </span>
        ))}
        <span className="eco-carrier eco-carrier--you">
          <i className="eco-carrier-pulse" aria-hidden="true" />
          you
        </span>
      </div>

      {/* signal list + replay */}
      <section className="eco-signal-list">
        <h3 className="eco-section-label">room signals</h3>
        {signals.map(sig => {
          const isPlaying = playback?.id === sig.id
          return (
            <div key={sig.id} className={`eco-signal-row ${isPlaying ? 'eco-signal-row--playing' : ''} ${sig.mine ? 'eco-signal-row--mine' : ''}`}>
              <button
                type="button"
                className="eco-signal-play"
                onClick={() => handleReplay(sig)}
                aria-label={isPlaying ? 'stop playback' : 'replay signal'}
              >
                {isPlaying ? '◼' : '▸'}
              </button>
              <div className="eco-signal-meta">
                <span className="eco-signal-title">{sig.title}</span>
                {isPlaying ? (
                  <div className="eco-playback-row">
                    <div className="eco-playback-wave" aria-hidden="true">
                      {Array.from({ length: 14 }, (_, i) => (
                        <i key={i} style={{ animationDelay: `${i * 0.08}s` }} />
                      ))}
                    </div>
                    <span className="eco-playback-timer">
                      {fmtTime(playback.elapsed)} / {fmtTime(sig.duration)}
                    </span>
                  </div>
                ) : (
                  <span className="eco-signal-duration">{fmtTime(sig.duration)}</span>
                )}
              </div>
            </div>
          )
        })}
      </section>

      {/* interaction dock */}
      <div className="eco-room-dock">
        <div className="eco-dock-row eco-dock-row--reactions">
          {REACTION_GLYPHS.map(g => (
            <button key={g} type="button" className="eco-reaction-btn" onClick={() => handleReaction(g)}>
              {g}
            </button>
          ))}
          <button
            type="button"
            className={`eco-record-btn ${recStatus === 'recording' ? 'eco-record-btn--live' : ''}`}
            onClick={recStatus === 'recording' ? stopRecording : startRecording}
          >
            {recStatus === 'recording' ? `releasing… ${recElapsed.toFixed(0)}s ◼` : '● leave a fragment'}
          </button>
          <button
            type="button"
            className={`eco-ambient-toggle ${ambientOn ? 'eco-ambient-toggle--on' : ''}`}
            onClick={onToggleAmbient}
          >
            ambient {ambientOn ? 'on ∿' : 'off ◌'}
          </button>
        </div>
        {audioBlocked && <p className="eco-soft-error">ambient drone unavailable on this device. the room stays quiet.</p>}
        <div className="eco-dock-row eco-dock-row--whisper">
          <input
            type="text"
            className="eco-whisper-input"
            placeholder="leave a whisper drifting through…"
            maxLength={70}
            value={whisperText}
            onChange={e => setWhisperText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleWhisperSubmit()}
          />
          <button type="button" className="eco-whisper-send" onClick={handleWhisperSubmit}>
            release
          </button>
        </div>
      </div>

      {notice && <div className="eco-notice">{notice}</div>}
    </div>
  )
}

// ─── Main screen ───────────────────────────────────────────────
export default function RoomsScreen() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [ambientOn, setAmbientOn] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const engineRef = useRef<AmbientEngine | null>(null)
  const driftTimerRef = useRef<number | null>(null)

  const activeRoom = ROOMS.find(r => r.id === activeId) ?? null

  useEffect(() => {
    return () => {
      if (driftTimerRef.current !== null) window.clearTimeout(driftTimerRef.current)
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  const getEngine = (): AmbientEngine => {
    if (!engineRef.current) engineRef.current = new AmbientEngine()
    return engineRef.current
  }

  const handleEnter = (room: RoomDef) => {
    setLeaving(false)
    setActiveId(room.id)
    // ambient stays OFF by default — user must toggle it on
  }

  const handleExit = () => {
    engineRef.current?.setOn(false)
    setAmbientOn(false)
    setLeaving(true)
    driftTimerRef.current = window.setTimeout(() => {
      setActiveId(null)
      setLeaving(false)
    }, 420)
  }

  const handleDrift = () => {
    if (!activeRoom) return
    const others = ROOMS.filter(r => r.id !== activeRoom.id)
    const next = others[Math.floor(Math.random() * others.length)]
    setLeaving(true)
    driftTimerRef.current = window.setTimeout(() => {
      setActiveId(next.id)
      setLeaving(false)
      if (ambientOn) {
        const e = getEngine()
        e.tune(next.audio)
        e.setOn(true)
      }
    }, 420)
  }

  const handleToggleAmbient = () => {
    if (!activeRoom) return
    const e = getEngine()
    if (!ambientOn) {
      e.tune(activeRoom.audio)
      e.setOn(true)
      if (e.failed) {
        setAudioBlocked(true)
        return
      }
      setAmbientOn(true)
    } else {
      e.setOn(false)
      setAmbientOn(false)
    }
  }

  if (activeRoom) {
    return (
      <div className="rooms-eco rooms-eco--inroom">
        <RoomView
          key={activeRoom.id}
          room={activeRoom}
          leaving={leaving}
          ambientOn={ambientOn}
          audioBlocked={audioBlocked}
          onToggleAmbient={handleToggleAmbient}
          onExit={handleExit}
          onDrift={handleDrift}
          engine={engineRef.current}
        />
      </div>
    )
  }

  return (
    <div className="rooms-eco">
      <div className="rooms-eco-shell">
        <header className="rooms-eco-header">
          <span className="rooms-eco-kicker">live frequency spaces</span>
          <h1 className="rooms-eco-title">rooms</h1>
          <p className="rooms-eco-sub">temporary emotional weather systems. drift through together.</p>
        </header>

        <div className="rooms-eco-grid">
          {ROOMS.map(room => (
            <RoomCard key={room.id} room={room} onEnter={() => handleEnter(room)} />
          ))}
        </div>

        <footer className="rooms-eco-hint">
          <p>rooms are temporary. carriers drift through. nothing here stays forever.</p>
        </footer>
      </div>
    </div>
  )
}
