import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { deleteAccountData, getOptionalSupabaseClient, isSupabaseConfigured, syncProfile, updateProfileFlags } from './lib'
import { localDateString, useEcosystemState } from './hooks/useEcosystemState'
import { deleteLocalRecording, deleteReactionAudio, listLocalRecordings, listReactionAudio, saveReactionAudio, saveRecordingLocally } from './lib/localAudioStore'
import { downloadBlob, exportFilename, renderStoryImage } from './lib/storyExport'
import { playSample, playSampleBuffer, stopPreviewBuffer } from './lib/sampleAudio'
import { lastExaminedBy, listenerCount, livedInLines } from './lib/livedIn'
import { subscribeToEcosphereActivity } from './lib/backendBridge'
import type { StoredReaction } from './lib/localAudioStore'
import { useGlobalAudio } from './hooks/useGlobalAudio'
import EcosphereAmbience from './components/EcosphereAmbience'
import ActiveCarriers from './components/ActiveCarriers'
import AudioRecorder from './components/AudioRecorder'
import AudioPlayer from './components/AudioPlayer'
import FrequencyRecap from './components/FrequencyRecap'
import DeepListen from './components/DeepListen'
import ProfileHub from './components/ProfileHub'
import NotificationBell from './components/NotificationBell'
import ListenerTraces from './components/ListenerTraces'
import { useRecordingSession } from './hooks/useRecordingSession'
import { readLastVoiceAt, silenceLine, silentDays } from './lib/weightOfSilence'
import { enablePushNotifications } from './lib/pushNotifications'
import { SCREEN_PATHS, screenForPath } from './lib/routes'

const FeedScreen = lazy(() => import('./FeedScreen'))
const RoomsScreenComponent = lazy(() => import('./components/RoomsScreen'))
const UnsentRoom = lazy(() => import('./components/UnsentRoom'))

function ScreenLoading() {
  return (
    <div className="screen eco-screen-loading" aria-label="tuning frequency" aria-busy="true">
      <div className="eco-loading-orb" aria-hidden="true" />
      <p>tuning frequency…</p>
      <div className="eco-loading-skeleton" aria-hidden="true">
        <div className="eco-skeleton-card glass"><span /><span /></div>
        <div className="eco-skeleton-card glass"><span /><span /></div>
        <div className="eco-skeleton-card glass"><span /><span /></div>
      </div>
    </div>
  )
}

const SCREEN_TITLES: Record<Screen, string> = {
  home: 'Signal Observatory',
  signals: 'Signal Feed',
  drift: 'Drift Field',
  rooms: 'Rooms',
  unsent: 'Unsent Room',
  capsules: 'Capsules',
  relics: 'Relics',
  pod: 'Soul Pod',
  zones: 'Dead Zones',
  frequencies: 'Frequency Sea',
  anomalies: 'Anomalies',
  settings: 'Settings',
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
  { id: 'c6', title: 'Voicemail You Never Sent', duration: '1:14', feeling: 'held breath', timestamp: 'last week', type: 'memory', status: 'private' },
]

const deadZones: DeadZone[] = [
  { id: 'z1', name: 'Nobody Answered', corruption: 71, status: 'dormant', description: 'i waited up longer than i should have.', lastSignal: 'last active 8 days ago · 2 hidden fragments' },
  { id: 'z2', name: 'Left on Read', corruption: 82, status: 'corrupted', description: "you saw it. you just didn't answer.", lastSignal: 'playback cuts out midway · 4 users attempting recovery' },
  { id: 'z3', name: 'Voices Still Here', corruption: 54, status: 'recoverable', description: 'this room went quiet but the audio never stopped.', lastSignal: 'faint overlapping whispers detected' },
  { id: 'z4', name: 'Unfinished Goodbye', corruption: 93, status: 'corrupted', description: "i didn't mean to leave like th—", lastSignal: 'signal instability rising' },
  { id: 'z5', name: 'Typing Then Nothing', corruption: 64, status: 'dormant', description: 'the three dots showed up for a whole minute. then nothing.', lastSignal: 'last active 4:17am · draft never sent' },
  { id: 'z6', name: 'Wrong Person', corruption: 47, status: 'recoverable', description: 'sent it to the wrong chat. it was meant for you anyway.', lastSignal: 'deleted 12 seconds after sending' },
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
// ─── LiveTail: pages never end in empty space ────────────────────────────────
const TAIL_ROOMS = ["Can't Sleep", 'People Venting', 'Soft Talking', 'Oversharing Hour', 'Songwriters Awake', 'Deep Talks']
const TAIL_STATUS = [
  (n: number) => `${n + 31} users listening nearby`,
  (n: number) => `${(n % 4) + 2} active voice chains`,
  () => 'new room opened just now',
  (n: number) => `signal fading in 00:${String(48 - (n % 40)).padStart(2, '0')}`,
  () => 'echo chain growing',
  () => 'someone replayed this page\'s last signal',
  () => 'ambient noise increasing',
]

function LiveTail({ page, onNavigate }: { page: string; onNavigate?: (s: Screen) => void }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setTick(n => n + 1), 4000)
    return () => window.clearInterval(t)
  }, [])
  const seed = page.length * 17
  const status = TAIL_STATUS[(tick + seed) % TAIL_STATUS.length]((tick * 3 + seed) % 50)
  const rooms = [0, 1, 2].map(i => {
    const idx = (seed + i * 2 + Math.floor(tick / 5)) % TAIL_ROOMS.length
    return { name: TAIL_ROOMS[idx], n: listenerCount(`${page}-${idx}`, tick) + 6 }
  })
  const trace = livedInLines(`tail-${page}`, 1)[0]

  return (
    <div className="live-tail" aria-label="Live activity nearby">
      <div className="live-tail-bar">
        <i aria-hidden="true" />
        <span key={status}>{status}</span>
      </div>
      <div className="live-tail-rooms">
        {rooms.map(r => (
          <button key={r.name} type="button" className="live-tail-room glass" onClick={() => onNavigate?.('rooms')}>
            <span className="live-tail-room-pulse" aria-hidden="true"><b /><b /><b /></span>
            <strong>{r.name}</strong>
            <small>{r.n} listening · live</small>
          </button>
        ))}
      </div>
      <div className="live-tail-trace">{trace}</div>
      <div className="live-tail-frags" aria-hidden="true"><span /><span /><span /><span /></div>
    </div>
  )
}

const OBS_EVENTS = [
  'someone replayed this twice',
  '3 listeners just came online',
  'nobody answered the 2:14 signal',
  'heard again tonight, third time',
  'someone stayed in a room for 2 hours',
  'an echo response just came in',
] as const

// ─── Live Signal Windows: respond before they drift ──────────────────────────

type LiveWindowStatus = 'live' | 'answered' | 'kept' | 'expired'

type LiveWindow = {
  id: string
  content: string
  handle: string
  totalMs: number
  expiresAt: number
  echoes: number
  seed: number
  status: LiveWindowStatus
}

const LIVE_WINDOW_POOL: Array<{ content: string; handle: string }> = [
  { content: "can't sleep tonight. is anyone out there", handle: 'anonymous' },
  { content: 'replaying the same memory again', handle: 'driftmemory' },
  { content: 'first night in the new apartment. too quiet', handle: 'anonymous' },
  { content: 'i keep almost calling them', handle: 'voicemailafter2' },
  { content: 'a song from 2014 is stuck in my head', handle: 'lostheadphones' },
  { content: 'walked past my old house today', handle: 'anonymous' },
  { content: 'nobody at work knows about any of this', handle: 'breakroomghost' },
  { content: "it's 3am and the fridge is the only sound", handle: 'fridgehumat3am' },
  { content: 'something good happened. saying it out loud', handle: 'anonymous' },
  { content: 'i miss who i was last summer', handle: 'peachstreetlight' },
  { content: 'still wearing their hoodie', handle: 'hoodiebythelake' },
  { content: 'told the dog everything. he gets it', handle: 'anonymous' },
]

function spawnLiveWindow(index: number): LiveWindow {
  const item = LIVE_WINDOW_POOL[index % LIVE_WINDOW_POOL.length]
  const totalMs = (30 + Math.floor(Math.random() * 4) * 15) * 1000
  return {
    id: `lsw-${index}-${Date.now()}`,
    content: item.content,
    handle: item.handle,
    totalMs,
    expiresAt: Date.now() + totalMs,
    echoes: 0,
    seed: index * 37 + 11,
    status: 'live',
  }
}

