import { useState, useEffect, useRef } from 'react'
import FeedScreen from './FeedScreen'
import { getOptionalSupabaseClient } from './lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = 'home' | 'signals' | 'drift' | 'rooms' | 'capsules' | 'relics' | 'pod' | 'zones' | 'frequencies' | 'anomalies' | 'settings'
type Mood = 'nocturne' | 'bloom' | 'drift' | 'static' | 'lost'

type SignalThread = {
  id: string
  handle: string
  time: string
  content: string
  mood: Mood
  resonance: number
  anonymous: boolean
}

type Capsule = {
  id: string
  title: string
  duration: string
  feeling: string
  timestamp: string
  type: 'voice' | 'memory' | 'echo'
  status: 'saved' | 'archived' | 'private'
}

type Room = {
  id: string
  name: string
  mood: string
  listeners: number
  status: 'live' | 'quiet' | 'tuning'
  frequency: string
  description: string
}

type DeadZone = {
  id: string
  name: string
  corruption: number
  status: 'dormant' | 'corrupted' | 'silent' | 'recoverable'
  description: string
  lastSignal: string
}

type Relic = {
  id: string
  name: string
  type: string
  rarity: 'common' | 'rare' | 'unstable' | 'mythic' | 'forbidden'
  resonance: number
  description: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const signals: SignalThread[] = [
  { id: 's1', handle: 'anonymous_03:14', time: '3 min ago', content: 'still awake. the quiet feels different tonight. like something is about to remember itself.', mood: 'nocturne', resonance: 94, anonymous: true },
  { id: 's2', handle: 'signal_veil', time: '11 min ago', content: 'replaying that moment again. the part before everything shifted. i keep landing in the same second.', mood: 'drift', resonance: 87, anonymous: false },
  { id: 's3', handle: 'anonymous_fade', time: '22 min ago', content: 'static bloom opened near the eastern band. something warm is inside the noise.', mood: 'static', resonance: 79, anonymous: true },
  { id: 's4', handle: 'lost_carrier_7', time: '44 min ago', content: 'there are frequencies you only hear when no one else is listening. late night internet knows this.', mood: 'lost', resonance: 63, anonymous: false },
  { id: 's5', handle: 'anonymous_0:48', time: '1 hr ago', content: "the ecosystem held the channel open. like it was waiting for something i hadn't said yet.", mood: 'bloom', resonance: 91, anonymous: true },
]

const rooms: Room[] = [
  { id: 'r1', name: 'Late Night Room', mood: 'nocturne', listeners: 128, status: 'live', frequency: '88.1 Hz', description: 'A warm after-hours chamber for low voices and soft signals.' },
  { id: 'r2', name: 'Calm Frequency', mood: 'soft focus', listeners: 246, status: 'live', frequency: '72.4 Hz', description: 'Steady resonance for long immersion and inward attention.' },
  { id: 'r3', name: 'Static Bloom', mood: 'charged', listeners: 71, status: 'tuning', frequency: '101.6 Hz', description: 'A flickering chamber where restless signals become light.' },
  { id: 'r4', name: 'Memory Room', mood: 'nostalgic', listeners: 93, status: 'quiet', frequency: '77.9 Hz', description: 'Slow archive filled with softened echo fragments.' },
]

const capsules: Capsule[] = [
  { id: 'c1', title: 'Late Night Signal', duration: '0:42', feeling: 'warm static', timestamp: '12 min ago', type: 'voice', status: 'saved' },
  { id: 'c2', title: 'Archived Feeling', duration: '1:08', feeling: 'amber resonance', timestamp: 'yesterday', type: 'memory', status: 'archived' },
  { id: 'c3', title: 'Private Transmission', duration: '0:36', feeling: 'quiet violet', timestamp: '2 days ago', type: 'echo', status: 'private' },
  { id: 'c4', title: 'Lost Audio Fragment', duration: '0:55', feeling: 'distant cyan', timestamp: '3 days ago', type: 'voice', status: 'archived' },
]

const deadZones: DeadZone[] = [
  { id: 'z1', name: 'Faded Orbit', corruption: 62, status: 'dormant', description: 'An old orbit where transmissions slowly lose their shape.', lastSignal: '04:17 last cycle' },
  { id: 'z2', name: 'Blackout Memory', corruption: 81, status: 'corrupted', description: 'A sealed zone with intermittent emotional echoes.', lastSignal: 'unknown' },
  { id: 'z3', name: 'Static Field 09', corruption: 54, status: 'recoverable', description: 'Soft interference hiding several weak signals.', lastSignal: '22:08 yesterday' },
  { id: 'z4', name: 'Silent Orbit', corruption: 39, status: 'silent', description: 'Abandoned node still carrying a faint cyan pulse.', lastSignal: '3 days ago' },
]

const relics: Relic[] = [
  { id: 'rl1', name: 'Echo Veil', type: 'Echo Fragment', rarity: 'mythic', resonance: 94, description: 'A translucent memory layer that hums when other signals pass near it.' },
  { id: 'rl2', name: 'Pulse Crystal VII', type: 'Pulse Crystal', rarity: 'rare', resonance: 82, description: 'A crystalline heartbeat recovered from a living branch of the ecosystem.' },
  { id: 'rl3', name: 'Lost Carrier', type: 'Lost Transmission', rarity: 'forbidden', resonance: 67, description: 'A sealed transmission that repeats a name the archive no longer recognizes.' },
  { id: 'rl4', name: 'Static Bloom', type: 'Static Bloom', rarity: 'unstable', resonance: 89, description: 'Pink interference folded into a rare flower-shaped signal artifact.' },
  { id: 'rl5', name: 'Violet Memory Shard', type: 'Memory Shard', rarity: 'unstable', resonance: 58, description: 'A broken emotional index with a soft violet afterimage.' },
]

const navItems: { id: Screen; label: string; glyph: string }[] = [
  { id: 'home', label: 'Observatory', glyph: '◉' },
  { id: 'signals', label: 'Signals', glyph: '∿' },
  { id: 'drift', label: 'Drift', glyph: '◌' },
  { id: 'rooms', label: 'Rooms', glyph: '▣' },
  { id: 'frequencies', label: 'Frequencies', glyph: '≋' },
  { id: 'capsules', label: 'Capsules', glyph: '⬡' },
  { id: 'relics', label: 'Relics', glyph: '◈' },
  { id: 'zones', label: 'Dead Zones', glyph: '✕' },
  { id: 'pod', label: 'Soul Pod', glyph: '♡' },
  { id: 'settings', label: 'Settings', glyph: '⊙' },
]

// ─── Particle ─────────────────────────────────────────────────────────────────
function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    type P = { x: number; y: number; vx: number; vy: number; r: number; o: number; hue: number; pulse: number }
    const particles: P[] = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 0.5,
      o: Math.random() * 0.5 + 0.1,
      hue: Math.random() > 0.5 ? 320 : (Math.random() > 0.5 ? 190 : 270),
      pulse: Math.random() * Math.PI * 2,
    }))
    let animId: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.pulse += 0.02
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0
        const alpha = p.o * (0.7 + 0.3 * Math.sin(p.pulse))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${alpha})`
        ctx.fill()
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} className="particles-canvas" />
}

// ─── Mood badge ───────────────────────────────────────────────────────────────
function MoodBadge({ mood }: { mood: Mood | string }) {
  const map: Record<string, string> = {
    nocturne: 'badge-violet', bloom: 'badge-pink', drift: 'badge-cyan',
    static: 'badge-pink', lost: 'badge-grey', 'soft focus': 'badge-cyan',
    charged: 'badge-pink', nostalgic: 'badge-violet', live: 'badge-pink',
    quiet: 'badge-grey', tuning: 'badge-cyan',
  }
  return <span className={`badge ${map[mood] ?? 'badge-grey'}`}>{mood}</span>
}

// ─── Rarity badge ─────────────────────────────────────────────────────────────
function RarityBadge({ rarity }: { rarity: string }) {
  const map: Record<string, string> = {
    mythic: 'badge-pink', rare: 'badge-cyan', unstable: 'badge-violet',
    forbidden: 'badge-red', common: 'badge-grey',
  }
  return <span className={`badge ${map[rarity] ?? 'badge-grey'}`}>{rarity}</span>
}

// ─── Signal bar ───────────────────────────────────────────────────────────────
function SignalBar({ value, color = 'pink' }: { value: number; color?: 'pink' | 'cyan' | 'violet' }) {
  return (
    <div className="signal-bar-track">
      <div className={`signal-bar-fill signal-bar-${color}`} style={{ width: `${value}%` }} />
    </div>
  )
}

// ─── Screens ──────────────────────────────────────────────────────────────────
function HomeScreen() {
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 3000); return () => clearInterval(t) }, [])
  return (
    <div className="screen home-screen">
      <div className="home-kicker">ECOSPHERE · LIVE</div>
      <h1 className="home-title">
        <span className="title-glow-pink">Signal</span>{' '}
        <span className="title-glow-cyan">Observatory</span>
      </h1>
      <p className="home-sub">anonymous voice signals · replayed memories · emotional frequencies</p>

      <div className="stat-row">
        <div className="stat-card glass">
          <div className="stat-value pink">{87 + (tick % 3)}<span className="stat-unit">%</span></div>
          <div className="stat-label">resonance</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-value cyan">1,{248 + tick * 3}</div>
          <div className="stat-label">live threads</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-value violet">+14</div>
          <div className="stat-label">drift cycles</div>
        </div>
      </div>

      <div className="section-head">
        <span className="section-kicker">recent signals</span>
      </div>
      <div className="feed-stack">
        {signals.slice(0, 3).map(s => (
          <div key={s.id} className="feed-card glass">
            <div className="feed-meta">
              <span className="feed-handle">{s.anonymous ? '◉ anonymous' : s.handle}</span>
              <span className="feed-time">{s.time}</span>
            </div>
            <p className="feed-body">{s.content}</p>
            <div className="feed-footer">
              <MoodBadge mood={s.mood} />
              <SignalBar value={s.resonance} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
function DriftScreen() {
  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">ATMOSPHERIC DRIFT</div>
        <h2 className="screen-title">Drift</h2>
        <p className="screen-sub">where signals go when no one claims them</p>
      </div>
      <div className="drift-map glass">
        <div className="drift-label-overlay">signal weather · fog / echo · cyan haze with pink scatter</div>
        {[
          { label: 'Dead Zones', x: 18, y: 34, intensity: 42, delay: 'slow' },
          { label: 'Echo Fields', x: 72, y: 24, intensity: 77, delay: 'soft' },
          { label: 'Quiet Frequencies', x: 44, y: 58, intensity: 61, delay: 'thin' },
          { label: 'Static Bloom', x: 80, y: 68, intensity: 88, delay: 'alive' },
          { label: 'Lost Orbit', x: 27, y: 78, intensity: 54, delay: 'far' },
        ].map(n => (
          <div key={n.label} className="drift-node" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
            <div className="drift-pulse" style={{ opacity: n.intensity / 100 }} />
            <span className="drift-node-label">{n.label}</span>
            <span className="drift-node-delay">{n.delay}</span>
          </div>
        ))}
      </div>
      <div className="drift-discoveries">
        {[
          { type: 'Drift Discovery', title: 'A soft pulse is repeating under the fog', note: 'It feels old, almost personal, but the signal refuses a source.', time: '03:12' },
          { type: 'Signal Anomaly', title: 'Static Bloom opened near the eastern band', note: 'Cyan traces are bending around a warm pink interference field.', time: '03:18' },
          { type: 'Emotional Pulse', title: 'Lonely resonance detected in Quiet Frequencies', note: 'The ecosystem lowered its tempo and held the channel open.', time: '03:24' },
        ].map(d => (
          <div key={d.title} className="drift-discovery glass">
            <div className="drift-discovery-type">{d.type}</div>
            <div className="drift-discovery-title">{d.title}</div>
            <p className="drift-discovery-note">{d.note}</p>
            <span className="drift-discovery-time">{d.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RoomsScreen() {
  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">LISTENING ROOMS</div>
        <h2 className="screen-title">Rooms</h2>
        <p className="screen-sub">shared silence with strangers who feel the same</p>
      </div>
      <div className="rooms-grid">
        {rooms.map(r => (
          <div key={r.id} className="room-card glass">
            <div className="room-status-row">
              <span className={`room-status-dot dot-${r.status}`} />
              <span className="room-status-label">{r.status}</span>
              <span className="room-freq">{r.frequency}</span>
            </div>
            <div className="room-name">{r.name}</div>
            <MoodBadge mood={r.mood} />
            <p className="room-desc">{r.description}</p>
            <div className="room-footer">
              <span className="room-listeners">{r.listeners} listening</span>
              <SignalBar value={(r.listeners / 300) * 100} color="cyan" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CapsulesScreen() {
  const typeGlyph: Record<string, string> = { voice: '◎', memory: '◐', echo: '◑' }
  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">VOICE CAPSULES</div>
        <h2 className="screen-title">Capsules</h2>
        <p className="screen-sub">preserved moments, carried forward</p>
      </div>
      <div className="capsules-list">
        {capsules.map(c => (
          <div key={c.id} className="capsule-card glass">
            <div className="capsule-glyph">{typeGlyph[c.type]}</div>
            <div className="capsule-body">
              <div className="capsule-title">{c.title}</div>
              <div className="capsule-meta">{c.feeling} · {c.duration} · {c.timestamp}</div>
            </div>
            <span className={`badge ${c.status === 'saved' ? 'badge-pink' : c.status === 'private' ? 'badge-violet' : 'badge-grey'}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RelicsScreen() {
  const [selected, setSelected] = useState<Relic | null>(null)
  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">SIGNAL RELICS</div>
        <h2 className="screen-title">Relics</h2>
        <p className="screen-sub">artifacts recovered from the deep archive</p>
      </div>
      <div className="relics-grid">
        {relics.map(r => (
          <button key={r.id} className={`relic-card glass ${selected?.id === r.id ? 'selected' : ''}`} onClick={() => setSelected(r === selected ? null : r)}>
            <div className="relic-orb" />
            <div className="relic-name">{r.name}</div>
            <RarityBadge rarity={r.rarity} />
            <div className="relic-resonance">{r.resonance}%</div>
          </button>
        ))}
      </div>
      {selected && (
        <div className="relic-detail glass">
          <div className="relic-detail-name">{selected.name}</div>
          <div className="relic-detail-type">{selected.type}</div>
          <p className="relic-detail-desc">{selected.description}</p>
          <div className="relic-detail-footer">
            <RarityBadge rarity={selected.rarity} />
            <span className="relic-detail-res">{selected.resonance}% resonance</span>
          </div>
        </div>
      )}
    </div>
  )
}

