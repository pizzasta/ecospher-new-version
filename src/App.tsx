import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { getOptionalSupabaseClient } from './lib'
import { useEcosystemState } from './hooks/useEcosystemState'
import { useGlobalAudio } from './hooks/useGlobalAudio'
import EcosphereAmbience from './components/EcosphereAmbience'

const FeedScreen = lazy(() => import('./FeedScreen'))
const RoomsScreenComponent = lazy(() => import('./components/RoomsScreen'))
const UnsentRoom = lazy(() => import('./components/UnsentRoom'))

function ScreenLoading() {
  return (
    <div className="screen eco-screen-loading" aria-label="tuning frequency">
      <div className="eco-loading-orb" aria-hidden="true" />
      <p>tuning frequency…</p>
    </div>
  )
}
import './unsent-room.css'
import './rooms.css'
import './living-pages.css'
import './cinematic.css'

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = 'home' | 'signals' | 'drift' | 'rooms' | 'unsent' | 'capsules' | 'relics' | 'pod' | 'zones' | 'frequencies' | 'anomalies' | 'settings'
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
  { id: 'unsent', label: 'Unsent', glyph: '◎' },
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

// ─── Living pages: shared helpers ─────────────────────────────────────────────
function lpRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return Math.abs(s) / 0x7fffffff
  }
}

function lpWave(seed: number, bars = 24): number[] {
  const r = lpRand(seed)
  return Array.from({ length: bars }, (_, i) => {
    const shape = Math.sin(i * 0.4 + seed * 0.07) * 0.3 + 0.55
    return Math.max(0.1, Math.min(1, r() * shape + 0.14))
  })
}

function LpWaveform({ seed, bars = 24, active = false, tint = 'pink' }: { seed: number; bars?: number; active?: boolean; tint?: 'pink' | 'cyan' | 'violet' }) {
  const heights = useMemo(() => lpWave(seed, bars), [seed, bars])
  return (
    <div className={`lp-wave lp-wave-${tint}${active ? ' active' : ''}`} aria-hidden="true">
      {heights.map((h, i) => (
        <i key={i} style={{ '--h': `${Math.round(h * 100)}%`, '--d': `${(i % 9) * 0.12}s` } as CSSProperties} />
      ))}
    </div>
  )
}

function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw != null) return JSON.parse(raw) as T
    } catch { /* unreadable — start fresh */ }
    return initial
  })
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
  }, [key, value])
  return [value, setValue] as const
}

function AmbientLine({ lines, interval = 8500 }: { lines: readonly string[]; interval?: number }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setIdx(i => (i + 1) % lines.length), interval)
    return () => window.clearInterval(t)
  }, [lines, interval])
  const line = lines[idx % lines.length]
  return (
    <div className="lp-ambient-line">
      <span className="lp-ambient-dot" aria-hidden="true" />
      <span className="lp-ambient-text" key={line}>{line}</span>
    </div>
  )
}

function lpTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  return 'earlier'
}

// ─── Screens ──────────────────────────────────────────────────────────────────
const OBS_EVENTS = [
  'network stable · all bands listening',
  'a carrier crossed the northern band',
  'replay activity rising in the feed',
  'drift field reporting light fog',
  'two rooms resonating in sync',
  'archive pressure nominal',
] as const