function LiveSignalWindows() {
  const { archiveEntry, reactToSignal, saveSignal, setRareEvent, unlockRelic } = useEcosystemState()
  const lswAudio = useGlobalAudio()
  const [windows, setWindows] = useState<LiveWindow[]>(() => [spawnLiveWindow(0), spawnLiveWindow(1)])
  const [now, setNow] = useState(() => Date.now())
  const [recordingFor, setRecordingFor] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const spawnIndexRef = useRef(2)
  const expiredCountRef = useRef(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    const timers = timersRef.current
    return () => {
      window.clearInterval(t)
      timers.forEach(id => window.clearTimeout(id))
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    }
  }, [])

  const ping = (text: string) => {
    setNotice(text)
    timersRef.current.push(window.setTimeout(() => setNotice(null), 4500))
  }

  const replaceLater = (id: string, delayMs: number) => {
    timersRef.current.push(window.setTimeout(() => {
      setWindows(prev => {
        const next = prev.filter(w => w.id !== id)
        if (next.length < 2) next.push(spawnLiveWindow(spawnIndexRef.current++))
        return next
      })
    }, delayMs))
  }

  // expiry: unanswered signals drift into the archive; some crystallize
  useEffect(() => {
    windows.forEach(w => {
      if (w.status !== 'live' || now < w.expiresAt) return
      setWindows(prev => prev.map(p => (p.id === w.id ? { ...p, status: 'expired' as const } : p)))
      archiveEntry('signal', `never answered: "${w.content}"`)
      expiredCountRef.current += 1
      if (expiredCountRef.current % 3 === 0) {
        unlockRelic(`unanswered-${w.id}`, 'Unanswered Echo')
        setRareEvent('an unanswered signal crystallized into a relic')
      } else {
        ping('nobody answered. it drifted into the archive.')
      }
      replaceLater(w.id, 2000)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now])

  const listenTo = (w: LiveWindow) => {
    void playSample(lswAudio, { id: w.id, label: w.handle === 'anonymous' ? 'a live signal' : w.handle, source: 'home' }, 'voice', w.seed, 7000)
  }

  const echoWindow = (w: LiveWindow) => {
    setWindows(prev => prev.map(p => (p.id === w.id ? { ...p, echoes: p.echoes + 1, expiresAt: p.expiresAt + 20000, totalMs: p.totalMs + 20000 } : p)))
    reactToSignal(w.id, 'echoed a live signal · +20s')
    ping('echo sent · 20 seconds added')
  }

  const keepWindow = (w: LiveWindow) => {
    setWindows(prev => prev.map(p => (p.id === w.id ? { ...p, status: 'kept' as const } : p)))
    saveSignal(w.id, `live signal · "${w.content.slice(0, 30)}"`)
    ping('saved. this one stays.')
    replaceLater(w.id, 5000)
  }

  // 3-second instant voice reply: tap, speak, auto-sends
  const replyToWindow = async (w: LiveWindow) => {
    if (recordingFor) return
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      echoWindow(w)
      ping('no microphone — sent an echo instead')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      const chunks: Blob[] = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(tr => tr.stop())
        setRecordingFor(null)
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size > 0) {
          void saveReactionAudio({
            id: `obs-reply-${Date.now()}`,
            target: w.id,
            durationMs: 3000,
            createdAt: Date.now(),
            anonymous: true,
            filter: 'none',
            blob,
          })
        }
        setWindows(prev => prev.map(p => (p.id === w.id ? { ...p, status: 'answered' as const } : p)))
        reactToSignal(w.id, 'answered a live signal with their voice')
        ping('reply sent. the signal heard you.')
        replaceLater(w.id, 5000)
      }
      recorder.start()
      setRecordingFor(w.id)
      timersRef.current.push(window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, 3000))
    } catch {
      echoWindow(w)
      ping('microphone unavailable — sent an echo instead')
    }
  }

  return (
    <div className="lsw-section">
      <div className="section-head lsw-head">
        <span className="section-kicker">live right now</span>
        <span className="lsw-sub">respond before they drift away</span>
      </div>
      {notice && <div className="lsw-notice" key={notice}>{notice}</div>}
      <div className="lsw-stack">
        {windows.map(w => {
          const remaining = Math.max(0, w.expiresAt - now)
          const life = w.status === 'live' ? remaining / w.totalMs : 1
          const seconds = Math.ceil(remaining / 1000)
          const phase = w.status !== 'live' ? w.status : life > 0.55 ? 'stable' : life > 0.25 ? 'fading' : 'unstable'
          const isRecording = recordingFor === w.id
          return (
            <div key={w.id} className={`lsw-card glass lsw--${phase}`} style={{ '--life': life.toFixed(3) } as CSSProperties}>
              <div className="lsw-top">
                <span className="lsw-handle">{w.handle === 'anonymous' ? '⬡ anonymous' : `◈ ${w.handle}`}</span>
                {w.status === 'live' && (
                  <span className={`lsw-timer${seconds <= 15 ? ' urgent' : ''}`}>
                    {phase === 'unstable' ? 'destabilizing · ' : ''}{seconds}s
                  </span>
                )}
                {w.status === 'answered' && <span className="lsw-state">answered ✓</span>}
                {w.status === 'kept' && <span className="lsw-state">saved ✶</span>}
                {w.status === 'expired' && <span className="lsw-state lsw-state--gone">drifted away</span>}
              </div>
              <p className="lsw-content">"{w.content}"</p>
              <LpWaveform seed={w.seed} bars={26} active={w.status === 'live'} tint={phase === 'unstable' ? 'violet' : 'pink'} />
              {w.status === 'live' && (
                <div className="lsw-lifebar" aria-hidden="true"><i style={{ width: `${Math.round(life * 100)}%` }} /></div>
              )}
              {w.status === 'live' && (
                <div className="lsw-actions">
                  <button type="button" onClick={() => listenTo(w)}>▶ listen</button>
                  <button
                    type="button"
                    className={`lsw-reply${isRecording ? ' recording' : ''}`}
                    onClick={() => { void replyToWindow(w) }}
                  >
                    {isRecording ? '● 3s…' : '◉ reply'}
                  </button>
                  <button type="button" onClick={() => echoWindow(w)}>∿ echo{w.echoes > 0 ? ` ${w.echoes}` : ''}</button>
                  <button type="button" onClick={() => keepWindow(w)}>✧ save</button>
                </div>
              )}
              {w.status === 'expired' && <p className="lsw-epitaph">this signal was never answered</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}

function dayOfYear(): number {
  const now = new Date()
  return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
}

function HomeScreen({ onNavigate }: { onNavigate?: (next: Screen) => void }) {
  const { ecosystemState, tuneInDaily } = useEcosystemState()
  const homeAudio = useGlobalAudio()
  const nowPlaying = ecosystemState.activeAudio
  const dailySignal = signals[dayOfYear() % signals.length]
  const tunedToday = ecosystemState.streak.lastDate === localDateString()
  const streak = ecosystemState.streak.count

  const tuneIn = () => {
    if (tunedToday) return
    void playSample(homeAudio, { id: `daily-${dailySignal.id}`, label: `daily signal · ${dailySignal.handle}`, source: 'home' }, 'voice', dayOfYear() * 31, 6000)
    tuneInDaily(dailySignal.handle)
  }
  const [tick, setTick] = useState(0)
  const [deepListen, setDeepListen] = useState(false)
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 3000); return () => clearInterval(t) }, [])
  const liveActivity = ecosystemState.recentInteractions.slice(0, 5).map(it => it.label)
  const activityLines = useMemo(
    () => (liveActivity.length >= 2 ? [...liveActivity, ...livedInLines('home', 2)] : [...OBS_EVENTS, ...livedInLines('home', 3)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveActivity.length],
  )
  return (
    <div className="screen home-screen" style={{ '--eco-glow': (ecosystemState.resonanceLevel / 100).toFixed(3) } as CSSProperties}>
      <div className="obs-grid" aria-hidden="true" />
      <div className="obs-sweep" aria-hidden="true" />
      <div className="home-kicker">ECOSPHERE · LIVE</div>
      <h1 className="home-title">
        <span className="title-glow-pink">Signal</span>{' '}
        <span className="title-glow-cyan">Observatory</span>
      </h1>
      <p className="home-sub">anonymous voices · live replays · the late-night network</p>
      <AmbientLine lines={activityLines} interval={7000} />

      <div className="stat-row">
        <div className="stat-card glass">
          <div className="stat-value pink">{useCountUp(Math.round(ecosystemState.resonanceLevel)) + (tick % 2)}<span className="stat-unit">%</span></div>
          <div className="stat-label">resonance</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-value cyan">{(1000 + useCountUp(248) + tick * 3).toLocaleString()}</div>
          <div className="stat-label">live threads</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-value violet">+{Math.max(1, Math.round(ecosystemState.driftActivity / 4))}</div>
          <div className="stat-label">drift cycles</div>
        </div>
      </div>

      <div className={`obs-daily glass${tunedToday ? ' obs-daily--tuned' : ''}`}>
        <div className="obs-daily-head">
          <span className="obs-daily-kicker">DAILY SIGNAL</span>
          {streak > 0 && (
            <span className="obs-streak" title={`${streak} nights tuned in`}>
              ◉ {streak} {streak === 1 ? 'night' : 'nights'}
            </span>
          )}
        </div>
        <p className="obs-daily-content">"{dailySignal.content}"</p>
        <div className="obs-daily-foot">
          <span className="obs-daily-handle">{dailySignal.anonymous ? '⬡ anonymous' : `◈ ${dailySignal.handle}`}</span>
          <button type="button" className="obs-daily-tune" disabled={tunedToday} onClick={tuneIn}>
            {tunedToday ? `✶ tuned in · night ${streak}` : '◉ tune in'}
          </button>
        </div>
        {streak >= 2 && !tunedToday && (
          <div className="obs-daily-warning">tune in today to keep your {streak}-night streak alive</div>
        )}
      </div>

      <FrequencyRecap />

      <WeightOfSilenceChip />

      <LiveSignalWindows />

      {nowPlaying && (
        <div className="obs-now-replaying glass">
          <span className="obs-now-bars" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="obs-now-label">currently replaying · {nowPlaying.label}</span>
          <span className="obs-now-source">{nowPlaying.source}</span>
        </div>
      )}

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

      <HomeVoiceTransmit />

      <ActiveCarriers onViewMap={() => onNavigate?.('frequencies')} />

      <button type="button" className="deep-listen-entry" onClick={() => setDeepListen(true)}>
        ◉ deep listen — no visuals, only audio
      </button>
      {deepListen && <DeepListen onExit={() => setDeepListen(false)} />}
    </div>
  )
}

/** Weight of Silence: a neutral mirror — visible after 2 quiet days, resets with a soft chime. */
function WeightOfSilenceChip() {
  const [days, setDays] = useState(() => silentDays(readLastVoiceAt()))

  useEffect(() => {
    const onVoice = () => {
      setDays(prev => {
        if (prev != null && prev >= 2) {
          // the silence just broke — acknowledge it gently
          void playSampleBuffer('tone', 432, 1400, 0.08)
        }
        return 0
      })
    }
    window.addEventListener('ecosphere:voice', onVoice)
    return () => window.removeEventListener('ecosphere:voice', onVoice)
  }, [])

  if (days == null || days < 2) return null

  return (
    <div className="silence-chip" role="note">
      <span aria-hidden="true">◌</span>
      {silenceLine(days)}
    </div>
  )
}

function HomeVoiceTransmit() {
  const [open, setOpen] = useState(false)
  const { notify } = useRecordingSession()
  return (
    <div className="obs-transmit glass">
      <div className="section-head">
        <span className="section-kicker">transmit a voice signal</span>
        <button type="button" className="obs-transmit-toggle" onClick={() => setOpen(o => !o)}>
          {open ? 'close channel' : '◉ open channel'}
        </button>
      </div>
      {open && (
        <AudioRecorder
          kind="signal"
          prompt="say it into the static. no name attached. it joins your pod library and drifts from there."
          onComplete={() => {
            notify('voice signal released · find it in your pod library')
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

const driftNodeDefs = [
  { id: 'dn1', label: "Can't Sleep", x: 18, y: 34, intensity: 62, delay: '14 talking' },
  { id: 'dn2', label: 'People Venting', x: 72, y: 24, intensity: 77, delay: 'busy' },
  { id: 'dn3', label: 'Quiet Conversations', x: 44, y: 58, intensity: 41, delay: 'calm' },
  { id: 'dn4', label: 'Music Playing Nearby', x: 80, y: 68, intensity: 88, delay: 'loud' },
  { id: 'dn5', label: 'Deep Talks', x: 27, y: 78, intensity: 54, delay: 'close' },
  { id: 'dn6', label: 'Lonely Tonight', x: 58, y: 40, intensity: 58, delay: 'open' },
]

type DriftHotspot = { id: string; x: number; y: number; fragment: string }
const driftHotspots: DriftHotspot[] = [
  { id: 'h1', x: 58, y: 18, fragment: 'a looped breath, four seconds long, no owner' },
  { id: 'h2', x: 10, y: 56, fragment: 'coordinates for a room that closed years ago' },
  { id: 'h3', x: 90, y: 46, fragment: 'half a name, sung once, then static' },
]

const DRIFT_EVENTS = [
  'a lot of people just joined one room',
  'someone started playing music nearby',
  'quiet relationship conversation detected',
  'new late-night room opened',
  'small group talking about anxiety',
  'people are staying longer than usual tonight',
] as const

function DriftScreen() {
  const { discoverDrift, unlockRelic } = useEcosystemState()
  const driftAudio = useGlobalAudio()
  const [driftReactions, setDriftReactions] = useState<StoredReaction[]>([])
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

  const exciteNode = (id: string, label: string, seed: number) => {
    setEnergy(e => ({ ...e, [id]: Math.min((e[id] ?? 0) + 1, 8) }))
    void playSample(driftAudio, { id: `overhear-${id}`, label: `overhearing · ${label.toLowerCase()}`, source: 'drift' }, 'voice', seed * 67 + 5, 5000)
    setPing(`overhearing ${label.toLowerCase()} — open rooms to join`)
  }

  // voice reactions released into the drift surface here as floating fragments
  useEffect(() => {
    let cancelled = false
    void listReactionAudio('drift').then(stored => {
      if (!cancelled) setDriftReactions(stored.slice(0, 4))
    })
    return () => { cancelled = true }
  }, [])

  const playDriftReaction = (reaction: StoredReaction) => {
    void driftAudio.playBlob(reaction.blob, {
      id: `drift-reaction-${reaction.id}`,
      label: 'a voice somebody released here',
      source: 'drift',
    })
    setPing('a stray voice fragment, still warm')
  }

  const releaseDriftReaction = (reaction: StoredReaction) => {
    setDriftReactions(prev => prev.filter(r => r.id !== reaction.id))
    void deleteReactionAudio(reaction.id)
    setPing('the fragment dissolved back into the fog')
  }

  // ── field scans: a pull of the lever every 30 minutes ──────────────────────
  const SCAN_COOLDOWN = 30 * 60 * 1000
  const [scanMeta, setScanMeta] = usePersistentState<{ lastScanAt: number; shards: number }>('ecosphere:driftScan', { lastScanAt: 0, shards: 0 })
  const [scanning, setScanning] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const scanRemaining = Math.max(0, scanMeta.lastScanAt + SCAN_COOLDOWN - nowTick)

  const scanField = () => {
    if (scanRemaining > 0 || scanning) return
    setScanning(true)
    window.setTimeout(() => setScanning(false), 2400)

    const roll = Math.random()
    let shards = scanMeta.shards
    window.setTimeout(() => {
      if (roll < 0.45) {
        const nothing = [
          'the fog gave nothing back this time',
          'a faint trace, gone before it resolved',
          'only your own echo out there. for now.',
          'the field is quiet. it knows you checked.',
        ]
        setPing(nothing[Math.floor(Math.random() * nothing.length)])
      } else if (roll < 0.78) {
        const fragments = [
          'a scan caught: someone counting backwards from ten, softly',
          'a scan caught: rain on a car roof, twenty years ago',
          'a scan caught: a dial tone that sounds almost like a chord',
          'a scan caught: two seconds of a song nobody finished',
          'a scan caught: a door closing gently, on purpose',
          'a scan caught: breathing synced to a washing machine',
        ]
        const line = fragments[Math.floor(Math.random() * fragments.length)]
        discoverDrift(`scan-${Date.now()}`, line)
        setPing(line)
      } else if (roll < 0.94) {
        shards += 1
        if (shards >= 3) {
          unlockRelic('reassembled-shard', 'Reassembled Shard')
          setPing('third shard recovered · the pieces fused into a relic')
        } else {
          setPing(`a relic shard surfaced from the fog · ${shards}/3 collected`)
        }
      } else if (driftReactions.length > 0) {
        const r = driftReactions[Math.floor(Math.random() * driftReactions.length)]
        playDriftReaction(r)
        setPing('the scan locked onto a voice somebody released here')
      } else {
        discoverDrift(`scan-${Date.now()}`, 'a scan caught: a frequency that only exists tonight')
        setPing('a scan caught: a frequency that only exists tonight')
      }
      setScanMeta({ lastScanAt: Date.now(), shards })
    }, 2000)
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
        <div className="screen-kicker">AUDIO RADAR</div>
        <h2 className="screen-title">Frequency Finder</h2>
        <p className="screen-sub">overhear live rooms from a distance. drift toward whatever pulls you.</p>
      </div>
      <AmbientLine lines={useMemo(() => [...DRIFT_EVENTS, ...livedInLines('drift', 3)], [])} />
      <div className={`drift-map glass lp-drift-map${scanning ? ' lp-drift-map--scanning' : ''}`}>
        <div className="lp-fog lp-fog-a" aria-hidden="true" />
        <div className="lp-fog lp-fog-b" aria-hidden="true" />
        <div className="drift-label-overlay">tap a room to overhear it · {found.length} / {driftHotspots.length} hidden traces found</div>
        {driftNodeDefs.map(n => {
          const e = energy[n.id] ?? 0
          const off = offsets[n.id] ?? { dx: 0, dy: 0 }
          return (
            <button
              key={n.id}
              type="button"
              className={`drift-node lp-drift-node${e >= 5 ? ' lit' : e >= 2 ? ' warm' : ''}`}
              style={{ left: `${n.x}%`, top: `${n.y}%`, transform: `translate(-50%, -50%) translate(${off.dx}px, ${off.dy}px)`, '--energy': (e / 8).toFixed(3) } as CSSProperties}
              onClick={() => exciteNode(n.id, n.label, n.intensity)}
            >
              <div className="drift-pulse" style={{ opacity: Math.min(1, n.intensity / 100 + e * 0.06) }} />
              <span className="drift-node-label">{n.label}</span>
              <span className="drift-node-delay">{e > 0 ? `+${e} ${e === 1 ? 'ping' : 'pings'}` : n.delay}</span>
            </button>
          )
        })}
        {driftReactions.map((r, i) => (
          <div
            key={r.id}
            className="drift-voice-fragment"
            style={{ left: `${22 + i * 19}%`, top: `${14 + (i % 2) * 62}%`, '--frag-delay': `${i * 1.3}s` } as CSSProperties}
          >
            <button
              type="button"
              className="drift-voice-play"
              onClick={() => playDriftReaction(r)}
              aria-label="play a stray voice fragment"
            >
              <span><i /><i /><i /><i /></span>
            </button>
            <button
              type="button"
              className="drift-voice-release"
              onClick={() => releaseDriftReaction(r)}
              aria-label="release this fragment"
            >
              ✕
            </button>
          </div>
        ))}
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
      <button
        type="button"
        className={`drift-scan-btn${scanning ? ' scanning' : ''}`}
        disabled={scanRemaining > 0 || scanning}
        onClick={scanField}
      >
        {scanning
          ? '⌖ scanning the field…'
          : scanRemaining > 0
            ? `⌖ field recharging · ${Math.floor(scanRemaining / 60000)}:${String(Math.floor((scanRemaining % 60000) / 1000)).padStart(2, '0')}`
            : `⌖ scan the field${scanMeta.shards > 0 && scanMeta.shards < 3 ? ` · ${scanMeta.shards}/3 shards` : ''}`}
      </button>
      {ping && <div className="lp-drift-ping" key={ping}>{ping}</div>}
      <div className="drift-discoveries">
        {[
          { type: 'Room Activity', title: "a small group has been talking in Can't Sleep for 2 hours", note: 'slow conversation, long pauses. easy to join.', time: '3:12am' },
          { type: 'Music Detected', title: 'someone is playing unreleased songs nearby', note: 'about 12 people listening quietly. nobody wants it to end.', time: '3:18am' },
          { type: 'Open Room', title: 'a late-night room just opened with 3 people', note: 'they said anyone can drop in.', time: '3:24am' },
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
      <LiveTail page="drift" />
    </div>
  )
}


type CapsulePhase = 'sealed' | 'cracking' | 'leaking' | 'open'

const formingCapsule: Capsule = { id: 'c5', title: 'Unmarked Capsule', duration: '0:21', feeling: 'still forming', timestamp: 'arriving', type: 'echo', status: 'private' }

const formingMemoryPool = [
  '"new. unlabeled. it sounds like the minute before something good."',
  '"it formed overnight. there is a name inside it that is almost yours."',
  '"whatever sealed this one in did it gently."',
  '"it hums at the same pitch as your first signal. coincidence, probably."',
]

const capsuleMemories: Record<string, { line: string; seed: number }> = {
  c1: { line: '"kept this one because the room went quiet right after. you can hear it decide to."', seed: 17 },
  c2: { line: '"amber light through a window that is not there anymore. the recording kept the warmth."', seed: 29 },
  c3: { line: '"said once, at low volume, to no one. the capsule sealed itself around it."', seed: 41 },
  c4: { line: '"mostly static now. but the static remembers the shape of what it covered."', seed: 53 },
  c5: { line: '"new. unlabeled. it sounds like the minute before something good."', seed: 67 },
  c6: { line: '"recorded, re-recorded, never sent. the pauses are the real message."', seed: 79 },
}

// old capsules surfaced once a day — the archive showing you something it kept
const GHOST_CAPSULES = [
  { title: 'Hum From An Empty Kitchen', age: 'sealed 11 months ago', line: 'the refrigerator carried the whole conversation after everyone left.' },
  { title: 'Last Bus Confession', age: 'sealed 7 months ago', line: 'said out loud at the back of the 2:40, to a window that kept it.' },
  { title: 'Birthday Nobody Remembered', age: 'sealed 1 year ago', line: 'the candles went out on their own. the recording kept the smoke.' },
  { title: 'Dial Tone Lullaby', age: 'sealed 9 months ago', line: 'stayed on the line long after the call ended. the tone became a song.' },
  { title: 'Rain On The Carport', age: 'sealed 5 months ago', line: 'forty seconds of weather that sounded exactly like being okay.' },
]

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
  // the unmarked capsule forms in real time — leave, come back, it's closer
  const [forming, setForming] = usePersistentState<{ readyAt: number; cycle: number }>('ecosphere:capsuleForming', { readyAt: 0, cycle: 0 })
  const [openedCycle, setOpenedCycle] = useState<number | null>(null)
  const [formTick, setFormTick] = useState(() => Date.now())
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

  // first visit arms the first forming cycle (12 min); countdown ticks live
  useEffect(() => {
    if (forming.readyAt === 0) {
      setForming({ readyAt: Date.now() + 12 * 60 * 1000, cycle: 0 })
    }
    const t = window.setInterval(() => setFormTick(Date.now()), 15000)
    return () => window.clearInterval(t)
  }, [forming.readyAt, setForming])

  const formed = forming.readyAt > 0 && formTick >= forming.readyAt
  const formingRemaining = Math.max(0, forming.readyAt - formTick)
  const ghostCapsule = GHOST_CAPSULES[dayOfYear() % GHOST_CAPSULES.length]
  const listRef = useRef<HTMLDivElement | null>(null)

  // time layers: cards fade with scroll position, like strata in the archive
  useEffect(() => {
    const list = listRef.current
    if (!list || !('IntersectionObserver' in window)) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const visibility = 0.45 + entry.intersectionRatio * 0.55
        ;(entry.target as HTMLElement).style.setProperty('--scroll-vis', visibility.toFixed(2))
      })
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] })
    Array.from(list.children).forEach(child => observer.observe(child))
    return () => observer.disconnect()
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
    if (id === formingCapsule.id) {
      // opening the unmarked capsule starts the next one forming (4 hours out)
      setOpenedCycle(forming.cycle)
      setForming({ readyAt: Date.now() + 4 * 60 * 60 * 1000, cycle: forming.cycle + 1 })
    }
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
      <AmbientLine lines={useMemo(() => [...CAPSULE_EVENTS, ...livedInLines('capsules', 2)], [])} />
      <div className="ghost-signal-banner glass" role="note" aria-label="Ghost signal of the day">
        <div className="ghost-signal-head">
          <span className="ghost-signal-kicker">GHOST SIGNAL OF THE DAY</span>
          <span className="ghost-signal-age">{ghostCapsule.age}</span>
        </div>
        <div className="ghost-signal-title">{ghostCapsule.title}</div>
        <p className="ghost-signal-line">{ghostCapsule.line}</p>
      </div>
      <div className="capsules-list" ref={listRef}>
        {allCapsules.map((c, i) => {
          const phase: CapsulePhase = phases[c.id] ?? 'sealed'
          const isForming = c.id === formingCapsule.id && !formed && openedCycle === null
          const memory = c.id === formingCapsule.id
            ? { line: formingMemoryPool[(openedCycle ?? forming.cycle) % formingMemoryPool.length], seed: 67 + (openedCycle ?? forming.cycle) * 13 }
            : capsuleMemories[c.id]
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
                  {isForming
                    ? formingRemaining > 60 * 60 * 1000
                      ? `still forming · ready in ${Math.ceil(formingRemaining / 3600000)}h — come back`
                      : `still forming · ready in ${Math.max(1, Math.ceil(formingRemaining / 60000))}m — come back`
                    : (
                      <>
                        {c.feeling} ·{' '}
                        <span
                          className={`capsule-duration${phase === 'sealed' ? ' capsule-duration--veiled' : ''}`}
                          title={phase === 'sealed' ? 'break the seal to reveal' : undefined}
                        >
                          {phase === 'sealed' ? '?:??' : c.duration}
                        </span>{' '}
                        · {c.timestamp}
                      </>
                    )}
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
      <PersonalCapsules />
      <LiveTail page="capsules" />
    </div>
  )
}

type PersonalCapsule = { id: string; title: string; createdAt: number; durationMs: number }

/** Capsules the user records themselves — sealed audio, break to replay. */
function PersonalCapsules() {
  const [myCapsules, setMyCapsules] = usePersistentState<PersonalCapsule[]>('ecosphere:personalCapsules', [])
  const [blobs, setBlobs] = useState<Record<string, Blob>>({})
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({})
  const [recorderOpen, setRecorderOpen] = useState(false)

  useEffect(() => {
    if (myCapsules.length === 0) return
    void listLocalRecordings().then(rows => {
      setBlobs(Object.fromEntries(rows.map(r => [r.id, r.blob])))
    })
  }, [myCapsules.length])

  return (
    <div className="personal-capsules">
      <div className="section-head">
        <span className="section-kicker">seal your own transmission</span>
        <button type="button" className="obs-transmit-toggle" onClick={() => setRecorderOpen(o => !o)}>
          {recorderOpen ? 'leave it unsaid' : '◎ record a capsule'}
        </button>
      </div>
      {recorderOpen && (
        <AudioRecorder
          kind="capsule"
          prompt="speak something worth keeping. it seals itself when you send it."
          onComplete={({ durationMs, uploadId }) => {
            setMyCapsules(prev => [
              { id: uploadId, title: `Sealed Transmission ${String(prev.length + 1).padStart(2, '0')}`, createdAt: Date.now(), durationMs },
              ...prev,
            ])
            setRecorderOpen(false)
          }}
        />
      )}
      {myCapsules.length > 0 && (
        <div className="capsules-list personal-capsules-list">
          {myCapsules.map(capsule => {
            const open = openIds[capsule.id]
            const blob = blobs[capsule.id]
            return (
              <div
                key={capsule.id}
                role="button"
                tabIndex={0}
                className={`capsule-card glass lp-capsule phase-${open ? 'open' : 'sealed'}`}
                onClick={() => { if (!open) setOpenIds(p => ({ ...p, [capsule.id]: true })) }}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !open) { e.preventDefault(); setOpenIds(p => ({ ...p, [capsule.id]: true })) } }}
              >
                <div className="capsule-glyph" aria-hidden="true">◎</div>
                <div className="capsule-body">
                  <div className="capsule-title">{capsule.title}</div>
                  <div className="capsule-meta">
                    yours · {open ? `${Math.round(capsule.durationMs / 1000)}s` : '?:??'} · sealed {new Date(capsule.createdAt).toLocaleDateString()}
                  </div>
                  {!open && <div className="lp-capsule-hint">tap to break the seal</div>}
                  {open && (
                    <div className="capsule-memory" onClick={e => e.stopPropagation()}>
                      {blob
                        ? <AudioPlayer src={blob} seed={capsule.createdAt % 9973} durationSeconds={capsule.durationMs / 1000} />
                        : <p className="capsule-memory-line">this capsule's audio lives on the device that sealed it.</p>}
                      <button type="button" className="capsule-reseal" onClick={e => { e.stopPropagation(); setOpenIds(p => ({ ...p, [capsule.id]: false })) }}>
                        ◌ seal it again
                      </button>
                    </div>
                  )}
                </div>
                <span className="badge badge-pink">{open ? 'open' : 'sealed'}</span>
              </div>
            )
          })}
        </div>
      )}
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

const relicPostits: Record<string, string[]> = {
  rl1: ['i played this in a parking lot for 40 mins', 'the silence before they talk felt worse'],
  rl2: ['heard this at 3:12am eating cereal', 'why did this actually help'],
  rl3: ['i muted this halfway. came back.', 'this one feels dangerous after 1am'],
  rl4: ['the laugh at the end ruined me', 'i almost sent this to someone'],
  rl5: ['someone was breathing in the background', 'the ending kinda—'],
}

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
  const relicAudio = useGlobalAudio()
  const [store, setStore] = usePersistentState<Record<string, RelicActivity>>('ecosphere:relicActivity', {})
  const [charge, setCharge] = useState<Record<string, number>>(() => Object.fromEntries(relics.map(r => [r.id, r.resonance])))
  const [shelfVisit, setShelfVisit] = usePersistentState<string>('ecosphere:relicShelfVisit', '')
  const [shelfNote, setShelfNote] = useState<string | null>(null)

  // returning on a new day re-stabilizes the shelf — a reason to come back tomorrow
  useEffect(() => {
    const today = localDateString()
    if (shelfVisit && shelfVisit !== today) {
      setCharge(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, Math.min(100, v + 14)])))
      setShelfNote('the shelf settled overnight · charges restored')
      const t = window.setTimeout(() => setShelfNote(null), 6000)
      setShelfVisit(today)
      return () => window.clearTimeout(t)
    }
    if (!shelfVisit) setShelfVisit(today)
  }, [shelfVisit, setShelfVisit])
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
      <AmbientLine lines={useMemo(() => [...RELIC_EVENTS, ...livedInLines('relics', 3)], [])} />
      {shelfNote && <div className="lp-drift-ping" key={shelfNote}>{shelfNote}</div>}
      <LiveTail page="relics" />
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
              <div className={`cassette${relicAudio.current?.id === `relic-${r.id}` && relicAudio.playing ? ' playing' : ''}`} aria-hidden="true">
                <span className="cassette-reel" />
                <span className="cassette-window" />
                <span className="cassette-reel" />
              </div>
              <div className="relic-name">{r.name}</div>
              <div className="relic-postits" aria-hidden="true">
                {(relicPostits[r.id] ?? []).slice(0, 2).map((note, ni) => (
                  <span key={note} className={`postit postit-${ni}`}>{note}</span>
                ))}
              </div>
              <RarityBadge rarity={r.rarity} />
              <div className="relic-resonance">{Math.round(c)}%</div>
              {(a.replays > 0 || a.saved) && (
                <div className="lp-relic-trace">{a.replays > 0 ? `${a.replays}× replayed` : 'kept'}</div>
              )}
              {c < 45 && <div className="lp-relic-unstable">unstable · return tomorrow</div>}
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
            <div className="lp-relic-examined">{lastExaminedBy(selected.id)}</div>
            <div className="relic-postits relic-postits--overlay" aria-hidden="true">
              {(relicPostits[selected.id] ?? []).map((note, ni) => (
                <span key={note} className={`postit postit-${ni}`}>{note}</span>
              ))}
            </div>
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
                    void playSample(relicAudio, { id: `relic-${selected.id}`, label: `${selected.name.toLowerCase()} · echo`, source: 'relics' }, 'tone', selected.id.charCodeAt(2) * 37, 4200)
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

const ZONE_EVENTS = [
  'someone recovered a fragment 2 minutes ago',
  'signal degrading in Left on Read',
  'new abandoned room detected',
  'recovery failed · fragment too corrupted',
  'echo chain growing on a recovered message',
  'partial reconstruction found',
] as const

const zoneFragments: Record<string, string> = {
  z1: 'recovered: "anyway. goodnight." said to an empty room',
  z2: 'recovered: the message read out loud, once, quietly',
  z3: 'recovered: two people laughing over each other, mid-sentence',
  z4: 'recovered: "—at like that. i\'m sorry. call me."',
  z5: 'recovered: the unsent draft, typed and deleted three times',
  z6: 'recovered: "i meant it though." sent to no one',
}

const GLITCH_CHARS = '▓▒░#%&@$!?/\\|<>^~'

function GlitchQuote({ text, recovery, flickerTick }: { text: string; recovery: number; flickerTick: number }) {
  return (
    <p className="zone-quote" aria-label={recovery >= 60 ? text : 'corrupted transmission'}>
      {text.split('').map((ch, i) => {
        if (ch === ' ') return ' '
        // each character stabilizes at a different recovery threshold
        const threshold = ((i * 37 + text.length * 7) % 100)
        const stable = recovery >= threshold
        const flick = !stable && ((i * 13 + flickerTick * 7) % 5 === 0)
        return (
          <span key={i} className={stable ? 'zq-stable' : 'zq-glitch'}>
            {stable ? ch : GLITCH_CHARS[(i + flickerTick) % GLITCH_CHARS.length]}
            {flick ? '' : ''}
          </span>
        )
      })}
    </p>
  )
}

function DeadZonesScreen() {
  const { saveToLibrary } = useEcosystemState()
  const zoneAudio = useGlobalAudio()
  const [corruption, setCorruption] = useState<Record<string, number>>(() => Object.fromEntries(deadZones.map(z => [z.id, z.corruption])))
  const [recovered, setRecovered] = usePersistentState<string[]>('ecosphere:zoneFragments', [])
  const [recovery, setRecovery] = usePersistentState<Record<string, number>>('ecosphere:zoneRecovery', {})
  const [listening, setListening] = useState<string | null>(null)
  const [holding, setHolding] = useState<string | null>(null)
  const [flickerTick, setFlickerTick] = useState(0)
  const [criticalLeft, setCriticalLeft] = useState(90)
  const holdTimerRef = useRef<number | null>(null)
  const { unlockRelic: unlockZoneRelic } = useEcosystemState()

  // glitch flicker + critical countdown (Unfinished Goodbye is time-limited)
  useEffect(() => {
    const t = window.setInterval(() => {
      setFlickerTick(n => n + 1)
      setCriticalLeft(c => Math.max(0, c - 0.4))
    }, 400)
    return () => window.clearInterval(t)
  }, [])

  const stopHold = () => {
    if (holdTimerRef.current !== null) {
      window.clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setHolding(null)
  }

  useEffect(() => stopHold, [])

  // hold to recover: progress climbs while held, audio plays underneath
  const startHold = (zoneId: string, name: string) => {
    if (holding || (recovery[zoneId] ?? 0) >= 100) return
    setHolding(zoneId)
    listenInto(zoneId, name)
    holdTimerRef.current = window.setInterval(() => {
      setRecovery(prev => {
        const next = Math.min(100, (prev[zoneId] ?? 0) + 3)
        if (next >= 100 && (prev[zoneId] ?? 0) < 100) {
          unlockZoneRelic(`zone-${zoneId}`, deadZones.find(z => z.id === zoneId)?.name ?? 'Recovered Fragment')
        }
        return { ...prev, [zoneId]: next }
      })
      setCorruption(prev => ({ ...prev, [zoneId]: Math.max(6, (prev[zoneId] ?? 50) - 2) }))
    }, 220)
  }

  // corruption breathes while you watch
  useEffect(() => {
    const t = window.setInterval(() => {
      setCorruption(prev => Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, Math.max(20, Math.min(96, v + (Math.random() - 0.5) * 5))]),
      ))
    }, 4000)
    return () => window.clearInterval(t)
  }, [])

  const listenInto = (zoneId: string, name: string) => {
    setListening(zoneId)

    void playSample(zoneAudio, { id: `zone-${zoneId}`, label: `static from ${name.toLowerCase()}`, source: 'zones' }, 'zone', zoneId.charCodeAt(1) * 71, 4500)
    window.setTimeout(() => setListening(l => (l === zoneId ? null : l)), 4500)
    // listening into a zone can shake a fragment loose
    if (!recovered.includes(zoneId) && Math.random() > 0.35) {
      window.setTimeout(() => {
        setRecovered(r => (r.includes(zoneId) ? r : [...r, zoneId]))
        saveToLibrary('drift', `zone-${zoneId}`, zoneFragments[zoneId] ?? 'recovered fragment')
      }, 3200)
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">DEAD ZONES</div>
        <h2 className="screen-title">Abandoned Rooms</h2>
        <p className="screen-sub">rooms that went quiet. listen in, recover what's left, bring them back.</p>
      </div>
      <AmbientLine lines={useMemo(() => [...ZONE_EVENTS, ...livedInLines('zones', 2)], [])} />
      <div className="zones-atmosphere" aria-hidden="true">
        <span /><span /><span />
        <em>04:17</em><em>02:51</em><em>03:33</em>
      </div>
      <div className="zones-list">
        {deadZones.map((z, i) => {
          const level = Math.round(corruption[z.id] ?? z.corruption)
          const recoveryPct = Math.min(100, recovery[z.id] ?? 0)
          const revived = recoveryPct >= 100
          const isListening = listening === z.id
          const hasFragment = recovered.includes(z.id)
          return (
            <div
              key={z.id}
              className={`zone-card glass lp-card lp-enter${isListening ? ' zone-card--listening' : ''}${hasFragment ? ' zone-card--recovered' : ''}${revived ? ' zone-card--revived' : ''}`}
              style={{ '--idx': i, '--zone-corruption': (level / 100).toFixed(2) } as CSSProperties}

            >
              <div className="zone-header">
                <span className="zone-name">{z.name}</span>
                <span className={`badge ${revived ? 'badge-cyan' : z.status === 'corrupted' ? 'badge-red' : z.status === 'recoverable' ? 'badge-cyan' : 'badge-grey'}`}>
                  {revived ? 'room revived' : hasFragment ? 'fragment recovered' : z.status}
                </span>
              </div>
              <GlitchQuote text={z.description} recovery={recoveryPct} flickerTick={flickerTick} />
              {z.id === 'z4' && recoveryPct < 100 && (
                <div className={`zone-critical${criticalLeft <= 15 ? ' urgent' : ''}`}>
                  {criticalLeft > 0
                    ? `recoverable for 00:${String(Math.ceil(criticalLeft)).padStart(2, '0')}`
                    : 'window closed · fragment lost for tonight'}
                </div>
              )}
              {recoveryPct < 100 && (z.id !== 'z4' || criticalLeft > 0) && (
                <button
                  type="button"
                  className={`zone-hold-btn${holding === z.id ? ' holding' : ''}`}
                  onPointerDown={e => { e.stopPropagation(); startHold(z.id, z.name) }}
                  onPointerUp={stopHold}
                  onPointerLeave={stopHold}
                  onClick={e => e.stopPropagation()}
                >
                  {holding === z.id ? `◉ recovering… ${recoveryPct}%` : '◉ hold to recover'}
                </button>
              )}
              {isListening && (
                <div className="zone-listening">
                  <LpWaveform seed={z.id.charCodeAt(1) * 53} bars={28} active tint="violet" />
                  <small>listening into the void…</small>
                </div>
              )}
              {hasFragment && !isListening && (
                <>
                  <p className="zone-fragment">{zoneFragments[z.id]}</p>
                  <ListenerTraces signalId={`zone-${z.id}`} resonance={z.corruption} replayed />
                </>
              )}
              <div className="zone-recovery" aria-label="recovery progress">
                <span>recovery {recoveryPct}%</span>
                <div className="zone-recovery-track"><i style={{ width: `${recoveryPct}%` }} /></div>
              </div>
              <div className="zone-visits">
                {revived
                  ? `${2 + listenerCount(z.id, Math.floor(Date.now() / 3600000))} people came back since you revived it`
                  : `${listenerCount(z.id, Math.floor(Date.now() / 3600000))} people have listened into this room`}
              </div>
              <div className="zone-footer">
                <span className="zone-last">{isListening ? 'attempting recovery…' : `${z.lastSignal} · corruption ${level}%`}</span>
                <SignalBar value={level} color="violet" />
              </div>
            </div>
          )
        })}
      </div>
      <LiveTail page="zones" />
    </div>
  )
}

// ═══ FREQUENCY SEA — drifting through a distant emotional ocean ═══

type SeaSource = 'unsent' | 'reaction' | 'deadzone' | 'feed' | 'room'

type SeaBuoy = {
  id: number
  source: SeaSource
  fragment: string
  kind: 'voice' | 'whisper' | 'laugh' | 'static' | 'zone' | 'tone'
  seed: number
  top: number
  duration: number
  delay: number
  fading: boolean
  deep: boolean
}

const SEA_ZONES = [
  'Quiet Waters', 'Sleepless Tide', 'Static Rain', 'Distant Voices',
  'Soft Collapse', 'Late Drive Waters', 'Echo Coast', 'Fading Signals', 'Open Ocean',
] as const

const SEA_FRAGMENTS: Record<SeaSource, string[]> = {
  unsent: [
    'i typed this whole thing out and never sent it.',
    'i kept the voicemail. i know.',
    "it's been a year. i still draft texts i'll never send.",
    'i almost called you when it happened.',
  ],
  reaction: [
    '(laughing, far away)',
    '(whispered) i replayed this twice',
    'no because same',
    '(a sigh, then quiet)',
  ],
  deadzone: [
    'i waited up longer than i should have.',
    "you saw it. you just didn't answer.",
    "i didn't mean to leave like th—",
  ],
  feed: [
    'still awake. the quiet feels different tonight.',
    'something about 3am feels like the only honest hour.',
    'replaying the same memory again.',
  ],
  room: [
    'a room full of people not sleeping, together',
    'someone sharing an unfinished song',
    'two voices agreeing about everything at 2am',
  ],
}

const SEA_KIND: Record<SeaSource, SeaBuoy['kind']> = {
  unsent: 'voice',
  reaction: 'whisper',
  deadzone: 'zone',
  feed: 'voice',
  room: 'tone',
}

const SEA_TIDES = [
  'tide rising · currents pulling east',
  'heavy current passing through',
  'calm surface · faint voices underneath',
  'static rain over the far water',
  'a signal storm, somewhere past the horizon',
  'tide easing · echoes carrying further',
] as const

function makeBuoy(id: number, night: boolean): SeaBuoy {
  const sources: SeaSource[] = ['unsent', 'reaction', 'deadzone', 'feed', 'room']
  const source = sources[id % sources.length]
  const pool = SEA_FRAGMENTS[source]
  return {
    id,
    source,
    fragment: pool[(id * 7) % pool.length],
    kind: SEA_KIND[source],
    seed: id * 97 + 13,
    top: 12 + ((id * 31) % 68),
    duration: 38 + ((id * 13) % 30),
    delay: -((id * 9) % 38),
    fading: id % 4 === 2,
    deep: night && id % 7 === 5,
  }
}

function FrequenciesScreen() {
  const { reactToSignal, saveToLibrary } = useEcosystemState()
  const night = (() => { const h = new Date().getHours(); return h >= 22 || h < 5 })()
  const [buoys, setBuoys] = useState<SeaBuoy[]>(() => Array.from({ length: night ? 9 : 7 }, (_, i) => makeBuoy(i, night)))
  const [nearId, setNearId] = useState<number | null>(null)
  const [zoneIdx, setZoneIdx] = useState(() => Math.floor(Date.now() / 40000) % SEA_ZONES.length)
  const [tideIdx, setTideIdx] = useState(0)
  const [ping, setPing] = useState<string | null>(null)
  const [stabilized, setStabilized] = useState<number[]>([])
  const [orbOpen, setOrbOpen] = useState<number | null>(null)
  const seaOrbs = useMemo(() => [
    { presence: 'a quiet listener', replaying: 'still awake. the quiet feels different tonight.', cassette: 'Echo Veil', trace: 'drifting for 18 min · paused twice near you' },
    { presence: 'someone half asleep', replaying: 'i kept the voicemail. i know.', cassette: 'Pulse Crystal VII', trace: 'crossed your path 4 min ago' },
    { presence: 'a restless presence', replaying: '(laughing, far away)', cassette: 'Static Bloom', trace: 'following the same current as you' },
    { presence: 'someone on a long drive', replaying: 'replaying the same memory again.', cassette: 'Memory Burn', trace: 'left a resonance trail heading east' },
  ], [])
  const timersRef = useRef<number[]>([])

  // tides shift; the sea slowly carries you into new zones
  useEffect(() => {
    const t = window.setInterval(() => setTideIdx(n => n + 1), 9000)
    const z = window.setInterval(() => {
      setZoneIdx(i => (i + 1) % SEA_ZONES.length)
      // currents replace a drifting signal now and then
      setBuoys(prev => {
        const replaceAt = Math.floor(Math.random() * prev.length)
        return prev.map((b, i) => (i === replaceAt && !stabilized.includes(b.id) ? makeBuoy(b.id + prev.length * 3, night) : b))
      })
    }, 40000)
    const timers = timersRef.current
    return () => {
      window.clearInterval(t)
      window.clearInterval(z)
      timers.forEach(id => window.clearTimeout(id))
      stopPreviewBuffer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const say = (text: string) => {
    setPing(text)
    timersRef.current.push(window.setTimeout(() => setPing(null), 4000))
  }

  // drifting near a signal: it clarifies; drifting away: it fades back to sea
  const driftNear = (b: SeaBuoy) => {
    setNearId(b.id)
    void playSampleBuffer(b.kind, b.seed, 7000, 0.3)
  }

  const driftAway = () => {
    setNearId(null)
    stopPreviewBuffer()
  }

  const saveEcho = (b: SeaBuoy) => {
    saveToLibrary('drift', `sea-${b.id}`, `echo from the sea · "${b.fragment.slice(0, 36)}"`)
    say('echo saved · it will keep drifting with you')
  }

  const stabilize = (b: SeaBuoy) => {
    setStabilized(prev => [...prev, b.id])
    say('signal stabilized · it will not fade tonight')
  }

  const followCurrent = () => {
    setZoneIdx(i => (i + 1) % SEA_ZONES.length)
    setBuoys(prev => prev.map(b => (stabilized.includes(b.id) ? b : makeBuoy(b.id + 100 + Math.floor(Math.random() * 50), night))))
    say(`the current carried you into ${SEA_ZONES[(zoneIdx + 1) % SEA_ZONES.length].toLowerCase()}`)
  }

  const sendIntoSea = () => {
    reactToSignal('frequency-sea', 'released a signal into the sea')
    say('your signal drifted out past the horizon')
  }

  return (
    <div className={`sea-screen${night ? ' sea-screen--night' : ''}`}>
      <div className="sea-fog sea-fog-a" aria-hidden="true" />
      <div className="sea-fog sea-fog-b" aria-hidden="true" />
      <div className="sea-glow" aria-hidden="true" />
      <div className="sea-lightning" aria-hidden="true" />
      <div className="sea-waves" aria-hidden="true"><span /><span /><span /></div>

      <header className="sea-header">
        <span className="sea-kicker">FREQUENCY SEA</span>
        <h1 className="sea-zone" key={zoneIdx}>{SEA_ZONES[zoneIdx]}</h1>
        <p className="sea-tide" key={tideIdx}>{SEA_TIDES[tideIdx % SEA_TIDES.length]}{night ? ' · night tide' : ''}</p>
      </header>

      <div className="sea-field">
        {[0, 1, 2, 3].map(i => {
          const open = orbOpen === i
          const orb = seaOrbs[i]
          return (
            <div
              key={`orb-${i}`}
              className={`sea-orb${open ? ' open' : ''}`}
              style={{ '--top': `${20 + i * 18}%`, '--dur': `${52 + i * 9}s`, '--delay': `${-i * 14}s` } as CSSProperties}
            >
              <button type="button" aria-label="a listener drifting nearby" onClick={() => setOrbOpen(open ? null : i)} />
              {open && (
                <div className="sea-orb-panel">
                  <strong>{orb.presence}</strong>
                  <span>replaying · "{orb.replaying}"</span>
                  <span>recent cassette · {orb.cassette}</span>
                  <span>{orb.trace}</span>
                </div>
              )}
            </div>
          )
        })}
        {buoys.map(b => {
          const near = nearId === b.id
          const isStable = stabilized.includes(b.id)
          return (
            <div
              key={b.id}
              className={`sea-buoy sea-buoy--${b.source}${near ? ' near' : ''}${b.fading && !isStable ? ' fading' : ''}${b.deep ? ' deep' : ''}`}
              style={{ '--top': `${b.top}%`, '--dur': `${b.duration}s`, '--delay': `${b.delay}s` } as CSSProperties}
            >
              <button
                type="button"
                className="sea-buoy-light"
                onPointerEnter={() => driftNear(b)}
                onPointerLeave={driftAway}
                onClick={() => (near ? driftAway() : driftNear(b))}
                aria-label={`drift near a distant ${b.source} signal`}
              >
                <i /><i /><i />
              </button>
              {near && (
                <div className="sea-fragment">
                  <p>"{b.fragment}"</p>
                  <div className="sea-fragment-actions">
                    <button type="button" onClick={() => saveEcho(b)}>✶ save echo</button>
                    {b.fading && !isStable && (
                      <button type="button" onClick={() => stabilize(b)}>◌ stabilize</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {ping && <div className="sea-ping" key={ping}>{ping}</div>}

      <footer className="sea-controls">
        <button type="button" onClick={followCurrent}>⇝ follow the current</button>
        <button type="button" onClick={sendIntoSea}>◉ send a signal into the sea</button>
      </footer>
    </div>
  )
}


function PodAudioLibrary() {
  const libAudio = useGlobalAudio()
  const [recordings, setRecordings] = useState<Array<{ id: string; label: string; durationMs: number; createdAt: number; blob: Blob }>>([])
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  useEffect(() => {
    let cancelled = false
    void listLocalRecordings().then(rows => { if (!cancelled) setRecordings(rows) })
    return () => { cancelled = true }
  }, [])

  const commitRename = (rec: { id: string; label: string; durationMs: number; createdAt: number; blob: Blob }) => {
    const label = draftName.trim().slice(0, 40) || rec.label
    setRecordings(prev => prev.map(r => (r.id === rec.id ? { ...r, label } : r)))
    void saveRecordingLocally({ id: rec.id, label, durationMs: rec.durationMs, emotionalTag: 'unresolved', createdAt: rec.createdAt, blob: rec.blob })
    setRenaming(null)
  }

  if (recordings.length === 0) return null

  return (
    <div className="lp-library hub-recordings">
      <div className="lp-library-head">
        <span>YOUR RECORDINGS</span>
        <small>{recordings.length} stored on this device</small>
      </div>
      {recordings.map(rec => (
        <div key={rec.id} className="lp-library-item glass">
          <span className="lp-library-type lp-library-type--audio">rec</span>
          <div className="lp-library-body">
            {renaming === rec.id ? (
              <input
                className="hub-rename-input"
                autoFocus
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onBlur={() => commitRename(rec)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(rec); if (e.key === 'Escape') setRenaming(null) }}
              />
            ) : (
              <strong>{rec.label}</strong>
            )}
            <small>{Math.round(rec.durationMs / 1000)}s · {lpTimeAgo(new Date(rec.createdAt).toISOString())}</small>
          </div>
          <div className="lp-library-actions">
            <button type="button" aria-label="replay recording" onClick={() => { void libAudio.playBlob(rec.blob, { id: rec.id, label: rec.label, source: 'pod' }) }}>▶</button>
            <button type="button" aria-label="rename recording" onClick={() => { setRenaming(rec.id); setDraftName(rec.label) }}>✎</button>
            <button
              type="button"
              aria-label="export recording"
              onClick={() => {
                void renderStoryImage({ handle: rec.label.toLowerCase(), caption: 'a voice note that never got sent.', duration: `0:${String(Math.round(rec.durationMs / 1000)).padStart(2, '0')}`, typeLabel: 'your recording', waveformSeed: rec.createdAt % 9973 }).then(b => {
                  if (b) downloadBlob(b, exportFilename(rec.label, 'image'))
                })
              }}
            >
              ⬡
            </button>
            <button type="button" aria-label="delete recording" onClick={() => { setRecordings(prev => prev.filter(r => r.id !== rec.id)); void deleteLocalRecording(rec.id) }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}

const POD_EVENTS = [
  '7 people replayed your signal tonight',
  'someone echoed your recording',
  'your saved signal resurfaced',
  'a new voice chain started on your reply',
  'your room from last night is active again',
] as const

function SoulPodScreen({ user, onSignOut, onNavigate }: { user: { email?: string; id: string } | null; onSignOut: () => void; onNavigate?: (s: Screen) => void }) {
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

  const podEnergy = Math.min(1, (eco.resonanceLevel + podPulses * 2 + eco.streak.count * 4) / 130)
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
        <div className="glass pod-auth">
          <div className="pod-auth-visualizer" aria-hidden="true"><span /><span /><span /></div>
          <div className="pod-auth-tabs">
            {(['login', 'signup'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                className={`pod-auth-tab${authMode === mode ? ' active' : ''}`}
                onClick={() => { setAuthMode(mode); setError(null); setMessage(null) }}
              >
                {mode === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>
          <form onSubmit={handleAuth} className="pod-auth-form">
            {authMode === 'signup' && (
              <div className="pod-auth-field">
                <label htmlFor="pod-signal-name">Signal Name</label>
                <input
                  id="pod-signal-name"
                  type="text"
                  value={signalName}
                  onChange={e => setSignalName(e.target.value)}
                  placeholder="how the ecosystem knows you"
                />
              </div>
            )}
            <div className="pod-auth-field">
              <label htmlFor="pod-email">Email</label>
              <input
                id="pod-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your signal address"
              />
            </div>
            <div className="pod-auth-field">
              <label htmlFor="pod-password">Password</label>
              <input
                id="pod-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="minimum 6 characters"
              />
            </div>
            {error && <div className="pod-auth-notice pod-auth-notice--error">{error}</div>}
            {message && <div className="pod-auth-notice pod-auth-notice--ok">{message}</div>}
            <button type="submit" className="pod-auth-submit" disabled={loading}>
              {loading ? 'transmitting…' : authMode === 'login' ? 'Enter Pod' : 'Create Signal'}
            </button>
          </form>
          {!supabase && (
            <div className="pod-auth-hint">⚡ Supabase not yet configured — add env vars to enable auth</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">SOUL POD</div>
        <h2 className="screen-title">Your Hub</h2>
        <p className="screen-sub">your signals, saves, recordings, and activity — all in one place</p>
      </div>
      <ProfileHub onNavigate={screen => onNavigate?.(screen as Screen)} />
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
          {podStage === 'radiant' ? `radiant · ${eco.streak.count} night streak` : podStage === 'awake' ? 'active · keep listening' : 'tap to boost your glow'}
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
      <div className="hub-actions">
        {[
          { label: '◉ record signal', page: 'unsent' as Screen },
          { label: '∿ enter live rooms', page: 'rooms' as Screen },
          { label: '⌖ scan frequencies', page: 'drift' as Screen },
          { label: '◌ check dead zones', page: 'zones' as Screen },
        ].map(a => (
          <button key={a.page} type="button" className="hub-action glass" onClick={() => onNavigate?.(a.page)}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="lp-pod-stats">
        {[
          { label: 'resonance', value: `${Math.round(eco.resonanceLevel)}%` },
          { label: 'night streak', value: String(eco.streak.count) },
          { label: 'replays', value: String(eco.listeningHistory.length) },
          { label: 'saved', value: String(eco.library.length) },
          { label: 'relics', value: String(eco.unlockedRelics.length) },
          { label: 'archived', value: String(eco.archiveHistory.length) },
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
                  onClick={() => {
                    const kind = entry.itemType === 'relic' ? 'tone' : entry.itemType === 'drift' ? 'whisper' : 'voice'
                    void playSample(podAudio, { id: entry.id, label: entry.label, source: 'pod' }, kind, entry.id.split('').reduce((a, c) => a + c.charCodeAt(0), 11), 5000)
                  }}
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
      <PodAudioLibrary />

      {eco.recentInteractions.length > 0 && (
        <div className="lp-library hub-activity">
          <div className="lp-library-head">
            <span>RECENT ACTIVITY</span>
            <small>{eco.recentInteractions.length} actions</small>
          </div>
          {eco.recentInteractions.slice(0, 8).map(it => (
            <div key={it.id} className="hub-activity-row glass">
              <span className={`hub-activity-type hub-activity-type--${it.type}`} aria-hidden="true">
                {it.type === 'signal_play' ? '▶' : it.type === 'voice_reaction' ? '◉' : it.type === 'room_enter' ? '∿' : it.type === 'relic_unlocked' ? '◈' : it.type === 'signal_saved' ? '✶' : '·'}
              </span>
              <span className="hub-activity-label">{it.label}</span>
              <span className="hub-activity-time">{lpTimeAgo(it.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      <LiveTail page="pod" onNavigate={onNavigate} />
    </div>
  )
}

const ANOMALY_EVENTS = [
  'spectrum holding steady',
  'a low pattern repeated twice',
  'containment fields nominal',
  'something brushed the outer band',
  'the floor hum changed key',
] as const

const anomalyReadouts: Record<string, string[]> = {
  'Pulse Spike': ['tracing the surge to its origin…', 'origin: a replay played 11 times in a row', 'verdict: not a malfunction. somebody needed that one.'],
  'Unknown Transmission': ['isolating the repeating carrier…', 'pattern matches no registered signal', 'it stops when observed. resuming watch.'],
  'Memory Flicker': ['sampling unstable phases…', 'the flicker syncs with drift activity', 'memories hold better when someone is listening.'],
  'Dead Zone Movement': ['re-mapping zone boundary…', 'the zone moved toward the observatory', 'it may simply want to be found.'],
  'Echo Loop': ['measuring loop decay…', 'echo amplitude falling 2% per cycle', 'verdict: let it fade on its own terms.'],
  'Resonance Overflow': ['containment cannot hold this much feeling…', 'overflow is harmless. overflow is the point.', 'verdict: keep going.'],
}

function AnomaliesScreen() {
  const { ecosystemState, setRareEvent } = useEcosystemState()
  const [strengths, setStrengths] = useState<Record<string, number>>({})
  const [investigating, setInvestigating] = useState<string | null>(null)
  const [readoutStep, setReadoutStep] = useState(0)
  const [contained, setContained] = usePersistentState<string[]>('ecosphere:containedAnomalies', [])

  const baseItems = useMemo(() => [
    { name: 'Pulse Spike', severity: 'critical', detected: 'now', strength: 97, desc: 'A sudden resonance surge fractured the local signal layer.' },
    { name: 'Unknown Transmission', severity: 'unknown', detected: '3 min ago', strength: 82, desc: 'An unidentified carrier is repeating beneath the observatory floor.' },
    { name: 'Memory Flicker', severity: 'elevated', detected: '11 min ago', strength: 69, desc: 'Recovered memories are blinking in and out of stable phase.' },
    { name: 'Dead Zone Movement', severity: 'unstable', detected: '26 min ago', strength: 58, desc: 'A dormant zone drifted outside its mapped boundary.' },
    { name: 'Echo Loop', severity: 'low', detected: '44 min ago', strength: 44, desc: 'A repeating echo pattern softened into a low-priority cycle.' },
  ], [])

  // high resonance manifests its own anomaly — the ecosystem talking back
  const items = useMemo(() => (
    ecosystemState.resonanceLevel >= 85
      ? [{ name: 'Resonance Overflow', severity: 'critical', detected: 'live', strength: Math.round(ecosystemState.resonanceLevel), desc: 'Your activity has pushed local resonance beyond mapped levels.' }, ...baseItems]
      : baseItems
  ), [baseItems, ecosystemState.resonanceLevel])

  // strengths drift while the page is open
  useEffect(() => {
    const t = window.setInterval(() => {
      setStrengths(prev => Object.fromEntries(
        items.map(a => {
          const cur = prev[a.name] ?? a.strength
          return [a.name, Math.max(20, Math.min(99, cur + (Math.random() - 0.5) * 6))]
        }),
      ))
    }, 3500)
    return () => window.clearInterval(t)
  }, [items])

  // investigation readout reveals line by line
  useEffect(() => {
    if (!investigating) { setReadoutStep(0); return }
    setReadoutStep(1)
    const lines = anomalyReadouts[investigating]?.length ?? 0
    const timers = Array.from({ length: lines - 1 }, (_, i) =>
      window.setTimeout(() => setReadoutStep(i + 2), (i + 1) * 1100),
    )
    const done = window.setTimeout(() => {
      setContained(c => (c.includes(investigating) ? c : [...c, investigating]))
      if (investigating === 'Resonance Overflow') setRareEvent('resonance overflow contained · barely')
    }, lines * 1100 + 600)
    return () => { timers.forEach(t => window.clearTimeout(t)); window.clearTimeout(done) }
  }, [investigating, setContained, setRareEvent])

  const sevColor: Record<string, string> = { critical: 'badge-red', unknown: 'badge-grey', elevated: 'badge-violet', unstable: 'badge-pink', low: 'badge-cyan' }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">SIGNAL ANOMALIES</div>
        <h2 className="screen-title">Anomalies</h2>
        <p className="screen-sub">irregularities in the emotional spectrum</p>
      </div>
      <AmbientLine lines={useMemo(() => [...ANOMALY_EVENTS, ...livedInLines('anomalies', 2)], [])} />
      <div className="anomaly-list">
        {items.map((a, i) => {
          const live = Math.round(strengths[a.name] ?? a.strength)
          const isOpen = investigating === a.name
          const isContained = contained.includes(a.name)
          const lines = anomalyReadouts[a.name] ?? []
          return (
            <div
              key={a.name}
              role="button"
              tabIndex={0}
              className={`anomaly-card glass lp-card lp-enter anomaly--${a.severity}${isOpen ? ' anomaly--open' : ''}${isContained ? ' anomaly--contained' : ''}`}
              style={{ '--idx': i } as CSSProperties}
              onClick={() => setInvestigating(cur => (cur === a.name ? null : a.name))}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInvestigating(cur => (cur === a.name ? null : a.name)) } }}
            >
              <div className="anomaly-header">
                <span className="anomaly-name">{a.name}</span>
                <span className={`badge ${isContained ? 'badge-cyan' : sevColor[a.severity]}`}>{isContained ? 'contained' : a.severity}</span>
              </div>
              <p className="anomaly-desc">{a.desc}</p>
              {!isOpen && !isContained && <div className="anomaly-hint">tap to investigate</div>}
              {isOpen && (
                <div className="anomaly-readout">
                  {lines.slice(0, readoutStep).map(line => (
                    <p key={line} className="lp-frag">{line}</p>
                  ))}
                </div>
              )}
              <div className="anomaly-footer">
                <span className="anomaly-detected">{a.detected}</span>
                <SignalBar value={live} color={a.severity === 'critical' ? 'pink' : a.severity === 'elevated' ? 'violet' : 'cyan'} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type EcoPrefs = {
  vibrate: boolean
  anonymous: boolean
  nightMode: boolean
  lurker: boolean
  uiSounds: boolean
  privateProfile: boolean
  signalVolume: number
  driftSensitivity: number
}

const defaultPrefs: EcoPrefs = { vibrate: true, anonymous: true, nightMode: false, lurker: false, uiSounds: true, privateProfile: false, signalVolume: 72, driftSensitivity: 60 }

function normalizeIdentity(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24)
}

// identities are 3-24 chars of [a-z0-9_], validated wherever they're set
function isValidIdentity(value: string) {
  return /^[a-z0-9_]{3,24}$/.test(value)
}

function SettingsScreen() {
  const { ecosystemState } = useEcosystemState()
  const [prefs, setPrefs] = usePersistentState<EcoPrefs>('ecosphere:settings', defaultPrefs)
  const [identityDraft, setIdentityDraft] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  // broadcast preference changes so global systems (audio volume,
  // night protocol, motion intensity) pick them up immediately
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ecosphere:prefs', { detail: prefs }))
  }, [prefs])

  const update = (patch: Partial<EcoPrefs>) => {
    setPrefs(p => ({ ...p, ...patch }))
    // mirror profile-level flags to the backend when configured
    if ('lurker' in patch || 'privateProfile' in patch) {
      void updateProfileFlags({
        ...(patch.lurker !== undefined ? { lurker_mode: patch.lurker } : {}),
        ...(patch.privateProfile !== undefined ? { is_private: patch.privateProfile } : {}),
      })
    }
  }

  const showNote = (text: string) => {
    setNote(text)
    window.setTimeout(() => setNote(null), 4000)
  }

  const renameIdentity = () => {
    const next = normalizeIdentity(identityDraft)
    if (!isValidIdentity(next)) {
      showNote('identities need 3–24 characters (letters, numbers, underscores)')
      return
    }
    try {
      window.localStorage.setItem('signalIdentity', next)
      const profileRaw = window.localStorage.getItem('ecosphereSignalProfile')
      const profile = profileRaw ? JSON.parse(profileRaw) : {}
      window.localStorage.setItem('ecosphereSignalProfile', JSON.stringify({ ...profile, username: next }))
    } catch { /* storage unavailable */ }
    void syncProfile(next)
    setIdentityDraft('')
    showNote(`identity retuned · ${next}`)
  }

  const resetIntro = () => {
    try {
      window.localStorage.removeItem('introSeen')
      window.localStorage.removeItem('signalIdentity')
      window.localStorage.removeItem('ecosphereSignalProfile')
      window.localStorage.removeItem('ecosphereBackendMigrated')
    } catch { /* storage unavailable */ }
    window.location.reload()
  }

  const wipeLocalData = () => {
    if (!confirmWipe) {
      setConfirmWipe(true)
      window.setTimeout(() => setConfirmWipe(false), 5000)
      return
    }
    try {
      window.localStorage.clear()
    } catch { /* storage unavailable */ }
    try {
      indexedDB.deleteDatabase('ecosphere-audio')
    } catch { /* unavailable */ }
    window.location.reload()
  }

  const [confirmCloudWipe, setConfirmCloudWipe] = useState(false)
  const [cloudWipeBusy, setCloudWipeBusy] = useState(false)
  const wipeCloudData = () => {
    if (!confirmCloudWipe) {
      setConfirmCloudWipe(true)
      window.setTimeout(() => setConfirmCloudWipe(false), 5000)
      return
    }
    setConfirmCloudWipe(false)
    setCloudWipeBusy(true)
    void deleteAccountData().then(ok => {
      setCloudWipeBusy(false)
      showNote(ok
        ? 'cloud data erased · signed out — this device keeps its local copy'
        : 'some cloud data could not be erased — try again in a moment')
    })
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">ECOSPHERE</div>
        <h2 className="screen-title">Settings</h2>
        <p className="screen-sub">tune your presence in the ecosystem</p>
      </div>

      <div className="settings-list">
        <div className="setting-row glass setting-row--identity">
          <div className="setting-info">
            <div className="setting-label">Signal Identity</div>
            <div className="setting-detail">{ecosystemState.userSignalIdentity ?? 'unclaimed frequency'}</div>
          </div>
          <div className="setting-identity-edit">
            <input
              type="text"
              value={identityDraft}
              placeholder="retune your signal…"
              onChange={e => setIdentityDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') renameIdentity() }}
            />
            <button type="button" disabled={!isValidIdentity(normalizeIdentity(identityDraft))} onClick={renameIdentity}>retune</button>
          </div>
        </div>

        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Anonymous Mode</div>
            <div className="setting-detail">broadcast without identity</div>
          </div>
          <button className={`toggle ${prefs.anonymous ? 'on' : ''}`} onClick={() => update({ anonymous: !prefs.anonymous })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Vibrate on Signal</div>
            <div className="setting-detail">haptic pulse on new resonance</div>
          </div>
          <button className={`toggle ${prefs.vibrate ? 'on' : ''}`} onClick={() => update({ vibrate: !prefs.vibrate })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Night Protocol</div>
            <div className="setting-detail">deepen the atmosphere</div>
          </div>
          <button className={`toggle ${prefs.nightMode ? 'on' : ''}`} onClick={() => update({ nightMode: !prefs.nightMode })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Private Profile</div>
            <div className="setting-detail">hide your profile from other carriers entirely</div>
          </div>
          <button className={`toggle ${prefs.privateProfile ? 'on' : ''}`} onClick={() => update({ privateProfile: !prefs.privateProfile })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Lurker Mode</div>
            <div className="setting-detail">just listen tonight — hides your presence, rests the recorders</div>
          </div>
          <button className={`toggle ${prefs.lurker ? 'on' : ''}`} onClick={() => update({ lurker: !prefs.lurker })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Push Notifications</div>
            <div className="setting-detail">opt-in browser alerts when something touches your signals</div>
          </div>
          <button
            type="button"
            className="setting-action"
            disabled={pushBusy}
            onClick={() => {
              setPushBusy(true)
              void enablePushNotifications().then(result => {
                setPushBusy(false)
                showNote(result === 'enabled' ? 'push enabled · the band can reach you now'
                  : result === 'denied' ? 'permission declined — nothing was enabled'
                  : result)
              })
            }}
          >
            {pushBusy ? 'enabling…' : 'enable push'}
          </button>
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Interface Sounds</div>
            <div className="setting-detail">soft radio clicks and static on interaction</div>
          </div>
          <button className={`toggle ${prefs.uiSounds ? 'on' : ''}`} onClick={() => update({ uiSounds: !prefs.uiSounds })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Signal Volume</div>
            <div className="setting-detail">{prefs.signalVolume}% — applies to all playback</div>
          </div>
          <input type="range" min={0} max={100} value={prefs.signalVolume} onChange={e => update({ signalVolume: +e.target.value })} className="range-input" />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">Drift Sensitivity</div>
            <div className="setting-detail">{prefs.driftSensitivity}% — ambient motion intensity</div>
          </div>
          <input type="range" min={0} max={100} value={prefs.driftSensitivity} onChange={e => update({ driftSensitivity: +e.target.value })} className="range-input" />
        </div>

        <div className="setting-row glass setting-row--danger">
          <div className="setting-info">
            <div className="setting-label">Replay Onboarding</div>
            <div className="setting-detail">re-enter the ecosphere from the beginning</div>
          </div>
          <button type="button" className="setting-action" onClick={resetIntro}>reset intro</button>
        </div>
        {isSupabaseConfigured && (
          <div className="setting-row glass setting-row--danger">
            <div className="setting-info">
              <div className="setting-label">Erase Cloud Data</div>
              <div className="setting-detail">delete every recording, signal, and trace of this account from the backend</div>
            </div>
            <button type="button" className={`setting-action setting-action--danger${confirmCloudWipe ? ' confirming' : ''}`} disabled={cloudWipeBusy} onClick={wipeCloudData}>
              {cloudWipeBusy ? 'erasing…' : confirmCloudWipe ? 'tap again to erase' : 'erase cloud'}
            </button>
          </div>
        )}
        <div className="setting-row glass setting-row--danger">
          <div className="setting-info">
            <div className="setting-label">Clear Local Data</div>
            <div className="setting-detail">erase identity, saves, recordings — everything on this device</div>
          </div>
          <button type="button" className={`setting-action setting-action--danger${confirmWipe ? ' confirming' : ''}`} onClick={wipeLocalData}>
            {confirmWipe ? 'tap again to erase' : 'erase'}
          </button>
        </div>
      </div>

      {note && <div className="setting-note">{note}</div>}

      <div className="settings-footer">
        <div className="settings-version">ecosphere v2.0 · signal observatory</div>
      </div>
    </div>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav({ active, onNav }: { active: Screen; onNav: (s: Screen) => void }) {
  const { recordingActive } = useRecordingSession()
  return (
    <nav className={`bottom-nav glass-nav${recordingActive ? ' nav--recording' : ''}`}>
      {navItems.map(item => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          disabled={recordingActive}
          title={recordingActive ? 'finish recording first' : item.label}
          onClick={() => {
            try {
              const raw = window.localStorage.getItem('ecosphere:settings')
              if ((!raw || JSON.parse(raw)?.vibrate) && 'vibrate' in navigator) navigator.vibrate(10)
            } catch { /* haptics unavailable */ }
            onNav(item.id)
          }}
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
  // deep links: the URL decides the starting screen (/rooms, /capsules, …)
  const [screen, setScreen] = useState<Screen>(() => screenForPath(window.location.pathname))
  const [veilKey, setVeilKey] = useState(0)
  const [user, setUser] = useState<{ email?: string; id: string } | null>(null)

  const navigate = (next: Screen) => {
    if (next === screen) return
    setScreen(next)
    setVeilKey(k => k + 1)
    try {
      window.history.pushState({}, '', SCREEN_PATHS[next])
    } catch { /* sandboxed iframe — state-only navigation still works */ }
  }

  // browser back/forward moves between screens
  useEffect(() => {
    const onPopState = () => {
      setScreen(screenForPath(window.location.pathname))
      setVeilKey(k => k + 1)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    document.title = `Ecosphere · ${SCREEN_TITLES[screen]}`
  }, [screen])

  // realtime: public activity from other carriers surfaces as a live echo
  const [liveEcho, setLiveEcho] = useState<string | null>(null)
  useEffect(() => {
    let hideTimer: number | undefined
    const unsubscribe = subscribeToEcosphereActivity(event => {
      setLiveEcho(event.label)
      window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => setLiveEcho(null), 5200)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(hideTimer)
    }
  }, [])

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
    home: <HomeScreen onNavigate={navigate} />,
    signals: <FeedScreen />,
    drift: <DriftScreen />,
    rooms: <RoomsScreenComponent />,
    unsent: <UnsentRoom />,
    capsules: <CapsulesScreen />,
    relics: <RelicsScreen />,
    zones: <DeadZonesScreen />,
    frequencies: <FrequenciesScreen />,
    anomalies: <AnomaliesScreen />,
    pod: <SoulPodScreen user={user} onSignOut={handleSignOut} onNavigate={navigate} />,
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

      <NotificationBell />

      {liveEcho && (
        <div className="live-echo-chip" role="status">
          <span aria-hidden="true" />
          {liveEcho}
        </div>
      )}

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