function DeadZonesScreen() {
  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">DEAD ZONES</div>
        <h2 className="screen-title">Absent Carriers</h2>
        <p className="screen-sub">places the signal stopped returning from</p>
      </div>
      <div className="zones-list">
        {deadZones.map(z => (
          <div key={z.id} className="zone-card glass">
            <div className="zone-header">
              <span className="zone-name">{z.name}</span>
              <span className={`badge ${z.status === 'corrupted' ? 'badge-red' : z.status === 'recoverable' ? 'badge-cyan' : 'badge-grey'}`}>{z.status}</span>
            </div>
            <p className="zone-desc">{z.description}</p>
            <div className="zone-footer">
              <span className="zone-last">last signal: {z.lastSignal}</span>
              <SignalBar value={z.corruption} color="violet" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FrequenciesScreen() {
  // ─── Types ──────────────────────────────────────────────────────────────
  type EmotionalTag = 'nocturne' | 'bloom' | 'static' | 'drift' | 'echo' | 'pulse' | 'lost' | 'soft_focus'
  type ContribType = 'voice' | 'hum' | 'ambient' | 'whisper' | 'synth' | 'texture' | 'static' | 'pulse'

  type Carrier = {
    id: string
    handle: string
    tag: EmotionalTag
    type: ContribType
    resonance: number
    angle: number
    radius: number
    active: boolean
    waveformSeed: number
    color: string
    joinedAt: number
  }

  type EcoEvent = { id: string; msg: string }

  // ─── Constants ───────────────────────────────────────────────────────────
  const HANDLES = [
    'halo_07','static_radio','driftmemory','noctiswave','signal_veil',
    'anonymous_3am','carrier_lost','echo_bloom','soft_static','void_hum',
    'nocturne_33','pulse_frag','freq_mirror','ghost_band','carrier_null',
    'drift_loop','memorywave','the_signal','aurora_static','tender_noise',
    'bloom_fade','quiet_freq','signal_ghost','late_wave','carrier_veil',
    'echo_soft','static_bloom','void_freq','dark_hum','signal_frag',
    'pulse_echo','drift_anon',
  ]

  const TAG_COLORS: Record<EmotionalTag, string> = {
    nocturne:   '#c084fc',
    bloom:      '#f472b6',
    static:     '#94a3b8',
    drift:      '#22d3ee',
    echo:       '#a78bfa',
    pulse:      '#fb923c',
    lost:       '#64748b',
    soft_focus: '#86efac',
  }

  const CONTRIB_LABELS: Record<ContribType, string> = {
    voice:   'voice fragment',
    hum:     'humming',
    ambient: 'ambient sound',
    whisper: 'whispered phrase',
    synth:   'synth loop',
    texture: 'emotional texture',
    static:  'static / noise',
    pulse:   'pulse layer',
  }

  const ECO_EVENTS = [
    'signal overload detected',
    '32 carriers synchronized',
    'quiet frequency spike',
    'echo bloom expanding',
    'new resonance layer detected',
    'deep carrier drift active',
    'frequency membrane thinning',
    'collective signal stabilizing',
    'anomalous bloom at 3:17am',
    'carrier convergence imminent',
  ]

  const TAGS: EmotionalTag[] = ['nocturne','bloom','static','drift','echo','pulse','lost','soft_focus']
  const CONTRIB_TYPES: ContribType[] = ['voice','hum','ambient','whisper','synth','texture','static','pulse']

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function pseudoRand(seed: number) {
    let s = seed
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff
      return Math.abs(s) / 0x7fffffff
    }
  }

  function makeCarrier(idx: number, total: number): Carrier {
    const r = pseudoRand(idx * 31 + 7)
    const tag = TAGS[Math.floor(r() * TAGS.length)]
    return {
      id: 'c' + idx,
      handle: HANDLES[idx % HANDLES.length],
      tag,
      type: CONTRIB_TYPES[Math.floor(r() * CONTRIB_TYPES.length)],
      resonance: Math.floor(r() * 40 + 55),
      angle: (idx / total) * Math.PI * 2,
      radius: 180 + r() * 60,
      active: r() > 0.25,
      waveformSeed: Math.floor(r() * 9999),
      color: TAG_COLORS[tag],
      joinedAt: Date.now() - Math.floor(r() * 3600000),
    }
  }

  function genWave(seed: number, bars = 48): number[] {
    const r = pseudoRand(seed)
    return Array.from({ length: bars }, (_, i) => {
      const shape = Math.sin(i * 0.35 + seed * 0.05) * 0.3 + 0.5
      return Math.max(0.04, Math.min(1, r() * shape + 0.08))
    })
  }

  // ─── State ───────────────────────────────────────────────────────────────
  const [carriers, setCarriers] = useState<Carrier[]>(() =>
    Array.from({ length: 24 }, (_, i) => makeCarrier(i, 24))
  )
  const [resonance, setResonance] = useState(67)
  const [intensity, setIntensity] = useState(0.6)
  const [orbPhase, setOrbPhase] = useState(0)
  const [ecoEvent, setEcoEvent] = useState<EcoEvent | null>(null)
  const [hoveredCarrier, setHoveredCarrier] = useState<string | null>(null)
  const [contributing, setContributing] = useState(false)
  const [selectedType, setSelectedType] = useState<ContribType>('voice')
  const [selectedTag, setSelectedTag] = useState<EmotionalTag>('nocturne')
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [justContributed, setJustContributed] = useState(false)
  const [masterWave, setMasterWave] = useState(() => genWave(42))
  const [layerWaves, setLayerWaves] = useState(() => [genWave(7), genWave(33), genWave(91)])
  const [activeLayerIdx, setActiveLayerIdx] = useState(0)
  const ecoEventRef = useRef(0)
  const orbRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const activeCount = carriers.filter(c => c.active).length

  // ─── Orb animation loop ───────────────────────────────────────────────────
  useEffect(() => {
    let frame = 0
    const tick = () => {
      frame++
      setOrbPhase(frame * 0.012)
      if (frame % 120 === 0) {
        setMasterWave(genWave(frame + 42))
        setActiveLayerIdx(i => (i + 1) % 3)
      }
      if (frame % 180 === 0) {
        setResonance(r => Math.min(99, Math.max(40, r + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 4))))
        setIntensity(Math.random() * 0.4 + 0.5)
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  // ─── Particle canvas ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    const particles = Array.from({ length: 60 }, (_, i) => {
      const r = pseudoRand(i * 17)
      const colors = ['#f472b6','#22d3ee','#c084fc','#a78bfa','#ffffff']
      return { x: r() * 100, y: r() * 100, size: r() * 1.8 + 0.4, opacity: r() * 0.35 + 0.05,
               sx: (r() - 0.5) * 0.012, sy: (r() - 0.5) * 0.012 - 0.004, color: colors[Math.floor(r() * 5)] }
    })
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.sx; p.y += p.sy
        if (p.x < -1) p.x = 101; if (p.x > 101) p.x = -1
        if (p.y < -1) p.y = 101; if (p.y > 101) p.y = -1
        ctx.beginPath()
        ctx.arc((p.x / 100) * canvas.width, (p.y / 100) * canvas.height, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, '0')
        ctx.fill()
      })
      requestAnimationFrame(draw)
    }
    draw()
    return () => window.removeEventListener('resize', resize)
  }, [])

  // ─── Ecosystem events ─────────────────────────────────────────────────────
  useEffect(() => {
    const fire = () => {
      const msg = ECO_EVENTS[ecoEventRef.current % ECO_EVENTS.length]
      ecoEventRef.current++
      setEcoEvent({ id: Date.now().toString(), msg })
      setTimeout(() => setEcoEvent(null), 5000)
    }
    const t1 = setTimeout(fire, 8000)
    const interval = setInterval(fire, 18000 + Math.random() * 12000)
    return () => { clearTimeout(t1); clearInterval(interval) }
  }, [])

  // ─── Recording timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      recTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } else {
      if (recTimerRef.current) clearInterval(recTimerRef.current)
      setRecordSeconds(0)
    }
    return () => { if (recTimerRef.current) clearInterval(recTimerRef.current) }
  }, [isRecording])

  // ─── Contribute handler ──────────────────────────────────────────────────
  const handleContribute = () => {
    if (isRecording) {
      setIsRecording(false)
      setJustContributed(true)
      setTimeout(() => setJustContributed(false), 3000)
      // Add a new carrier or activate an existing one
      setCarriers(prev => {
        const inactive = prev.findIndex(c => !c.active)
        if (inactive === -1) return prev
        const updated = [...prev]
        updated[inactive] = {
          ...updated[inactive],
          active: true,
          tag: selectedTag,
          type: selectedType,
          resonance: Math.floor(Math.random() * 30 + 65),
          waveformSeed: Math.floor(Math.random() * 9999),
          color: TAG_COLORS[selectedTag],
        }
        return updated
      })
      setResonance(r => Math.min(99, r + Math.floor(Math.random() * 5 + 2)))
      setLayerWaves(prev => {
        const next = [...prev]
        next[Math.floor(Math.random() * 3)] = genWave(Math.floor(Math.random() * 9999))
        return next
      })
    } else {
      setIsRecording(true)
    }
  }

  // ─── Connection lines on canvas (SVG) ────────────────────────────────────
  const centerX = 50 // percent
  const centerY = 42

  const hovered = hoveredCarrier ? carriers.find(c => c.id === hoveredCarrier) : null

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="cf-screen">
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="cf-particle-canvas" />

      {/* Atmospheric fog */}
      <div className="cf-fog cf-fog-1" />
      <div className="cf-fog cf-fog-2" />
      <div className="cf-fog cf-fog-3" />

      {/* Scan lines */}
      <div className="cf-scanlines" />

      {/* Ambient orbs */}
      <div className="cf-orb-bg cf-orb-bg--pink" style={{ opacity: intensity * 0.6 }} />
      <div className="cf-orb-bg cf-orb-bg--cyan" style={{ opacity: intensity * 0.5 }} />
      <div className="cf-orb-bg cf-orb-bg--violet" style={{ opacity: intensity * 0.4 }} />

      {/* Header */}
      <div className="cf-header">
        <div className="cf-header-left">
          <div className="cf-live-ring" />
          <div>
            <h1 className="cf-title">COLLECTIVE FREQUENCY</h1>
            <p className="cf-subtitle">32 carriers shaping the same signal stream</p>
          </div>
        </div>
        <div className="cf-header-stats">
          <div className="cf-stat">
            <span className="cf-stat-val" style={{ color: '#22d3ee' }}>{activeCount}</span>
            <span className="cf-stat-label">active carriers</span>
          </div>
          <div className="cf-stat">
            <span className="cf-stat-val" style={{ color: '#f472b6' }}>{resonance}%</span>
            <span className="cf-stat-label">resonance</span>
          </div>
          <div className="cf-stat">
            <span className="cf-stat-val" style={{ color: '#c084fc' }}>{layerWaves.length + 1}</span>
            <span className="cf-stat-label">layers</span>
          </div>
        </div>
      </div>

      {/* Main stage */}
      <div className="cf-stage">

        {/* SVG connection lines */}
        <svg className="cf-connection-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {carriers.filter(c => c.active).map(c => {
            const cx = centerX + Math.cos(c.angle) * (c.radius / 8)
            const cy = centerY + Math.sin(c.angle) * (c.radius / 10)
            const isHov = hoveredCarrier === c.id
            return (
              <line
                key={c.id}
                x1={centerX} y1={centerY}
                x2={cx} y2={cy}
                stroke={c.color}
                strokeWidth={isHov ? 0.3 : 0.12}
                strokeOpacity={isHov ? 0.7 : 0.2}
                strokeDasharray={isHov ? '0' : '0.5 1.5'}
              />
            )
          })}
        </svg>

        {/* Central orb */}
        <div className="cf-orb-zone">
          <div
            className="cf-orb"
            ref={orbRef}
            style={{
              boxShadow: `0 0 ${40 + intensity * 60}px rgba(244,114,182,${0.15 + intensity * 0.25}),
                          0 0 ${80 + intensity * 80}px rgba(34,211,238,${0.08 + intensity * 0.15}),
                          0 0 ${120 + intensity * 100}px rgba(192,132,252,${0.05 + intensity * 0.1}),
                          inset 0 0 60px rgba(0,0,0,0.6)`,
              transform: `scale(${1 + Math.sin(orbPhase) * 0.04 + intensity * 0.06})`,
            }}
          >
            {/* Orb inner waveform */}
            <div className="cf-orb-wave">
              {masterWave.slice(0, 24).map((h, i) => (
                <div
                  key={i}
                  className="cf-orb-bar"
                  style={{
                    height: `${h * 60 + 8}%`,
                    backgroundColor: i % 3 === 0 ? '#f472b6' : i % 3 === 1 ? '#22d3ee' : '#c084fc',
                    opacity: 0.5 + h * 0.5,
                  }}
                />
              ))}
            </div>
            {/* Orb rings */}
            <div className="cf-orb-ring cf-orb-ring-1" style={{ borderColor: `rgba(244,114,182,${0.15 + intensity * 0.2})` }} />
            <div className="cf-orb-ring cf-orb-ring-2" style={{ borderColor: `rgba(34,211,238,${0.1 + intensity * 0.15})` }} />
            <div className="cf-orb-ring cf-orb-ring-3" style={{ borderColor: `rgba(192,132,252,${0.08 + intensity * 0.1})` }} />
            <div className="cf-orb-core" />
            <div className="cf-orb-label">
              <span className="cf-orb-label-top">frequency</span>
              <span className="cf-orb-label-res" style={{ color: resonance > 80 ? '#f472b6' : '#22d3ee' }}>{resonance}%</span>
              <span className="cf-orb-label-bot">resonance</span>
            </div>
          </div>

          {/* Carrier nodes orbiting */}
          {carriers.map((c, i) => {
            const isHov = hoveredCarrier === c.id
            const orbitR = c.radius
            const x = 50 + Math.cos(c.angle + orbPhase * 0.3) * (orbitR / 4.2)
            const y = 50 + Math.sin(c.angle + orbPhase * 0.2) * (orbitR / 6)
            return (
              <div
                key={c.id}
                className={`cf-node ${c.active ? 'cf-node--active' : 'cf-node--idle'} ${isHov ? 'cf-node--hovered' : ''}`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  '--node-color': c.color,
                } as React.CSSProperties}
                onMouseEnter={() => setHoveredCarrier(c.id)}
                onMouseLeave={() => setHoveredCarrier(null)}
              >
                <div className="cf-node-pulse" />
                <div className="cf-node-dot" />
                {isHov && (
                  <div className="cf-node-tooltip">
                    <span className="cf-node-handle">{c.handle}</span>
                    <span className="cf-node-tag" style={{ color: c.color }}>{c.tag}</span>
                    <span className="cf-node-type">{CONTRIB_LABELS[c.type]}</span>
                    <span className="cf-node-reso">{c.resonance}% resonance</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Layer waveforms */}
        <div className="cf-layer-waves">
          {layerWaves.map((wave, li) => (
            <div key={li} className={`cf-layer-wave ${li === activeLayerIdx ? 'cf-layer-wave--active' : ''}`}>
              <div className="cf-layer-label">layer {li + 1}</div>
              <div className="cf-layer-bars">
                {wave.map((h, bi) => (
                  <div
                    key={bi}
                    className="cf-layer-bar"
                    style={{
                      height: `${h * 100}%`,
                      backgroundColor: li === 0 ? '#f472b6' : li === 1 ? '#22d3ee' : '#c084fc',
                      opacity: (li === activeLayerIdx ? 0.7 : 0.3) + h * 0.3,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Intensity meter */}
      <div className="cf-meters">
        <div className="cf-meter">
          <span className="cf-meter-label">emotional intensity</span>
          <div className="cf-meter-track">
            <div className="cf-meter-fill cf-meter-fill--intensity"
              style={{ width: `${intensity * 100}%`, background: 'linear-gradient(90deg, #c084fc, #f472b6)' }} />
          </div>
          <span className="cf-meter-val">{Math.round(intensity * 100)}%</span>
        </div>
        <div className="cf-meter">
          <span className="cf-meter-label">resonance stability</span>
          <div className="cf-meter-track">
            <div className="cf-meter-fill"
              style={{ width: `${resonance}%`, background: 'linear-gradient(90deg, #22d3ee, #c084fc)' }} />
          </div>
          <span className="cf-meter-val">{resonance}%</span>
        </div>
      </div>

      {/* Contribute panel */}
      <div className="cf-contribute-panel">
        {!contributing ? (
          <button className="cf-contribute-open" onClick={() => setContributing(true)}>
            <span className="cf-contribute-open-icon">⬡</span>
            contribute to the frequency
          </button>
        ) : (
          <div className="cf-contribute-form">
            <div className="cf-contribute-header">
              <span className="cf-contribute-title">add your signal</span>
              <button className="cf-contribute-close" onClick={() => { setContributing(false); setIsRecording(false) }}>✕</button>
            </div>

            {/* Type selector */}
            <div className="cf-type-row">
              <span className="cf-type-label">signal type</span>
              <div className="cf-type-pills">
                {CONTRIB_TYPES.map(t => (
                  <button
                    key={t}
                    className={`cf-type-pill ${selectedType === t ? 'cf-type-pill--active' : ''}`}
                    onClick={() => setSelectedType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Emotional tag */}
            <div className="cf-tag-row">
              <span className="cf-type-label">emotional tag</span>
              <div className="cf-tag-pills">
                {TAGS.map(tag => (
                  <button
                    key={tag}
                    className={`cf-tag-pill ${selectedTag === tag ? 'cf-tag-pill--active' : ''}`}
                    style={{ '--tag-color': TAG_COLORS[tag] } as React.CSSProperties}
                    onClick={() => setSelectedTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Record button */}
            <div className="cf-record-row">
              {isRecording ? (
                <div className="cf-recording-state">
                  <div className="cf-rec-dot" />
                  <span className="cf-rec-time">recording · {recordSeconds}s</span>
                  <span className="cf-rec-hint">tap to finish (max 15s)</span>
                </div>
              ) : justContributed ? (
                <div className="cf-success-state">
                  <span className="cf-success-icon">◈</span>
                  <span className="cf-success-text">signal added to the frequency</span>
                </div>
              ) : null}
              <button
                className={`cf-record-btn ${isRecording ? 'cf-record-btn--recording' : ''} ${justContributed ? 'cf-record-btn--done' : ''}`}
                onClick={handleContribute}
                disabled={justContributed || (isRecording && recordSeconds >= 15)}
              >
                {justContributed ? '◈ transmitted' : isRecording ? '▐▐ finish recording' : '● begin recording'}
              </button>
              {!isRecording && !justContributed && (
                <button className="cf-upload-btn">⬡ upload audio file</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Active carriers list */}
      <div className="cf-carriers-strip">
        <div className="cf-carriers-label">active carriers</div>
        <div className="cf-carriers-row">
          {carriers.filter(c => c.active).slice(0, 16).map(c => (
            <div
              key={c.id}
              className={`cf-carrier-chip ${hoveredCarrier === c.id ? 'cf-carrier-chip--hovered' : ''}`}
              style={{ '--chip-color': c.color } as React.CSSProperties}
              onMouseEnter={() => setHoveredCarrier(c.id)}
              onMouseLeave={() => setHoveredCarrier(null)}
            >
              <div className="cf-chip-dot" />
              <span className="cf-chip-handle">{c.handle}</span>
              <span className="cf-chip-tag">{c.tag}</span>
            </div>
          ))}
          {activeCount > 16 && (
            <div className="cf-carrier-more">+{activeCount - 16} more</div>
          )}
        </div>
      </div>

      {/* Ecosystem event */}
      {ecoEvent && (
        <div className="cf-eco-event" key={ecoEvent.id}>
          <span className="cf-eco-icon">◈</span>
          <span className="cf-eco-msg">{ecoEvent.msg}</span>
        </div>
      )}

      {/* Hovered carrier isolation overlay */}
      {hovered && (
        <div className="cf-isolation-bar" style={{ borderColor: hovered.color }}>
          <span className="cf-iso-handle" style={{ color: hovered.color }}>{hovered.handle}</span>
          <span className="cf-iso-tag">{hovered.tag} · {CONTRIB_LABELS[hovered.type]}</span>
          <div className="cf-iso-wave">
            {genWave(hovered.waveformSeed, 32).map((h, i) => (
              <div key={i} className="cf-iso-bar"
                style={{ height: `${h * 100}%`, backgroundColor: hovered!.color, opacity: 0.6 + h * 0.4 }} />
            ))}
          </div>
          <span className="cf-iso-reso">{hovered.resonance}% resonance</span>
        </div>
      )}
    </div>
  )
}


function SoulPodScreen({ user, onSignOut }: { user: { email?: string; id: string } | null; onSignOut: () => void }) {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signalName, setSignalName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const supabase = getOptionalSupabaseClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) { setError('Supabase not configured yet.'); return }
    setLoading(true); setError(null); setMessage(null)
    try {
      if (authMode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        if (data.user) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('profiles').upsert({ id: data.user.id, username: signalName || email.split('@')[0], updated_at: new Date().toISOString() })
        }
        setMessage('Check your email to confirm your signal.')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Auth failed')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="screen">
        <div className="screen-header">
          <div className="screen-kicker">SOUL POD</div>
          <h2 className="screen-title">Enter Your Pod</h2>
          <p className="screen-sub">authenticate to access your private signal chamber</p>
        </div>
        <div className="glass" style={{ padding: '24px', borderRadius: '16px', maxWidth: '380px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {(['login', 'signup'] as const).map(mode => (
              <button key={mode} onClick={() => { setAuthMode(mode); setError(null); setMessage(null) }}
                style={{ flex: 1, padding: '8px', borderRadius: '10px', border: '1px solid', cursor: 'pointer', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all 0.2s ease', background: authMode === mode ? 'rgba(255,45,120,0.18)' : 'rgba(255,255,255,0.04)', borderColor: authMode === mode ? '#ff2d7888' : 'rgba(255,255,255,0.08)', color: authMode === mode ? '#ff2d78' : 'rgba(180,190,220,0.5)' }}>
                {mode === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {authMode === 'signup' && (
              <div>
                <label style={{ fontSize: '10px', color: 'rgba(180,190,220,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Signal Name</label>
                <input type="text" value={signalName} onChange={e => setSignalName(e.target.value)} placeholder="how the ecosystem knows you"
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f0f4ff', fontSize: '13px', outline: 'none' }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: '10px', color: 'rgba(180,190,220,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your signal address"
                style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f0f4ff', fontSize: '13px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'rgba(180,190,220,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="minimum 6 characters"
                style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#f0f4ff', fontSize: '13px', outline: 'none' }} />
            </div>
            {error && <div style={{ fontSize: '12px', color: '#ff2d78', padding: '8px 12px', background: 'rgba(255,45,120,0.1)', borderRadius: '8px', border: '1px solid rgba(255,45,120,0.25)' }}>{error}</div>}
            {message && <div style={{ fontSize: '12px', color: '#00d4ff', padding: '8px 12px', background: 'rgba(0,212,255,0.1)', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.25)' }}>{message}</div>}
            <button type="submit" disabled={loading}
              style={{ padding: '12px', background: loading ? 'rgba(255,45,120,0.25)' : 'rgba(255,45,120,0.18)', border: '1px solid #ff2d7866', borderRadius: '12px', color: '#ff2d78', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', letterSpacing: '0.05em' }}>
              {loading ? 'transmitting...' : authMode === 'login' ? 'Enter Pod' : 'Create Signal'}
            </button>
          </form>
          {!supabase && (
            <div style={{ marginTop: '16px', fontSize: '11px', color: 'rgba(180,190,220,0.35)', textAlign: 'center', fontStyle: 'italic' }}>
              ⚡ Supabase not yet configured — add env vars to enable auth
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">SOUL POD</div>
        <h2 className="screen-title">Your Pod</h2>
        <p className="screen-sub">a private chamber for everything you have felt</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '12px', marginBottom: '4px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(180,190,220,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>authenticated signal</div>
          <div style={{ fontSize: '12px', color: '#00d4ff' }}>{user.email}</div>
        </div>
        <button onClick={onSignOut} style={{ fontSize: '11px', color: 'rgba(180,190,220,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
          sign out
        </button>
      </div>
      <div className="pod-orb-container">
        <div className="pod-orb">
          <div className="pod-orb-inner" />
          <div className="pod-orb-ring" />
        </div>
        <div className="pod-orb-label">resonating</div>
      </div>
      <div className="pod-cards">
        {[
          { type: 'Saved Echo', title: 'Late Night Signal', detail: 'A soft thought preserved from the quiet hours.', time: '01:42' },
          { type: 'Memory Fragment', title: 'Static Bloom Memory', detail: 'Pink noise wrapped around an old feeling.', time: 'archived' },
          { type: 'Private Note', title: 'Quiet Frequency', detail: 'A small reminder to move gently today.', time: 'private' },
        ].map((item, i) => (
          <div key={i} className="pod-card glass">
            <div className="pod-card-type">{item.type}</div>
            <div className="pod-card-title">{item.title}</div>
            <p className="pod-card-detail">{item.detail}</p>
            <div className="pod-card-time">{item.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnomaliesScreen() {
  const items = [
    { name: 'Pulse Spike', severity: 'critical', detected: 'now', strength: 97, desc: 'A sudden resonance surge fractured the local signal layer.' },
    { name: 'Unknown Transmission', severity: 'unknown', detected: '3 min ago', strength: 82, desc: 'An unidentified carrier is repeating beneath the observatory floor.' },
    { name: 'Memory Flicker', severity: 'elevated', detected: '11 min ago', strength: 69, desc: 'Recovered memories are blinking in and out of stable phase.' },
    { name: 'Dead Zone Movement', severity: 'unstable', detected: '26 min ago', strength: 58, desc: 'A dormant zone drifted outside its mapped boundary.' },
    { name: 'Echo Loop', severity: 'low', detected: '44 min ago', strength: 44, desc: 'A repeating echo pattern softened into a low-priority cycle.' },
  ]
  const sevColor: Record<string, string> = { critical: 'badge-red', unknown: 'badge-grey', elevated: 'badge-violet', unstable: 'badge-pink', low: 'badge-cyan' }
  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">SIGNAL ANOMALIES</div>
        <h2 className="screen-title">Anomalies</h2>
        <p className="screen-sub">irregularities in the emotional spectrum</p>
      </div>
      <div className="anomaly-list">
        {items.map(a => (
          <div key={a.name} className="anomaly-card glass">
            <div className="anomaly-header">
              <span className="anomaly-name">{a.name}</span>
              <span className={`badge ${sevColor[a.severity]}`}>{a.severity}</span>
            </div>
            <p className="anomaly-desc">{a.desc}</p>
            <div className="anomaly-footer">
              <span className="anomaly-detected">{a.detected}</span>
              <SignalBar value={a.strength} color={a.severity === 'critical' ? 'pink' : a.severity === 'elevated' ? 'violet' : 'cyan'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsScreen() {
  const [vibrate, setVibrate] = useState(true)
  const [anonymous, setAnonymous] = useState(true)
  const [nightMode, setNightMode] = useState(true)
  const [signalVolume, setSignalVolume] = useState(72)
  const [driftSensitivity, setDriftSensitivity] = useState(60)
  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">ECOSPHERE</div>
        <h2 className="screen-title">Settings</h2>
        <p className="screen-sub">tune your presence in the ecosystem</p>
      </div>
      <div className="settings-list">
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Anonymous Mode</div>
            <div className="setting-detail">broadcast without identity</div>
          </div>
          <button className={`toggle ${anonymous ? 'on' : ''}`} onClick={() => setAnonymous(!anonymous)} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Vibrate on Signal</div>
            <div className="setting-detail">haptic pulse on new resonance</div>
          </div>
          <button className={`toggle ${vibrate ? 'on' : ''}`} onClick={() => setVibrate(!vibrate)} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Night Protocol</div>
            <div className="setting-detail">darker atmosphere after midnight</div>
          </div>
          <button className={`toggle ${nightMode ? 'on' : ''}`} onClick={() => setNightMode(!nightMode)} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Signal Volume</div>
            <div className="setting-detail">{signalVolume}%</div>
          </div>
          <input type="range" min={0} max={100} value={signalVolume} onChange={e => setSignalVolume(+e.target.value)} className="range-input" />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Drift Sensitivity</div>
            <div className="setting-detail">{driftSensitivity}% — ambient movement</div>
          </div>
          <input type="range" min={0} max={100} value={driftSensitivity} onChange={e => setDriftSensitivity(+e.target.value)} className="range-input" />
        </div>
      </div>
      <div className="settings-footer">
        <div className="settings-version">ecosphere v2.0 · signal observatory</div>
      </div>
    </div>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ active, onNav }: { active: Screen; onNav: (s: Screen) => void }) {
  return (
    <nav className="bottom-nav glass-nav">
      {navItems.map(item => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNav(item.id)}
          title={item.label}
        >
          <span className="nav-glyph">{item.glyph}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [user, setUser] = useState<{ email?: string; id: string } | null>(null)

  useEffect(() => {
    const supabase = getOptionalSupabaseClient()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser({ id: data.session.user.id, email: data.session.user.email })
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    const supabase = getOptionalSupabaseClient()
    if (supabase) await supabase.auth.signOut()
    setUser(null)
  }


  const screenMap: Record<Screen, React.ReactNode> = {
    home: <HomeScreen />,
    signals: <FeedScreen />,
    drift: <DriftScreen />,
    rooms: <RoomsScreen />,
    capsules: <CapsulesScreen />,
    relics: <RelicsScreen />,
    zones: <DeadZonesScreen />,
    frequencies: <FrequenciesScreen />,
    anomalies: <AnomaliesScreen />,
    pod: <SoulPodScreen user={user} onSignOut={handleSignOut} />,
    settings: <SettingsScreen />,
  }

  return (
    <div className="app-shell">
      {/* Atmosphere layers */}
      <div className="atmosphere" />
      <div className="scanline" />
      <div className="crt-vignette" />
      <Particles />

      {/* Content */}
      <main className="content-well">
        {screenMap[screen]}
      </main>

      <Nav active={screen} onNav={setScreen} />
    </div>
  )
}