function HomeScreen() {
  const { ecosystemState } = useEcosystemState()
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 3000); return () => clearInterval(t) }, [])
  const liveActivity = ecosystemState.recentInteractions.slice(0, 5).map(it => it.label)
  const activityLines = liveActivity.length >= 2 ? liveActivity : OBS_EVENTS
  return (
    <div className="screen home-screen" style={{ '--eco-glow': (ecosystemState.resonanceLevel / 100).toFixed(3) } as CSSProperties}>
      <div className="obs-grid" aria-hidden="true" />
      <div className="obs-sweep" aria-hidden="true" />
      <div className="home-kicker">ECOSPHERE · LIVE</div>
      <h1 className="home-title">
        <span className="title-glow-pink">Signal</span>{' '}
        <span className="title-glow-cyan">Observatory</span>
      </h1>
      <p className="home-sub">anonymous voice signals · replayed memories · emotional frequencies</p>
      <AmbientLine lines={activityLines} interval={7000} />

      <div className="stat-row">
        <div className="stat-card glass">
          <div className="stat-value pink">{Math.round(ecosystemState.resonanceLevel) + (tick % 2)}<span className="stat-unit">%</span></div>
          <div className="stat-label">resonance</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-value cyan">1,{248 + tick * 3}</div>
          <div className="stat-label">live threads</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-value violet">+{Math.max(1, Math.round(ecosystemState.driftActivity / 4))}</div>
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
const driftNodeDefs = [
  { id: 'dn1', label: 'Dead Zones', x: 18, y: 34, intensity: 42, delay: 'slow' },
  { id: 'dn2', label: 'Echo Fields', x: 72, y: 24, intensity: 77, delay: 'soft' },
  { id: 'dn3', label: 'Quiet Frequencies', x: 44, y: 58, intensity: 61, delay: 'thin' },
  { id: 'dn4', label: 'Static Bloom', x: 80, y: 68, intensity: 88, delay: 'alive' },
  { id: 'dn5', label: 'Lost Orbit', x: 27, y: 78, intensity: 54, delay: 'far' },
]

type DriftHotspot = { id: string; x: number; y: number; fragment: string }
const driftHotspots: DriftHotspot[] = [
  { id: 'h1', x: 58, y: 18, fragment: 'a looped breath, four seconds long, no owner' },
  { id: 'h2', x: 10, y: 56, fragment: 'coordinates for a room that closed years ago' },
  { id: 'h3', x: 90, y: 46, fragment: 'half a name, sung once, then static' },
]

const DRIFT_EVENTS = [
  'fog density rising in the east band',
  'an unclaimed signal circled twice and left',
  'echo fields breathing slow tonight',
  'something faint wants to be found',
  'cyan haze thinning near lost orbit',
] as const

function DriftScreen() {
  const { discoverDrift, unlockRelic } = useEcosystemState()
  const [energy, setEnergy] = useState<Record<string, number>>({})
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({})
  const [found, setFound] = usePersistentState<string[]>('ecosphere:driftFound', [])
  const [ping, setPing] = useState<string | null>(null)

  useEffect(() => {
    const wander = () => {
      setOffsets(() => {
        const next: Record<string, { dx: number; dy: number }> = {}
        for (const n of driftNodeDefs) {
          next[n.id] = { dx: (Math.random() - 0.5) * 34, dy: (Math.random() - 0.5) * 24 }
        }
        return next
      })
    }
    wander()
    const t = window.setInterval(wander, 6500)
    return () => window.clearInterval(t)
  }, [])

  const exciteNode = (id: string, label: string) => {
    setEnergy(e => ({ ...e, [id]: Math.min((e[id] ?? 0) + 1, 8) }))
    setPing(`${label.toLowerCase()} answered · the node is warming`)
  }

  const findHotspot = (h: DriftHotspot) => {
    if (found.includes(h.id)) return
    const nextFound = [...found, h.id]
    setFound(nextFound)
    discoverDrift(h.id, h.fragment)
    if (nextFound.length >= driftHotspots.length) {
      unlockRelic('recovered-fragment', 'Recovered Fragment')
      setPing('all traces recovered · a relic surfaced in the archive')
    } else {
      setPing('a hidden fragment surfaced from the fog')
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">ATMOSPHERIC DRIFT</div>
        <h2 className="screen-title">Drift</h2>
        <p className="screen-sub">where signals go when no one claims them</p>
      </div>
      <AmbientLine lines={DRIFT_EVENTS} />
      <div className="drift-map glass lp-drift-map">
        <div className="lp-fog lp-fog-a" aria-hidden="true" />
        <div className="lp-fog lp-fog-b" aria-hidden="true" />
        <div className="drift-label-overlay">signal weather · fog / echo · {found.length} / {driftHotspots.length} hidden traces found</div>
        {driftNodeDefs.map(n => {
          const e = energy[n.id] ?? 0
          const off = offsets[n.id] ?? { dx: 0, dy: 0 }
          return (
            <button
              key={n.id}
              type="button"
              className={`drift-node lp-drift-node${e >= 5 ? ' lit' : e >= 2 ? ' warm' : ''}`}
              style={{ left: `${n.x}%`, top: `${n.y}%`, transform: `translate(-50%, -50%) translate(${off.dx}px, ${off.dy}px)`, '--energy': (e / 8).toFixed(3) } as CSSProperties}
              onClick={() => exciteNode(n.id, n.label)}
            >
              <div className="drift-pulse" style={{ opacity: Math.min(1, n.intensity / 100 + e * 0.06) }} />
              <span className="drift-node-label">{n.label}</span>
              <span className="drift-node-delay">{e > 0 ? `+${e} ${e === 1 ? 'ping' : 'pings'}` : n.delay}</span>
            </button>
          )
        })}
        {driftHotspots.map(h => (
          <button
            key={h.id}
            type="button"
            className={`lp-hotspot${found.includes(h.id) ? ' found' : ''}`}
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
            onClick={() => findHotspot(h)}
            aria-label={found.includes(h.id) ? 'recovered fragment' : 'faint trace in the fog'}
          />
        ))}
      </div>
      {ping && <div className="lp-drift-ping" key={ping}>{ping}</div>}
      <div className="drift-discoveries">
        {[
          { type: 'Drift Discovery', title: 'A soft pulse is repeating under the fog', note: 'It feels old, almost personal, but the signal refuses a source.', time: '03:12' },
          { type: 'Signal Anomaly', title: 'Static Bloom opened near the eastern band', note: 'Cyan traces are bending around a warm pink interference field.', time: '03:18' },
          { type: 'Emotional Pulse', title: 'Lonely resonance detected in Quiet Frequencies', note: 'The ecosystem lowered its tempo and held the channel open.', time: '03:24' },
        ].map((d, i) => (
          <div key={d.title} className="drift-discovery glass lp-card lp-enter" style={{ '--idx': i } as CSSProperties}>
            <div className="drift-discovery-type">{d.type}</div>
            <div className="drift-discovery-title">{d.title}</div>
            <p className="drift-discovery-note">{d.note}</p>
            <span className="drift-discovery-time">{d.time}</span>
          </div>
        ))}
        {found.map((id, i) => {
          const h = driftHotspots.find(x => x.id === id)
          if (!h) return null
          return (
            <div key={h.id} className="drift-discovery glass lp-card lp-enter lp-found" style={{ '--idx': i + 3 } as CSSProperties}>
              <div className="drift-discovery-type">Hidden Fragment</div>
              <div className="drift-discovery-title">{h.fragment}</div>
              <p className="drift-discovery-note">found off the marked paths. the map keeps it now.</p>
              <span className="drift-discovery-time">recovered</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}


type CapsulePhase = 'sealed' | 'cracking' | 'leaking' | 'open'

const formingCapsule: Capsule = { id: 'c5', title: 'Unmarked Capsule', duration: '0:21', feeling: 'still forming', timestamp: 'arriving', type: 'echo', status: 'private' }

const capsuleMemories: Record<string, { line: string; seed: number }> = {
  c1: { line: '"kept this one because the room went quiet right after. you can hear it decide to."', seed: 17 },
  c2: { line: '"amber light through a window that is not there anymore. the recording kept the warmth."', seed: 29 },
  c3: { line: '"said once, at low volume, to no one. the capsule sealed itself around it."', seed: 41 },
  c4: { line: '"mostly static now. but the static remembers the shape of what it covered."', seed: 53 },
  c5: { line: '"new. unlabeled. it sounds like the minute before something good."', seed: 67 },
}

const CAPSULE_EVENTS = [
  'preservation field stable',
  'a seal flexed somewhere in storage',
  'one capsule runs warmer than it should',
  'light leak contained in row two',
  'a new layer is settling',
] as const

function CapsulesScreen() {
  const typeGlyph: Record<string, string> = { voice: '◎', memory: '◐', echo: '◑' }
  const { openCapsule: recordCapsuleOpen } = useEcosystemState()
  const [phases, setPhases] = useState<Record<string, CapsulePhase>>({})
  const [preservation, setPreservation] = useState<Record<string, number>>({})
  const [shimmerId, setShimmerId] = useState<string | null>(null)
  const [formed, setFormed] = useState(false)
  const timersRef = useRef<number[]>([])
  const allCapsules = useMemo(() => [...capsules, formingCapsule], [])

  useEffect(() => {
    const timers = timersRef.current
    return () => { timers.forEach(id => window.clearTimeout(id)) }
  }, [])

  // preservation fields decay slowly while you watch
  useEffect(() => {
    setPreservation(Object.fromEntries(allCapsules.map((c, i) => [c.id, 92 - i * 11])))
    const t = window.setInterval(() => {
      setPreservation(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, Math.max(24, v - 0.4)])))
    }, 9000)
    return () => window.clearInterval(t)
  }, [allCapsules])

  // the unmarked capsule finishes forming after time spent on the page
  useEffect(() => {
    const t = window.setTimeout(() => setFormed(true), 22000)
    return () => window.clearTimeout(t)
  }, [])

  // ecosystem shimmer events
  useEffect(() => {
    const t = window.setInterval(() => {
      const pick = allCapsules[Math.floor(Math.random() * allCapsules.length)]
      setShimmerId(pick.id)
      timersRef.current.push(window.setTimeout(() => setShimmerId(s => (s === pick.id ? null : s)), 2600))
    }, 9000)
    return () => window.clearInterval(t)
  }, [allCapsules])

  const openCapsule = (id: string) => {
    const capsule = allCapsules.find(c => c.id === id)
    recordCapsuleOpen(id, capsule?.title)
    setPhases(p => ({ ...p, [id]: 'cracking' }))
    timersRef.current.push(window.setTimeout(() => setPhases(p => (p[id] === 'cracking' ? { ...p, [id]: 'leaking' } : p)), 850))
    timersRef.current.push(window.setTimeout(() => setPhases(p => (p[id] === 'leaking' ? { ...p, [id]: 'open' } : p)), 1950))
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">VOICE CAPSULES</div>
        <h2 className="screen-title">Capsules</h2>
        <p className="screen-sub">preserved moments, carried forward</p>
      </div>
      <AmbientLine lines={CAPSULE_EVENTS} />
      <div className="capsules-list">
        {allCapsules.map((c, i) => {
          const phase: CapsulePhase = phases[c.id] ?? 'sealed'
          const isForming = c.id === formingCapsule.id && !formed
          const memory = capsuleMemories[c.id]
          const badgeLabel = isForming ? 'forming' : c.id === formingCapsule.id ? 'formed' : c.status
          const badgeClass = isForming || c.id === formingCapsule.id ? 'badge-cyan' : c.status === 'saved' ? 'badge-pink' : c.status === 'private' ? 'badge-violet' : 'badge-grey'
          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              className={`capsule-card glass lp-capsule lp-enter phase-${phase}${shimmerId === c.id ? ' shimmer' : ''}${isForming ? ' forming' : ''}`}
              style={{ '--idx': i } as CSSProperties}
              onClick={() => { if (!isForming && phase === 'sealed') openCapsule(c.id) }}
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !isForming && phase === 'sealed') { e.preventDefault(); openCapsule(c.id) } }}
            >
              <div className="capsule-glyph" aria-hidden="true">{typeGlyph[c.type]}</div>
              <div className="capsule-body">
                <div className="capsule-title">{c.title}</div>
                <div className="capsule-meta">
                  {isForming ? 'still forming · stay on this page' : `${c.feeling} · ${c.duration} · ${c.timestamp}`}
                </div>
                {!isForming && (
                  <div className="lp-preservation" aria-hidden="true" title="preservation field">
                    <i style={{ width: `${Math.round(preservation[c.id] ?? 70)}%` }} />
                  </div>
                )}
                {phase === 'sealed' && !isForming && <div className="lp-capsule-hint">tap to break the seal</div>}
                {phase === 'cracking' && <div className="lp-capsule-stage-note">seal cracking…</div>}
                {phase === 'leaking' && <div className="lp-capsule-stage-note leak">light leaking through…</div>}
                {phase === 'open' && memory && (
                  <div className="capsule-memory">
                    <p className="capsule-memory-line">{memory.line}</p>
                    <LpWaveform seed={memory.seed} bars={26} active tint="cyan" />
                    <div className="capsule-memory-stamp">sealed {c.timestamp} · reopened just now</div>
                    <button type="button" className="capsule-reseal" onClick={e => { e.stopPropagation(); setPhases(p => ({ ...p, [c.id]: 'sealed' })) }}>
                      ◌ seal it again
                    </button>
                  </div>
                )}
              </div>
              <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
              <div className="capsule-seal-cracks" aria-hidden="true"><span /><span /><span /></div>
              <div className="capsule-lightleak" aria-hidden="true" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

type RelicActivity = { replays: number; reactions: Record<string, number>; saved: boolean }

const relicFragments: Record<string, string[]> = {
  rl1: ['recovered from the east shelf of the archive', 'it hums when another signal passes close', 'the hum is almost a voice. almost.'],
  rl2: ['a heartbeat, crystallized mid-pulse', 'still ticking at the tempo it was found at', 'warm to the touch after every replay'],
  rl3: ['sealed by the archive. twice.', 'it repeats a name no index recognizes', 'the name gets clearer the longer you stay'],
  rl4: ['pink interference, folded into petals', 'it opens slightly during quiet hours', 'do not listen to the center directly'],
  rl5: ['a broken emotional index', 'violet afterimage persists after playback', 'some entries point at each other forever'],
}

const relicShards: Record<string, string> = {
  rl1: 'hidden shard · a second hum underneath, half a beat behind. it has been answering you this whole time.',
  rl2: 'hidden shard · the crystal skips one beat every 47th replay. the skip is the message.',
  rl3: 'hidden shard · the name is yours, read backwards through static.',
  rl4: 'hidden shard · at the center of the bloom: four seconds of someone breathing, calm.',
  rl5: 'hidden shard · one index entry is intact. it points to tonight.',
}

const relicReactionDefs = [
  { id: 'resonate', glyph: '∿', label: 'resonate' },
  { id: 'hold', glyph: '◌', label: 'hold' },
  { id: 'flare', glyph: '✶', label: 'flare' },
]

const RELIC_EVENTS = [
  'archive pressure steady',
  'a relic shifted half a degree on its shelf',
  'replay traces cooling in sector four',
  'deep shelf hum detected',
  'something in the vault answered back',
] as const

const HIDDEN_SHARD_THRESHOLD = 4

function RelicsScreen() {
  const [selected, setSelected] = useState<Relic | null>(null)
  const { archiveEntry, saveToLibrary, unsaveFromLibrary, unlockRelic: unlockEcosystemRelic } = useEcosystemState()
  const [store, setStore] = usePersistentState<Record<string, RelicActivity>>('ecosphere:relicActivity', {})
  const [charge, setCharge] = useState<Record<string, number>>(() => Object.fromEntries(relics.map(r => [r.id, r.resonance])))
  const [stage, setStage] = useState(0)

  // relics slowly evolve — charge drifts over time
  useEffect(() => {
    const t = window.setInterval(() => {
      setCharge(prev => {
        const next: Record<string, number> = {}
        for (const r of relics) {
          const cur = prev[r.id] ?? r.resonance
          next[r.id] = Math.max(24, Math.min(100, cur + (Math.random() - 0.45) * 6))
        }
        return next
      })
    }, 5000)
    return () => window.clearInterval(t)
  }, [])

  // cinematic layered reveal: glow → waveform → fragments
  useEffect(() => {
    if (!selected) { setStage(0); return }
    setStage(1)
    const t1 = window.setTimeout(() => setStage(2), 800)
    const t2 = window.setTimeout(() => setStage(3), 1700)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2) }
  }, [selected])

  const activityOf = (id: string): RelicActivity => store[id] ?? { replays: 0, reactions: {}, saved: false }
  const updateActivity = (id: string, fn: (a: RelicActivity) => RelicActivity) =>
    setStore(s => ({ ...s, [id]: fn(s[id] ?? { replays: 0, reactions: {}, saved: false }) }))
  const interactionsOf = (a: RelicActivity) => a.replays + Object.values(a.reactions).reduce((sum, n) => sum + n, 0)

  const selectedActivity = selected ? activityOf(selected.id) : null
  const selectedInteractions = selectedActivity ? interactionsOf(selectedActivity) : 0
  const shardUnlocked = selectedInteractions >= HIDDEN_SHARD_THRESHOLD
  const shardRemaining = HIDDEN_SHARD_THRESHOLD - selectedInteractions

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">SIGNAL RELICS</div>
        <h2 className="screen-title">Relics</h2>
        <p className="screen-sub">artifacts recovered from the deep archive</p>
      </div>
      <AmbientLine lines={RELIC_EVENTS} />
      <div className="relics-grid">
        {relics.map((r, i) => {
          const a = activityOf(r.id)
          const c = charge[r.id] ?? r.resonance
          return (
            <button
              key={r.id}
              className={`relic-card glass lp-relic lp-enter${selected?.id === r.id ? ' selected' : ''}${a.replays >= 3 ? ' awakened' : ''}${a.saved ? ' kept' : ''}`}
              style={{ '--glow': (c / 100).toFixed(3), '--replay-boost': (Math.min(a.replays, 6) / 6).toFixed(3), '--idx': i } as CSSProperties}
              onClick={() => setSelected(r)}
            >
              <div className="relic-orb" />
              <div className="relic-name">{r.name}</div>
              <RarityBadge rarity={r.rarity} />
              <div className="relic-resonance">{Math.round(c)}%</div>
              {(a.replays > 0 || a.saved) && (
                <div className="lp-relic-trace">{a.replays > 0 ? `${a.replays}× replayed` : 'kept'}</div>
              )}
            </button>
          )
        })}
      </div>
      {selected && selectedActivity && (
        <div className={`lp-relic-overlay stage-${stage}`} role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <div className="lp-relic-scene glass" onClick={e => e.stopPropagation()}>
            <button className="lp-overlay-close" onClick={() => setSelected(null)}>✕ release</button>
            <div className="lp-relic-halo" style={{ '--glow': ((charge[selected.id] ?? selected.resonance) / 100).toFixed(3) } as CSSProperties}>
              <div className="relic-orb" />
            </div>
            <div className="lp-relic-scene-name">{selected.name}</div>
            <div className="lp-relic-scene-type">{selected.type} · <RarityBadge rarity={selected.rarity} /> · {Math.round(charge[selected.id] ?? selected.resonance)}% charge</div>
            {stage >= 2 && (
              <LpWaveform
                key={selectedActivity.replays}
                seed={selected.id.charCodeAt(2) * 31 + selectedActivity.replays * 7}
                bars={36}
                active
                tint={selectedActivity.replays >= 3 ? 'cyan' : 'pink'}
              />
            )}
            {stage >= 3 && (
              <div className="lp-relic-frags">
                {(relicFragments[selected.id] ?? [selected.description]).map((f, i) => (
                  <p key={f} className="lp-frag" style={{ '--d': `${i * 0.55}s` } as CSSProperties}>{f}</p>
                ))}
                {shardUnlocked ? (
                  <p className="lp-frag lp-hidden-shard" style={{ '--d': `${(relicFragments[selected.id]?.length ?? 1) * 0.55 + 0.3}s` } as CSSProperties}>
                    {relicShards[selected.id] ?? 'hidden shard · it has noticed you noticing it.'}
                  </p>
                ) : (
                  <p className="lp-frag lp-shard-locked" style={{ '--d': `${(relicFragments[selected.id]?.length ?? 1) * 0.55 + 0.3}s` } as CSSProperties}>
                    a hidden shard resists · {shardRemaining} more {shardRemaining === 1 ? 'interaction' : 'interactions'}
                  </p>
                )}
              </div>
            )}
            {stage >= 3 && (
              <div className="lp-relic-actions">
                <button
                  className="lp-action lp-replay"
                  onClick={() => {
                    updateActivity(selected.id, a => {
                      const next = { ...a, replays: a.replays + 1 }
                      if (next.replays === 3) unlockEcosystemRelic(selected.id, selected.name)
                      return next
                    })
                  }}
                >
                  ▶ replay echo{selectedActivity.replays > 0 ? ` · ${selectedActivity.replays}` : ''}
                </button>
                {relicReactionDefs.map(rx => (
                  <button
                    key={rx.id}
                    className="lp-action"
                    onClick={() => updateActivity(selected.id, a => ({ ...a, reactions: { ...a.reactions, [rx.id]: (a.reactions[rx.id] ?? 0) + 1 } }))}
                  >
                    {rx.glyph} {rx.label}{selectedActivity.reactions[rx.id] ? ` · ${selectedActivity.reactions[rx.id]}` : ''}
                  </button>
                ))}
                <button
                  className={`lp-action lp-keep${selectedActivity.saved ? ' on' : ''}`}
                  onClick={() => {
                    if (!selectedActivity.saved) {
                      archiveEntry('relic', selected.name)
                      saveToLibrary('relic', selected.id, selected.name)
                    } else {
                      unsaveFromLibrary('relic', selected.id)
                    }
                    updateActivity(selected.id, a => ({ ...a, saved: !a.saved }))
                  }}
                >
                  {selectedActivity.saved ? '✶ kept in pod' : '✧ keep in pod'}
                </button>
              </div>
            )}
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

const CF_ECO_EVENTS = [
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

function pseudoRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return Math.abs(s) / 0x7fffffff
  }
}

function genWave(seed: number, bars = 48): number[] {
  const r = pseudoRand(seed)
  return Array.from({ length: bars }, (_, i) => {
    const shape = Math.sin(i * 0.35 + seed * 0.05) * 0.3 + 0.5
    return Math.max(0.04, Math.min(1, r() * shape + 0.08))
  })
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


  const TAGS: EmotionalTag[] = ['nocturne','bloom','static','drift','echo','pulse','lost','soft_focus']
  const CONTRIB_TYPES: ContribType[] = ['voice','hum','ambient','whisper','synth','texture','static','pulse']

  // ─── Helpers ─────────────────────────────────────────────────────────────

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
      const msg = CF_ECO_EVENTS[ecoEventRef.current % CF_ECO_EVENTS.length]
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

      {/* Tuning band sweep */}
      <div className="cf-tuning-sweep" aria-hidden="true" />

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
          {carriers.map(c => {
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


const POD_EVENTS = [
  'pod membrane stable',
  'your resonance carried into the drift today',
  'one fragment is warmer than yesterday',
  'the pod hums at your frequency',
  'a saved echo replayed itself, quietly',
] as const

function SoulPodScreen({ user, onSignOut }: { user: { email?: string; id: string } | null; onSignOut: () => void }) {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signalName, setSignalName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const { ecosystemState, toggleLibraryFavorite, unsaveFromLibrary } = useEcosystemState()
  const podAudio = useGlobalAudio()
  const eco = ecosystemState
  const [podPulses, setPodPulses] = usePersistentState<number>('ecosphere:podPulses', 0)
  const [rippling, setRippling] = useState(false)

  const podEnergy = Math.min(1, (eco.resonanceLevel + podPulses * 2) / 120)
  const podStage = podEnergy > 0.7 ? 'radiant' : podEnergy > 0.4 ? 'awake' : 'resting'

  const touchPod = () => {
    setPodPulses(n => n + 1)
    setRippling(true)
    window.setTimeout(() => setRippling(false), 900)
  }

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

  // without a configured backend the pod runs in local mode — never a dead end
  if (!user && supabase) {
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
          <div style={{ fontSize: '10px', color: 'rgba(180,190,220,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>
            {user ? 'authenticated signal' : 'local signal'}
          </div>
          <div style={{ fontSize: '12px', color: '#00d4ff' }}>{user?.email ?? eco.userSignalIdentity ?? 'unclaimed frequency'}</div>
        </div>
        {user ? (
          <button onClick={onSignOut} style={{ fontSize: '11px', color: 'rgba(180,190,220,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
            sign out
          </button>
        ) : (
          <span style={{ fontSize: '10px', color: 'rgba(180,190,220,0.4)', letterSpacing: '0.08em' }}>stored on this device</span>
        )}
      </div>
      <AmbientLine lines={POD_EVENTS} />
      <div className="pod-orb-container">
        <button
          type="button"
          className={`pod-orb lp-pod-orb lp-pod--${podStage}${rippling ? ' rippling' : ''}`}
          style={{ '--pod-energy': podEnergy.toFixed(3) } as CSSProperties}
          onClick={touchPod}
          aria-label="touch your pod"
        >
          <div className="pod-orb-inner" />
          <div className="pod-orb-ring" />
          <span className="lp-pod-ripple" aria-hidden="true" />
        </button>
        <div className="pod-orb-label">
          {podStage === 'radiant' ? 'radiant · it knows you' : podStage === 'awake' ? 'awake · gathering you' : 'resting · touch to wake'}
        </div>
        <div className="lp-pod-signature" aria-label="your waveform signature">
          <LpWaveform
            seed={(eco.userSignalIdentity ?? 'signal').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 7)}
            bars={30}
            active={podStage !== 'resting'}
            tint={podStage === 'radiant' ? 'cyan' : 'pink'}
          />
          <small>{eco.userSignalIdentity ? `signature · ${eco.userSignalIdentity}` : 'signature · unclaimed'}</small>
        </div>
      </div>
      <div className="lp-pod-stats">
        {[
          { label: 'resonance', value: `${Math.round(eco.resonanceLevel)}%` },
          { label: 'drift trails', value: String(eco.driftActivity) },
          { label: 'relics held', value: String(eco.unlockedRelics.length) },
          { label: 'signals kept', value: String(eco.savedSignals.length) },
          { label: 'archive', value: String(eco.archiveHistory.length) },
          { label: 'pod touches', value: String(podPulses) },
        ].map(s => (
          <div key={s.label} className="lp-pod-stat glass">
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      {eco.library.length > 0 && (
        <div className="lp-library">
          <div className="lp-library-head">
            <span>SAVED LIBRARY</span>
            <small>{eco.library.length} {eco.library.length === 1 ? 'item' : 'items'}</small>
          </div>
          {eco.library.map(entry => (
            <div key={`${entry.itemType}-${entry.id}`} className={`lp-library-item glass${entry.favorite ? ' fav' : ''}`}>
              <span className={`lp-library-type lp-library-type--${entry.itemType}`}>{entry.itemType}</span>
              <div className="lp-library-body">
                <strong>{entry.label}</strong>
                <small>saved {lpTimeAgo(entry.savedAt)}</small>
              </div>
              <div className="lp-library-actions">
                <button
                  type="button"
                  onClick={() => podAudio.playSimulated({ id: entry.id, label: entry.label, source: 'pod' }, 5000)}
                  aria-label={`replay ${entry.label}`}
                >
                  ▶
                </button>
                <button
                  type="button"
                  className={entry.favorite ? 'on' : ''}
                  onClick={() => toggleLibraryFavorite(entry.itemType, entry.id)}
                  aria-label={entry.favorite ? 'unfavorite' : 'favorite'}
                >
                  ✶
                </button>
                <button type="button" onClick={() => unsaveFromLibrary(entry.itemType, entry.id)} aria-label="remove from library">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {eco.archiveHistory.length > 0 && (
        <div className="lp-library lp-archive">
          <div className="lp-library-head">
            <span>ARCHIVE HISTORY</span>
            <small>{eco.archiveHistory.length} entries</small>
          </div>
          {eco.archiveHistory.slice(0, 4).map(entry => (
            <div key={entry.id} className="lp-library-item glass lp-archive-item">
              <span className={`lp-library-type lp-library-type--${entry.itemType}`}>{entry.itemType}</span>
              <div className="lp-library-body">
                <strong>{entry.label}</strong>
                <small>archived {lpTimeAgo(entry.archivedAt)}</small>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="pod-cards">
        {[
          { type: 'Saved Echo', title: 'Late Night Signal', detail: 'A soft thought preserved from the quiet hours.', time: '01:42' },
          { type: 'Memory Fragment', title: 'Static Bloom Memory', detail: 'Pink noise wrapped around an old feeling.', time: 'archived' },
          { type: 'Private Note', title: 'Quiet Frequency', detail: 'A small reminder to move gently today.', time: 'private' },
        ].map((item, i) => (
          <div key={i} className="pod-card glass lp-enter" style={{ '--idx': i } as CSSProperties}>
            <div className="pod-card-type">{item.type}</div>
            <div className="pod-card-title">{item.title}</div>
            <p className="pod-card-detail">{item.detail}</p>
            <div className="pod-card-time">{item.time}</div>
          </div>
        ))}
        {eco.listeningHistory.slice(0, 2).map((it, i) => (
          <div key={`lh-${it.playedAt}`} className="pod-card glass lp-enter lp-pod-trace" style={{ '--idx': i + 3 } as CSSProperties}>
            <div className="pod-card-type">Listening History</div>
            <div className="pod-card-title">{it.label}</div>
            <p className="pod-card-detail">a signal you let play all the way through.</p>
            <div className="pod-card-time">{lpTimeAgo(it.playedAt)}</div>
          </div>
        ))}
        {eco.recentInteractions.slice(0, 4).map((it, i) => (
          <div key={it.id} className="pod-card glass lp-enter lp-pod-trace" style={{ '--idx': i + 5 } as CSSProperties}>
            <div className="pod-card-type">Emotional Trace</div>
            <div className="pod-card-title">{it.label}</div>
            <p className="pod-card-detail">the pod kept this moment as you moved through the ecosystem.</p>
            <div className="pod-card-time">{lpTimeAgo(it.createdAt)}</div>
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
  const [veilKey, setVeilKey] = useState(0)
  const [user, setUser] = useState<{ email?: string; id: string } | null>(null)

  const navigate = (next: Screen) => {
    if (next === screen) return
    setScreen(next)
    setVeilKey(k => k + 1)
  }

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
    rooms: <RoomsScreenComponent />,
    unsent: <UnsentRoom />,
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
      <div className="cinematic-depth" aria-hidden="true"><span /><span /></div>
      <div className="scanline" />
      <div className="crt-vignette" />
      <Particles />
      <EcosphereAmbience />

      {/* Content */}
      <main className="content-well">
        <Suspense fallback={<ScreenLoading />}>
          {screenMap[screen]}
        </Suspense>
      </main>

      <Nav active={screen} onNav={navigate} />

      {/* cinematic route veil */}
      {veilKey > 0 && (
        <div className="eco-route-veil" key={veilKey} aria-hidden="true">
          <span className="eco-route-veil-wave" />
        </div>
      )}
    </div>
  )
}
