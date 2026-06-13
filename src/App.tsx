import { Fragment, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { deleteAccountData, getOptionalSupabaseClient, isSupabaseConfigured, syncProfile, updateProfileFlags } from './lib'
import { localDateString, useEcosystemState } from './hooks/useEcosystemState'
import { deleteLocalRecording, deleteReactionAudio, listLocalRecordings, listReactionAudio, saveReactionAudio, saveRecordingLocally } from './lib/localAudioStore'
import { downloadBlob, exportFilename, renderStoryImage } from './lib/storyExport'
import { playChainBlend, playSample, playSampleBuffer, stopChainPlayback, stopPreviewBuffer } from './lib/sampleAudio'
import { speakSignal, speechSupported, cancelSpeech } from './lib/speech'
import { castRateCheck, recordCast } from './lib/castLine'
import { castToSea, fetchSeaLines, subscribeSeaLines, seaSyncEnabled } from './lib/seaSync'
import type { SeaLineRow } from './lib/seaSync'
import { lastExaminedBy, listenerCount, livedInLines } from './lib/livedIn'
import { subscribeToEcosphereActivity } from './lib/backendBridge'
import type { StoredReaction } from './lib/localAudioStore'
import { useGlobalAudio } from './hooks/useGlobalAudio'
import EcosphereAmbience from './components/EcosphereAmbience'
import ActiveCarriers from './components/ActiveCarriers'
import AudioRecorder from './components/AudioRecorder'
import AudioPlayer from './components/AudioPlayer'
import FrequencyRecap from './components/FrequencyRecap'
import NocturneObservatory from './components/NocturneObservatory'
import TonightsFrequency from './components/TonightsFrequency'
import CarrierRoom from './components/CarrierRoom'
import DormantFrequencies from './components/DormantFrequencies'
import { quietFor } from './lib/dormantRooms'
import type { DormantRoom } from './lib/dormantRooms'
import DeepListen from './components/DeepListen'
import ProfileHub from './components/ProfileHub'
import NotificationBell from './components/NotificationBell'
import FirstTour from './components/FirstTour'
import AgeGate, { ageConfirmed } from './components/AgeGate'
import HelpBot from './components/HelpBot'
import PodPresence from './components/PodPresence'
import SignalSearch from './components/SignalSearch'
import QuickCreate from './components/QuickCreate'
import ListenerTraces from './components/ListenerTraces'
import { humanizeActivity } from './lib/listeningIdentity'
import { DEEP_NIGHT_LINES, isDeepNight } from './lib/nightMode'
import { currentDrop, dropTimeLeft, isDropOpened, markDropOpened, markDropSeen, nextDropAt } from './lib/frequencyDrops'
import { pushLocalNotification } from './lib/notifications'
import { getHzProfile } from './lib/hzSignature'
import type { HzProfile } from './lib/hzSignature'
import SignalToSelf from './components/SignalToSelf'
import { useLocale } from './hooks/useLocale'
import { LOCALES, LOCALE_NAMES } from './lib/i18n'
import { useRecordingSession } from './hooks/useRecordingSession'
import { useEcoPref } from './hooks/useEcoPrefs'
import { useLivePresence } from './hooks/useLivePresence'
import { leaveTrace } from './lib/pageTrace'
import { readLastVoiceAt, silenceLine, silentDays } from './lib/weightOfSilence'
import { enablePushNotifications } from './lib/pushNotifications'
import { SCREEN_PATHS, screenForPath } from './lib/routes'
import { anonymousMode } from './lib/anonymity'
import { ensureProfileAfterAuth, signInWithGoogle } from './lib/googleAuth'
import { sendLive } from './lib/liveBus'
import type { LiveEvent } from './lib/liveBus'
import { moderatePublicSignalText } from './lib/signalModeration'

const FeedScreen = lazy(() => import('./FeedScreen'))
const RoomsScreenComponent = lazy(() => import('./components/RoomsScreen'))
const UnsentRoom = lazy(() => import('./components/UnsentRoom'))
const SignalChainsScreen = lazy(() => import('./components/SignalChainsScreen'))

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
  chains: 'Signal Chains',
}
import './unsent-room.css'
import './rooms.css'
import './living-pages.css'
import './cinematic.css'

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = 'home' | 'signals' | 'drift' | 'rooms' | 'unsent' | 'capsules' | 'relics' | 'pod' | 'zones' | 'frequencies' | 'anomalies' | 'settings' | 'chains'
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
  /** emotional shelf this relic lives on */
  category: string
  /** the one-line answer to 'why did this become a relic' */
  whyRelic: string
  /** what a listener said about staying */
  stayQuote: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const signals: SignalThread[] = [
  { id: 's1', handle: 'anonymous_03:14', time: '3 min ago', content: 'still awake. the quiet feels different tonight. like something is about to remember itself.', mood: 'nocturne', resonance: 94, anonymous: true },
  { id: 's2', handle: 'signal_veil', time: '11 min ago', content: 'replaying that moment again. the part before everything shifted. i keep landing in the same second.', mood: 'drift', resonance: 87, anonymous: false },
  { id: 's3', handle: 'anonymous_fade', time: '22 min ago', content: 'found a pocket of warm static on the radio. there is something almost like a song inside it.', mood: 'static', resonance: 79, anonymous: true },
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

// a relic is a signal the network refused to forget — replayed, revisited,
// reacted to until deleting it stopped being an option
const relics: Relic[] = [
  { id: 'rl1', name: 'unlabeled tape, side B', type: 'found audio', rarity: 'mythic', resonance: 94, category: 'background comfort', description: 'a 40-second recording where a second voice hums along underneath. nobody has ever placed it.', whyRelic: 'people kept leaving it on while doing other things. it never got turned off.', stayQuote: 'i stayed through the whole thing.' },
  { id: 'rl2', name: 'heartbeat on the night bus', type: 'accidental recording', rarity: 'rare', resonance: 82, category: 'insomnia', description: "someone's heartbeat, taped through a coat pocket on a night bus. still keeps time.", whyRelic: 'insomniacs sync their breathing to it. replay counts spike between 2 and 4am.', stayQuote: 'this is the only thing that slows me down.' },
  { id: 'rl3', name: 'voicemail, number unknown', type: 'voicemail', rarity: 'forbidden', resonance: 67, category: 'deleted too late', description: 'a sealed voicemail that says one name, three times. the number was never registered.', whyRelic: 'it was deleted twice. both times, someone had already saved a copy.', stayQuote: 'the ending sounded real.' },
  { id: 'rl4', name: 'static that turns into a song', type: 'radio rip', rarity: 'unstable', resonance: 89, category: 'background comfort', description: 'radio static that turns into a tune if you stop trying to hear it.', whyRelic: 'nobody can explain it, so everybody replays it to check.', stayQuote: 'i heard it on the third listen and yelled.' },
  { id: 'rl5', name: 'half a confession', type: 'cut-off recording', rarity: 'unstable', resonance: 58, category: 'unfinished thought', description: 'half a confession, cut off exactly where it was about to matter.', whyRelic: 'everyone replays the same ten seconds, waiting for the sentence to finish.', stayQuote: 'this one hurt more in silence.' },
  { id: 'rl6', name: 'answering machine, 1999', type: 'saved messages', rarity: 'rare', resonance: 74, category: 'heartbreak', description: 'eleven saved messages from the same person, each one a little kinder than the last.', whyRelic: 'people listen to all eleven in order. nobody skips.', stayQuote: 'message 7 broke me.' },
  { id: 'rl7', name: 'the hold music', type: 'found audio', rarity: 'unstable', resonance: 63, category: 'background comfort', description: 'forty minutes of hold music with one cough at minute 22. people replay the cough.', whyRelic: 'a replay chain formed around minute 22 and never dissolved.', stayQuote: 'i waited the whole 40 minutes. worth it.' },
  { id: 'rl8', name: 'wind through a screen door', type: 'field recording', rarity: 'rare', resonance: 71, category: 'background comfort', description: "someone's whole summer, recorded by accident while the phone sat on a porch table.", whyRelic: 'listeners stay an average of 31 minutes. nothing happens. that\'s why.', stayQuote: 'this is what i miss and i was never there.' },
  { id: 'rl9', name: 'last bus announcement', type: 'field recording', rarity: 'mythic', resonance: 88, category: 'late night driving', description: 'the final stop being called on a route that was cancelled the next morning.', whyRelic: 'people who rode that route found it. then people who didn\'t.', stayQuote: 'i replayed this before getting out of the car.' },
  { id: 'rl10', name: 'sealed birthday tape', type: 'still sealed', rarity: 'forbidden', resonance: 79, category: 'almost sent', description: 'a tape labeled "for when you\'re 30" that nobody ever came back for.', whyRelic: 'nobody has ever heard it. it became a relic unopened.', stayQuote: 'i think about whoever it was for constantly.' },
]

const navItems: { id: Screen; label: string; glyph: string }[] = [
  { id: 'home', label: 'Observatory', glyph: '◉' },
  { id: 'signals', label: 'Signals', glyph: '∿' },
  { id: 'drift', label: 'Drift', glyph: '◌' },
  { id: 'rooms', label: 'Rooms', glyph: '▣' },
  { id: 'unsent', label: 'Unsent', glyph: '◎' },
  { id: 'chains', label: 'Chains', glyph: '∞' },
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
            anonymous: anonymousMode(),
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
  const liveActivity = humanizeActivity(ecosystemState.recentInteractions, 5).map(a => a.text)
  const activityLines = useMemo(
    () => {
      const base = liveActivity.length >= 2 ? [...liveActivity, ...livedInLines('home', 2)] : [...OBS_EVENTS, ...livedInLines('home', 3)]
      // after midnight the band reports different things
      return isDeepNight() ? [...DEEP_NIGHT_LINES.slice(0, 3), ...base] : base
    },
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

      <NocturneObservatory onTune={() => onNavigate?.('signals')} />

      <TonightsFrequency />

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

// the radar reads human moments, not room names
const DRIFT_SIGNAL_DEFS: Array<{ label: string; kind: 'voice' | 'whisper' | 'laugh' | 'static' | 'zone' | 'tone' }> = [
  { label: 'someone crying quietly', kind: 'whisper' },
  { label: 'driving with music loud', kind: 'zone' },
  { label: 'an unfinished sentence', kind: 'voice' },
  { label: 'silence, but nobody leaves', kind: 'static' },
  { label: 'everyone too tired to sleep', kind: 'whisper' },
  { label: 'arguing, softly', kind: 'static' },
  { label: 'someone replaying a memory', kind: 'voice' },
  { label: 'an unreleased song, looping', kind: 'tone' },
  { label: 'group laughing in the distance', kind: 'laugh' },
  { label: 'someone humming alone', kind: 'tone' },
  { label: 'talking about someone not there', kind: 'voice' },
  { label: 'nobody hanging up', kind: 'static' },
]

type DriftSignal = {
  id: string
  label: string
  kind: 'voice' | 'whisper' | 'laugh' | 'static' | 'zone' | 'tone'
  seed: number
  x: number
  y: number
  foggy: boolean
}

function buildDriftSignals(): DriftSignal[] {
  const day = Math.floor(Date.now() / 86400000)
  return Array.from({ length: 26 }, (_, i) => {
    const def = DRIFT_SIGNAL_DEFS[(i * 7 + day) % DRIFT_SIGNAL_DEFS.length]
    const seed = day * 13 + i * 31
    return {
      id: `ds-${i}`,
      label: def.label,
      kind: def.kind,
      seed: seed * 97 + 11,
      x: 6 + ((seed * 17) % 88),
      y: 8 + ((seed * 29) % 80),
      foggy: i % 6 === 4,
    }
  })
}

type DriftHotspot = { id: string; x: number; y: number; fragment: string }
const driftHotspots: DriftHotspot[] = [
  { id: 'h1', x: 58, y: 18, fragment: 'a looped breath, four seconds long, no owner' },
  { id: 'h2', x: 10, y: 56, fragment: 'coordinates for a room that closed years ago' },
  { id: 'h3', x: 90, y: 46, fragment: 'half a name, sung once, then static' },
]

const DRIFT_EVENTS = [
  'someone replayed this 11 times',
  '2 strangers stayed silent together for 14 minutes',
  'music leaking from the east current',
  'a signal resurfaced after disappearing',
  'someone drifted closer after hearing this',
  'nobody has spoken, but nobody left',
  'a late-night room suddenly went quiet',
  'a laugh carried further than it should',
] as const

function DriftScreen() {
  const { discoverDrift, unlockRelic } = useEcosystemState()
  const driftAudio = useGlobalAudio()
  const [signals, setSignals] = useState<DriftSignal[]>(() => buildDriftSignals())
  const [driftReactions, setDriftReactions] = useState<StoredReaction[]>([])
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({})
  const [found, setFound] = usePersistentState<string[]>('ecosphere:driftFound', [])
  const [ping, setPing] = useState<string | null>(null)
  const [drifting, setDrifting] = useState(false)
  const [quietMode, setQuietMode] = useState(false)
  const [muted, setMuted] = useState(false)
  const [chasedId, setChasedId] = useState<string | null>(null)
  const [stayedId, setStayedId] = useState<string | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [liveEvents, setLiveEvents] = useState<Array<{ id: number; text: string; x: number; y: number }>>([])
  const livePresence = useLivePresence()
  const carriersHere = livePresence.perPage['drift'] ?? 0
  const signalRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const fieldRef = useRef<HTMLDivElement>(null)
  const lastNearRef = useRef<string | null>(null)
  const lastSoundAtRef = useRef(0)
  const eventIdRef = useRef(0)

  // signals wander; the water never holds still
  useEffect(() => {
    const wander = () => {
      setOffsets(() => {
        const next: Record<string, { dx: number; dy: number }> = {}
        for (const sig of signals) {
          next[sig.id] = { dx: (Math.random() - 0.5) * 42, dy: (Math.random() - 0.5) * 30 }
        }
        return next
      })
    }
    wander()
    const t = window.setInterval(wander, 6500)
    return () => window.clearInterval(t)
  }, [signals])

  // live drift events surface somewhere on the water, then sink
  useEffect(() => {
    const spawn = () => {
      const id = ++eventIdRef.current
      setLiveEvents(prev => [...prev.slice(-2), {
        id,
        text: DRIFT_EVENTS[Math.floor(Math.random() * DRIFT_EVENTS.length)],
        x: 12 + Math.random() * 66,
        y: 10 + Math.random() * 74,
      }])
      window.setTimeout(() => setLiveEvents(prev => prev.filter(e => e.id !== id)), 8000)
    }
    spawn()
    const t = window.setInterval(spawn, 11000)
    return () => window.clearInterval(t)
  }, [])

  // the water is never silent unless you ask it to be
  useEffect(() => {
    if (muted || quietMode) return
    const KINDS: DriftSignal['kind'][] = ['voice', 'whisper', 'tone', 'static', 'laugh']
    const t = window.setInterval(() => {
      if (document.hidden) return
      void playChainBlend([{ kind: KINDS[Math.floor(Math.random() * KINDS.length)], seed: Math.floor(Math.random() * 9000), durationMs: 3400, volume: 0.06 }])
    }, 9500)
    return () => window.clearInterval(t)
  }, [muted, quietMode])

  useEffect(() => () => { stopChainPlayback(); stopPreviewBuffer() }, [])

  const say = (text: string) => {
    setPing(text)
    window.setTimeout(() => setPing(null), 4500)
  }

  // DRIFT MODE: hold the water and move — proximity drives clarity and audio
  const handleDriftMove = (event: React.PointerEvent) => {
    const field = fieldRef.current
    if (!field) return
    const fieldRect = field.getBoundingClientRect()
    setCursor({ x: ((event.clientX - fieldRect.left) / fieldRect.width) * 100, y: ((event.clientY - fieldRect.top) / fieldRect.height) * 100 })
    let closest: { sig: DriftSignal; d: number } | null = null
    for (const sig of signals) {
      const el = signalRefs.current.get(sig.id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const d = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2))
      el.style.setProperty('--prox', Math.max(0, 1 - d / 190).toFixed(2))
      if (!closest || d < closest.d) closest = { sig, d }
    }
    if (!drifting || muted || quietMode || !closest) return
    if (closest.d < 140) {
      const nowTs = Date.now()
      if (lastNearRef.current !== closest.sig.id && nowTs - lastSoundAtRef.current > 700) {
        lastNearRef.current = closest.sig.id
        lastSoundAtRef.current = nowTs
        void playChainBlend([{ kind: closest.sig.kind, seed: closest.sig.seed, durationMs: 4200, volume: 0.1 + Math.max(0, 1 - closest.d / 190) * 0.2 }])
      }
    } else if (closest.d > 210) {
      lastNearRef.current = null
    }
  }

  const overhear = (sig: DriftSignal) => {
    void playSample(driftAudio, { id: `overhear-${sig.id}`, label: `overhearing · ${sig.label}`, source: 'drift' }, sig.kind === 'zone' ? 'zone' : sig.kind, sig.seed, 5200)
    say(`overhearing ${sig.label} — from a distance. you never fully arrive.`)
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
    say('a stray voice fragment, still warm')
  }

  const releaseDriftReaction = (reaction: StoredReaction) => {
    setDriftReactions(prev => prev.filter(r => r.id !== reaction.id))
    void deleteReactionAudio(reaction.id)
    say('the fragment dissolved back into the fog')
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
        say(nothing[Math.floor(Math.random() * nothing.length)])
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
        say(line)
      } else if (roll < 0.94) {
        shards += 1
        if (shards >= 3) {
          unlockRelic('reassembled-shard', 'Reassembled Shard')
          say('third shard recovered · the pieces fused into a relic')
        } else {
          say(`a relic shard surfaced from the fog · ${shards}/3 collected`)
        }
      } else if (driftReactions.length > 0) {
        const r = driftReactions[Math.floor(Math.random() * driftReactions.length)]
        playDriftReaction(r)
        say('the scan locked onto a voice somebody released here')
      } else {
        discoverDrift(`scan-${Date.now()}`, 'a scan caught: a frequency that only exists tonight')
        say('a scan caught: a frequency that only exists tonight')
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
      unlockRelic('drift-cartographer', 'Drift Cartographer')
      say('all hidden traces recovered · the map trusts you now')
    } else {
      say(h.fragment)
    }
  }

  // dock actions
  const driftDeeper = () => {
    setSignals(prev => prev.map((sig, i) => ({ ...sig, x: 6 + ((sig.seed * (i + 3)) % 88), y: 8 + ((sig.seed * (i + 7)) % 80), foggy: Math.random() < 0.2 })))
    say('you sank a layer down. different voices at this depth.')
  }

  const chaseSignal = () => {
    const pool = signals.filter(sig => !sig.foggy)
    const target = pool[Math.floor(Date.now() / 1000) % Math.max(1, pool.length)] ?? signals[0]
    if (!target) return
    setChasedId(target.id)
    if (!muted && !quietMode) void playChainBlend([{ kind: target.kind, seed: target.seed, durationMs: 6000, volume: 0.3 }])
    say(`chasing ${target.label} — it got a little clearer.`)
  }

  const stayNearby = () => {
    if (!chasedId) { say('chase something first — then you can stay with it'); return }
    setStayedId(chasedId)
    say('staying nearby. it will not slip under the fog tonight.')
  }

  const throwVoice = () => {
    discoverDrift(`thrown-${Date.now()}`, 'you threw your voice into the water')
    say('your voice sank into the water — someone may drift through it')
  }

  const surface = () => {
    stopChainPlayback()
    stopPreviewBuffer()
    setChasedId(null)
    setDrifting(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    say('you surfaced. the radar keeps sweeping without you.')
  }

  return (
    <div className="screen drift-radar-screen">
      <div className="screen-header drift-radar-header">
        <div className="screen-kicker">DRIFT RADAR</div>
        <h2 className="screen-title">Frequency Finder</h2>
        <p className="screen-sub">hold the water and move. you're scanning live human moments from far away — you can overhear anything, and enter nothing.</p>
      </div>

      <div
        ref={fieldRef}
        className={`drift-ocean${scanning ? ' scanning' : ''}${drifting ? ' drifting' : ''}${quietMode ? ' quiet' : ''}`}
        onPointerDown={e => { setDrifting(true); handleDriftMove(e) }}
        onPointerUp={() => setDrifting(false)}
        onPointerCancel={() => setDrifting(false)}
        onPointerLeave={() => { setDrifting(false); setCursor(null) }}
        onPointerMove={handleDriftMove}
      >
        {/* background: the deep */}
        <div className="do-stars" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => (
            <b key={i} style={{ left: `${(i * 61 + 5) % 100}%`, top: `${(i * 41) % 92}%`, animationDelay: `${-(i * 0.8)}s` }} />
          ))}
        </div>
        <div className="do-aurora" aria-hidden="true" />
        <div className="do-fog do-fog-a" aria-hidden="true" />
        <div className="do-fog do-fog-b" aria-hidden="true" />
        <div className="do-giants" aria-hidden="true"><span /><span /></div>
        <div className="do-sonar" aria-hidden="true" />
        <div className="do-sonar do-sonar-b" aria-hidden="true" />

        {/* the cursor ripple while drifting */}
        {cursor && drifting && (
          <span className="do-cursor" aria-hidden="true" style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }} />
        )}

        {/* signals: live human moments */}
        {signals.map(sig => {
          const off = offsets[sig.id] ?? { dx: 0, dy: 0 }
          return (
            <button
              key={sig.id}
              type="button"
              ref={el => { if (el) signalRefs.current.set(sig.id, el); else signalRefs.current.delete(sig.id) }}
              className={`do-signal do-signal--${sig.kind}${sig.foggy && stayedId !== sig.id ? ' foggy' : ''}${chasedId === sig.id ? ' chased' : ''}`}
              style={{ left: `${sig.x}%`, top: `${sig.y}%`, transform: `translate(-50%, -50%) translate(${off.dx}px, ${off.dy}px)` } as CSSProperties}
              onClick={() => overhear(sig)}
            >
              <i className="do-signal-pulse" aria-hidden="true" />
              <span className="do-signal-label">{sig.label}</span>
            </button>
          )
        })}

        {/* hidden traces, kept from before */}
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

        {/* stray voices people released here */}
        {driftReactions.map((r, i) => (
          <div
            key={r.id}
            className="drift-voice-fragment"
            style={{ left: `${22 + i * 19}%`, top: `${14 + (i % 2) * 62}%`, '--frag-delay': `${i * 1.3}s` } as CSSProperties}
          >
            <button type="button" className="drift-voice-play" onClick={() => playDriftReaction(r)} aria-label="play a stray voice fragment">
              <span><i /><i /><i /><i /></span>
            </button>
            <button type="button" className="drift-voice-release" onClick={() => releaseDriftReaction(r)} aria-label="release this fragment">✕</button>
          </div>
        ))}

        {/* live events surfacing on the water */}
        {liveEvents.map(ev => (
          <span key={ev.id} className="do-event" style={{ left: `${ev.x}%`, top: `${ev.y}%` }}>{ev.text}</span>
        ))}

        {carriersHere > 1 && (
          <div className="do-carriers" aria-hidden="true">
            {Array.from({ length: Math.min(5, carriersHere - 1) }, (_, i) => (
              <span key={i} className="do-carrier-real" style={{ left: `${18 + (i * 31) % 64}%`, top: `${20 + (i * 43) % 58}%`, animationDelay: `${-(i * 7)}s` }} />
            ))}
          </div>
        )}
        <div className="do-hint">
          {drifting
            ? 'drifting…'
            : carriersHere > 1
              ? `${carriersHere - 1} real carrier${carriersHere === 2 ? '' : 's'} drifting this water with you · hold and move`
              : 'hold the water and move · tap a signal to overhear it'}
        </div>
      </div>

      {ping && <div className="lp-drift-ping" key={ping}>{ping}</div>}

      <footer className="drift-dock">
        <button type="button" onClick={driftDeeper}>↓ drift deeper</button>
        <button type="button" onClick={chaseSignal}>⌖ chase this signal</button>
        <button type="button" onClick={stayNearby}>◌ stay nearby</button>
        <button type="button" className={muted ? 'on' : ''} onClick={() => { setMuted(m => { if (!m) stopChainPlayback(); return !m }) }}>
          {muted ? '◉ unmute the water' : '○ mute nearby chatter'}
        </button>
        <button type="button" onClick={throwVoice}>● throw your voice into the water</button>
        <button type="button" className={quietMode ? 'on' : ''} onClick={() => { setQuietMode(q => { if (!q) stopChainPlayback(); return !q }) }}>
          {quietMode ? '∿ rejoin the noise' : '◌ listen quietly'}
        </button>
        <button type="button" onClick={surface}>↑ surface</button>
        <button
          type="button"
          className={`drift-scan-inline${scanning ? ' scanning' : ''}`}
          disabled={scanRemaining > 0 || scanning}
          onClick={scanField}
        >
          {scanning
            ? '⌖ scanning…'
            : scanRemaining > 0
              ? `⌖ recharging · ${Math.floor(scanRemaining / 60000)}:${String(Math.floor((scanRemaining % 60000) / 1000)).padStart(2, '0')}`
              : `⌖ scan the field${scanMeta.shards > 0 && scanMeta.shards < 3 ? ` · ${scanMeta.shards}/3 shards` : ''}`}
        </button>
      </footer>

      {found.length > 0 && (
        <div className="drift-recovered">
          {found.map(id => {
            const h = driftHotspots.find(x => x.id === id)
            return h ? <span key={h.id}>◈ {h.fragment}</span> : null
          })}
        </div>
      )}
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
  const dropAudio = useGlobalAudio()

  // limited-edition frequency drop: 24h window, then gone forever
  const [drop, setDrop] = useState(() => currentDrop())
  const [dropTick, setDropTick] = useState(() => Date.now())
  const [dropOpen, setDropOpen] = useState(() => { const d = currentDrop(); return d ? isDropOpened(d.id) : false })
  useEffect(() => {
    const t = window.setInterval(() => {
      const next = currentDrop()
      setDrop(next)
      setDropTick(Date.now())
      if (next && markDropSeen(next.id)) {
        pushLocalNotification('new_capsule', 'a rare frequency is forming — 24 hours only')
      }
    }, 60000)
    const first = currentDrop()
    if (first && markDropSeen(first.id)) {
      pushLocalNotification('new_capsule', 'a rare frequency is forming — 24 hours only')
    }
    return () => window.clearInterval(t)
  }, [])

  const openDrop = () => {
    if (!drop) return
    markDropOpened(drop.id)
    setDropOpen(true)
    recordCapsuleOpen(drop.id, drop.title)
    void playSample(dropAudio, { id: drop.id, label: `rare frequency · ${drop.title}`, source: 'capsules' }, drop.kind, drop.seed, 9000)
  }
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
      {/* preservation dust drifting up through the vault */}
      <div className="capsule-dust" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 83 + 7) % 100}%`,
              animationDuration: `${9 + (i % 5) * 3}s`,
              animationDelay: `${-(i * 1.7)}s`,
            }}
          />
        ))}
      </div>
      <div className="screen-header">
        <div className="screen-kicker">VOICE CAPSULES</div>
        <h2 className="screen-title">Capsules</h2>
        <p className="screen-sub">nothing here opens on demand. capsules run on their own clocks — come back when one is ready.</p>
      </div>
      <AmbientLine lines={useMemo(() => [...CAPSULE_EVENTS, ...livedInLines('capsules', 2)], [])} />

      {/* the time table: every clock this page runs, at a glance */}
      <div className="capsule-timetable" aria-label="Capsule clocks">
        <div className="capsule-clock">
          <em>rare frequency</em>
          <strong>{drop ? `closes in ${dropTimeLeft(drop, dropTick)}` : `forms in ${Math.max(1, Math.ceil((nextDropAt(dropTick) - dropTick) / 86400000))}d`}</strong>
        </div>
        <div className="capsule-clock">
          <em>unmarked capsule</em>
          <strong>{formed || openedCycle !== null ? 'formed — break it' : formingRemaining > 3600000 ? `ready in ${Math.ceil(formingRemaining / 3600000)}h` : `ready in ${Math.max(1, Math.ceil(formingRemaining / 60000))}m`}</strong>
        </div>
        <div className="capsule-clock">
          <em>ghost signal</em>
          <strong>rotates at midnight</strong>
        </div>
      </div>

      {drop && (
        <div className={`rare-drop glass${dropOpen ? ' rare-drop--open' : ''}`} role="region" aria-label="Rare frequency drop">
          <div className="rare-drop-head">
            <span className="rare-drop-kicker">RARE FREQUENCY · 24H ONLY</span>
            <span className="rare-drop-timer">dissolves in {dropTimeLeft(drop, dropTick)}</span>
          </div>
          <div className="rare-drop-title">{drop.title}</div>
          {dropOpen ? (
            <>
              <p className="rare-drop-line">{drop.line}</p>
              <button type="button" className="rare-drop-btn" onClick={openDrop}>↻ play it again while it lasts</button>
            </>
          ) : (
            <button type="button" className="rare-drop-btn rare-drop-btn--sealed" onClick={openDrop}>
              ◉ open it — after {dropTimeLeft(drop, dropTick)} it never exists again
            </button>
          )}
        </div>
      )}

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
  rl1: ['found on a tape with no label, side B', 'the second voice joins eight seconds in', 'whoever it is, they knew the song'],
  rl2: ['recorded through fabric — you can hear the coat', 'the bus stops twice. the heart never does', 'people sync their breathing to it without noticing'],
  rl3: ['the voicemail is 19 seconds long', 'same name, three times, calmer each time', 'the callback number connects to nothing'],
  rl4: ['sounds like static for the first minute', 'the tune is there if you stop hunting for it', 'nobody can whistle it back afterwards'],
  rl5: ['"okay so the truth is—" and then nothing', 'the cut is clean. deliberate, maybe', 'people finish the sentence differently every time'],
  rl6: ['message 1 is about a parking spot', 'message 7 is an apology that takes its time', 'message 11 just says "okay. goodnight."'],
  rl7: ['the cough is at 22:04 exactly', 'one person looped the cough for an hour', 'the song itself is nothing. the waiting is everything'],
  rl8: ['you can hear a screen door, ice in a glass, somebody laughing two rooms away', 'forty minutes, nothing happens, nobody wants it to', 'summer ends at minute 39 when someone says "it\'s late"'],
  rl9: ['"last stop. everybody out." then keys', 'the driver hums while closing up', 'the route number was retired the next day'],
  rl10: ['the label is handwriting, not print', 'still sealed. the shrink-wrap is original', 'whoever it was for turned 30 a long time ago'],
}

const relicShards: Record<string, string> = {
  rl1: 'hidden shard · the second voice is half a beat behind on purpose. it was harmonizing.',
  rl2: 'hidden shard · the heartbeat skips once, at the exact moment the bus doors open.',
  rl3: 'hidden shard · played backwards, the voicemail is the same name. it works in both directions.',
  rl4: 'hidden shard · under the static: four seconds of someone breathing, completely calm.',
  rl5: 'hidden shard · the confession resumes for one word at the very end. the word is "anyway."',
  rl6: 'hidden shard · message 12 exists. it was never saved, but the beep is on the tape.',
  rl7: 'hidden shard · right before the cough, someone exhales — they were there the whole time.',
  rl8: 'hidden shard · at minute 31, somebody very quietly says "remember this."',
  rl9: 'hidden shard · one passenger never got off. you can hear them decide not to.',
  rl10: 'hidden shard · the tape rattles. there is something small sealed inside the case with it.',
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
  rl6: ['message 7 lives in my head rent free', 'i called my mom after this one'],
  rl7: ['the cough?? hello??', 'i waited the whole 40 min. worth it'],
  rl8: ['this is what i miss and i was never there', 'left it on while cleaning. cried a little'],
  rl9: ['i ride that route. rode.', 'the keys at the end. man.'],
  rl10: ['DO NOT open this one', 'i think about whoever it was for constantly'],
}


// trace the relic: where it spread, deterministic per relic
const TRACE_ROOMS = ["Can't Sleep", '3am Thoughts', 'Missing Someone', 'Background Voices', 'Burned Out', 'Late Night Driving', 'Comfort Room', 'Overthinking Everything']
const TRACE_SPIKES = ['1:12am', '2:47am', '3:33am', '12:58am', '4:05am']

function relicTrace(r: Relic) {
  const seed = r.id.charCodeAt(2) * 53 + r.resonance
  const rooms = Array.from(new Set([0, 1, 2].map(i => TRACE_ROOMS[(seed * (i + 3) + i * 7) % TRACE_ROOMS.length])))
  return {
    rooms,
    spike: TRACE_SPIKES[seed % TRACE_SPIKES.length],
    chainLength: 4 + (seed % 9),
    returned: 2 + (seed % 5),
  }
}

// every relic is filed under an anonymous code, never a person
function relicAnonCode(r: Relic): string {
  const seed = r.id.charCodeAt(2) * 2654435761 + r.resonance * 97
  const hex = (n: number) => ((seed >> n) & 0xffff).toString(16).toUpperCase().padStart(4, '0')
  return `${hex(2)}-${hex(9)}`
}

// deterministic display stats: a relic carries its own legend
function relicLegend(r: Relic) {
  const seed = r.id.charCodeAt(2) * 97 + r.resonance * 3
  return {
    replays: `${(3 + (seed % 19)) + ((seed % 10) / 10)}k`,
    stayRate: 78 + (seed % 19),
    peak: TRACE_SPIKES[seed % TRACE_SPIKES.length],
    reactions: [
      { tag: 'felt that', n: 120 + (seed % 700) },
      { tag: 'same', n: 80 + (seed % 400) },
      { tag: 'late', n: 40 + (seed % 200) },
      { tag: 'replayed', n: 200 + (seed % 900) },
    ],
  }
}

// human history: what people actually did with this tape
function relicHistory(r: Relic): string {
  if (r.id === 'rl10') return 'nobody has opened this fully'
  const seed = r.id.charCodeAt(2) * 71 + r.resonance
  const lines = [
    `${8 + (seed % 19)} people stopped listening at the same sentence`,
    `someone replayed the ending ${9 + (seed % 21)} times`,
    `${2 + (seed % 4)} users archived this immediately`,
    `kept alive for ${3 + (seed % 9)} nights straight`,
    `resurfaced in Can't Sleep ${1 + (seed % 3)} times this week`,
    `last heard ${['4 minutes ago', 'an hour ago', 'tonight, twice', 'just now'][seed % 4]}`,
  ]
  return lines[seed % lines.length]
}

// status tags: emotional, not RPG inventory
function relicStatus(r: Relic): string {
  if (r.id === 'rl10') return 'sealed away'
  const seed = r.id.charCodeAt(2) * 41 + r.resonance * 7
  const tags = ['replayed constantly', 'nobody finished this', 'passed around', 'damaged audio', 'too personal', 'keeps resurfacing', 'recovered tonight']
  return tags[seed % tags.length]
}

// live archive activity: the page never goes quiet
const RELIC_LIVE_EVENTS = [
  'replay storm forming over the hold music',
  "resurfaced in Can't Sleep two minutes ago",
  'archived 211 times tonight',
  'a replay chain is spreading from minute 22',
  'listeners returning after 3 days away',
  'someone replayed the same relic 9 times in a row',
  'reaction cluster growing on answering machine, 1999',
  'someone stayed 31 minutes inside wind through a screen door',
]

// relics of tonight: signals currently becoming unforgettable
const FORMING_RELICS = [
  { id: 'fr1', title: 'a voicemail that starts with a long breath', heat: 'replay count climbing · 312 in the last hour', kind: 'voice' as const },
  { id: 'fr2', title: 'two people saying goodnight four different ways', heat: 'listeners staying unusually long', kind: 'whisper' as const },
  { id: 'fr3', title: 'a laugh that turns into the other thing', heat: 'replay chain detected · spreading', kind: 'static' as const },
  { id: 'fr4', title: 'the quiet after "anyway—"', heat: 'reactions surging · mostly "same"', kind: 'tone' as const },
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
  const relicAudio = useGlobalAudio()
  const [store, setStore] = usePersistentState<Record<string, RelicActivity>>('ecosphere:relicActivity', {})
  const [charge, setCharge] = useState<Record<string, number>>(() => Object.fromEntries(relics.map(r => [r.id, r.resonance])))
  const [shelfVisit, setShelfVisit] = usePersistentState<string>('ecosphere:relicShelfVisit', '')
  const [shelfNote, setShelfNote] = useState<string | null>(null)
  // your own post-its: one note per relic, screened like anything public
  const [myNotes, setMyNotes] = usePersistentState<Record<string, string>>('ecosphere:relicNotes', {})
  const [noteDraft, setNoteDraft] = useState('')

  const leaveNote = (id: string) => {
    const text = noteDraft.trim().slice(0, 60)
    if (!text) return
    if (moderatePublicSignalText(text).status === 'flagged') {
      setShelfNote('that one stays unsaid — the note never sticks')
      window.setTimeout(() => setShelfNote(null), 5000)
      setNoteDraft('')
      return
    }
    setMyNotes(prev => ({ ...prev, [id]: text }))
    setNoteDraft('')
    setShelfNote('your note is on the case now')
    window.setTimeout(() => setShelfNote(null), 4000)
  }

  // the handling ledger: how worn a relic is, who held it last
  const ledgerLine = (r: Relic, a: RelicActivity) => {
    const seed = r.id.charCodeAt(2) * 131 + r.resonance
    const count = 40 + (seed % 270) + a.replays
    const when = ['just now', '14 min ago', 'an hour ago', 'tonight', 'this evening'][seed % 5]
    return `handled ${count}× · last held ${a.replays > 0 ? 'by you' : when}`
  }

  // tonight's hero relic — the one the whole archive is gathered around
  const heroRelic = relics[dayOfYear() % relics.length]
  const heroLegend = relicLegend(heroRelic)
  const [storming, setStorming] = useState(false)

  const playHero = () => {
    void playSample(relicAudio, { id: `loan-${heroRelic.id}`, label: `relic · ${heroRelic.name}`, source: 'relics' }, 'static', heroRelic.resonance * 7, 6000)
    setStore(prev => ({ ...prev, [heroRelic.id]: { ...(prev[heroRelic.id] ?? { replays: 0, reactions: {}, saved: false }), replays: (prev[heroRelic.id]?.replays ?? 0) + 1 } }))
    unlockEcosystemRelic(heroRelic.id, heroRelic.name)
  }

  // live listener count on tonight's relic — it climbs while you watch
  const [heroListeners, setHeroListeners] = useState(() => 40 + (dayOfYear() * 7) % 60)
  useEffect(() => {
    const t = window.setInterval(() => {
      if (Math.random() < 0.5) setHeroListeners(n => n + 1)
    }, 7000)
    // real replays and storms move the counter the moment they happen
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<LiveEvent>).detail
      if (detail?.type === 'replay' || detail?.type === 'storm') setHeroListeners(n => n + 1)
    }
    window.addEventListener('ecosphere:live', onLive)
    return () => { window.clearInterval(t); window.removeEventListener('ecosphere:live', onLive) }
  }, [])

  // the shelf hums: a faint leak from somewhere every so often
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.hidden) return
      void playChainBlend([{ kind: 'static', seed: Math.floor(Math.random() * 5000), durationMs: 2800, volume: 0.045 }])
    }, 16000)
    return () => window.clearInterval(t)
  }, [])

  // hold a tape to hear it leak through the case
  const leakTimerRef = useRef(0)
  const leakedRef = useRef(false)
  const startLeak = (r: Relic) => {
    leakedRef.current = false
    leakTimerRef.current = window.setTimeout(() => {
      leakedRef.current = true
      void playChainBlend([
        { kind: 'static', seed: r.resonance * 31, durationMs: 2600, volume: 0.12 },
        { kind: 'voice', seed: r.resonance * 53 + 7, durationMs: 2400, volume: 0.1, delayMs: 250 },
      ])
      setShelfNote(`${r.name} — leaking through the case…`)
      window.setTimeout(() => setShelfNote(null), 3000)
    }, 380)
  }
  const cancelLeak = () => window.clearTimeout(leakTimerRef.current)
  const openScrap = (r: Relic) => {
    if (leakedRef.current) { leakedRef.current = false; return }
    setSelected(r)
  }

  const enterReplayStorm = () => {
    playHero()
    setStorming(true)
    sendLive({ type: 'storm', id: heroRelic.id })
    leaveTrace(`a replay storm formed around "${heroRelic.name}"`, 'relics')
    setShelfNote('you joined the replay storm — everyone is on the same ten seconds')
    window.setTimeout(() => setStorming(false), 9000)
    window.setTimeout(() => setShelfNote(null), 5000)
  }

  // live archive activity drifting across the page
  const [liveEvent, setLiveEvent] = useState<string | null>(null)
  useEffect(() => {
    let n = Math.floor(Math.random() * RELIC_LIVE_EVENTS.length)
    const show = () => {
      setLiveEvent(RELIC_LIVE_EVENTS[n % RELIC_LIVE_EVENTS.length])
      n += 1
      window.setTimeout(() => setLiveEvent(null), 7000)
    }
    show()
    const t = window.setInterval(show, 16000)
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<LiveEvent>).detail
      if (detail?.type === 'storm') {
        setLiveEvent('a replay storm just pulled someone in — live')
        window.setTimeout(() => setLiveEvent(null), 7000)
      }
    }
    window.addEventListener('ecosphere:live', onLive)
    return () => { window.clearInterval(t); window.removeEventListener('ecosphere:live', onLive) }
  }, [])

  // trace view inside the examine overlay
  const [tracing, setTracing] = useState(false)

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
    if (!selected) { setStage(0); setTracing(false); return }
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
      {/* archive dust hanging in the vault light */}
      <div className="capsule-dust" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 97 + 13) % 100}%`,
              animationDuration: `${10 + (i % 4) * 4}s`,
              animationDelay: `${-(i * 2.1)}s`,
            }}
          />
        ))}
      </div>
      <div className="screen-header">
        <div className="screen-kicker">SIGNAL RELICS</div>
        <h2 className="screen-title">Relics</h2>
        <p className="screen-sub">relics are voice moments the network refused to forget.</p>
      </div>
      <AmbientLine lines={useMemo(() => [...RELIC_EVENTS, ...livedInLines('relics', 3)], [])} />
      {shelfNote && <div className="lp-drift-ping" key={shelfNote}>{shelfNote}</div>}

      {liveEvent && (
        <div className="relic-live-event" key={liveEvent} role="status">
          <i aria-hidden="true" />
          {liveEvent}
        </div>
      )}

      {/* the board: everything pinned at once, nothing formal */}
      <div className="relic-board-top">
        <span className="relic-live-chip"><i aria-hidden="true" />LIVE ECHOES · {FORMING_RELICS.length - 1}</span>
        <button type="button" className={`relic-tunein${storming ? ' storming' : ''}`} onClick={playHero}>
          ((•)) TUNE IN — tonight everyone is on “{heroRelic.name}”
        </button>
      </div>

      <div className="relic-board">
        {/* RELIC OF THE NIGHT: one huge breathing cassette */}
        <button type="button" className={`relic-night scrap--${heroRelic.category.replace(/\s/g, '-')}`} onClick={() => setSelected(heroRelic)}
          onPointerDown={() => startLeak(heroRelic)} onPointerUp={cancelLeak} onPointerLeave={cancelLeak}
        >
          <span className="relic-night-kicker">RELIC OF THE NIGHT</span>
          <span className="relic-night-live"><i aria-hidden="true" />{heroListeners} people replayed this tonight</span>
          <span className={`relic-night-cassette${relicAudio.current?.id === `loan-${heroRelic.id}` && relicAudio.playing ? ' playing' : ''}`} aria-hidden="true">
            <i className="rnc-reel"><b /></i>
            <span className="rnc-window">
              {Array.from({ length: 15 }, (_, b) => (
                <b key={b} style={{ '--rht-h': `${20 + ((heroRelic.resonance * (b + 3) * 11) % 70)}%`, '--rht-d': `${(b % 6) * 0.12}s` } as CSSProperties} />
              ))}
            </span>
            <i className="rnc-reel rnc-reel-b"><b /></i>
          </span>
          <strong className="relic-night-name">{heroRelic.name}</strong>
          <span className="relic-night-why">{heroRelic.whyRelic}</span>
          <span className="relic-night-history">{relicHistory(heroRelic)} · {heroLegend.stayRate}% stayed until the end</span>
          <span className="relic-night-subs" aria-hidden="true">
            {(relicPostits[heroRelic.id] ?? []).map((note, ni) => (
              <em key={note} className={`rh-comment rh-comment-${ni}`}>{note}</em>
            ))}
          </span>
        </button>
        <span className="sticky sticky--pink" style={{ '--tilt': '-5deg' } as CSSProperties}>“{heroRelic.stayQuote}”</span>
        <button type="button" className="sticky sticky--cyan sticky--btn" style={{ '--tilt': '4deg' } as CSSProperties} onClick={enterReplayStorm}>
          ◉ enter the replay storm
        </button>

        {relics.filter(r => r.id !== heroRelic.id).map((r, i) => {
          const a = activityOf(r.id)
          const c = charge[r.id] ?? r.resonance
          const legend = relicLegend(r)
          return (
            <Fragment key={r.id}>
              <button
                type="button"
                className={`scrap scrap--${r.category.replace(/\s/g, '-')} scrap--size-${i % 3}${a.replays >= 3 ? ' awakened' : ''}${a.saved ? ' kept' : ''}${i % 5 === 2 ? ' scrap--stacked' : ''}${i % 7 === 3 ? ' scrap--burned' : ''}`}
                style={{ '--tilt': `${((i * 7) % 11) - 5}deg`, '--glow': (c / 100).toFixed(2) } as CSSProperties}
                onClick={() => openScrap(r)}
                onPointerDown={() => startLeak(r)}
                onPointerUp={cancelLeak}
                onPointerLeave={cancelLeak}
                title="hold to hear it leak · tap to take it down"
              >
                <span className="scrap-tape" aria-hidden="true">{`${(r.resonance % 12) + 1}/${(r.resonance % 27) + 1}`}</span>
                <span className="scrap-anon">ANON · {relicAnonCode(r)} <em className="scrap-status">{relicStatus(r)}</em></span>
                {i % 6 === 4 ? (
                  <strong className="scrap-name"><s>{r.type}</s> {r.name}</strong>
                ) : (
                  <strong className="scrap-name">{r.name}</strong>
                )}
                <span className="scrap-line">{r.description}</span>
                <span className="scrap-history">{relicHistory(r)}</span>
                <span className="scrap-wave" aria-hidden="true">
                  {Array.from({ length: 11 }, (_, b) => (
                    <b key={b} style={{ height: `${18 + ((r.resonance * (b + 2) * 13) % 72)}%` }} />
                  ))}
                </span>
                <span className="scrap-foot">{r.category} · {legend.replays} replays · {ledgerLine(r, a)}</span>
                {myNotes[r.id] && <span className="sticky sticky--mine sticky--on-scrap">{myNotes[r.id]}</span>}
                {c < 45 && <span className="scrap-unstable">tape thinning · come back tomorrow</span>}
              </button>
              {(relicPostits[r.id] ?? [])[i % 2] && (
                <span className={`sticky sticky--${['yellow', 'green', 'violet', 'pink'][i % 4]}${i % 8 === 5 ? ' sticky--falling' : ''}`} style={{ '--tilt': `${((i * 11) % 11) - 5}deg` } as CSSProperties}>
                  {(relicPostits[r.id] ?? [])[i % 2]}
                </span>
              )}
              {i % 4 === 1 && (
                <button
                  type="button"
                  className="sticky sticky--live"
                  style={{ '--tilt': `${((i * 13) % 7) - 3}deg` } as CSSProperties}
                  onClick={() => { const f = FORMING_RELICS[i % FORMING_RELICS.length]; void playSampleBuffer(f.kind, f.id.charCodeAt(2) * 211, 5000, 0.3); setShelfNote('you heard it before it became a relic'); window.setTimeout(() => setShelfNote(null), 4000) }}
                >
                  <i aria-hidden="true" />LIVE · {FORMING_RELICS[i % FORMING_RELICS.length].title}
                </button>
              )}
            </Fragment>
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
            <div className="lp-relic-scene-type">{selected.type} · ANON {relicAnonCode(selected)} · {Math.round(charge[selected.id] ?? selected.resonance)}% replay heat</div>
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
            {stage >= 3 && (charge[selected.id] ?? selected.resonance) < 60 && (
              <button
                type="button"
                className="relic-recover"
                onClick={() => {
                  void playChainBlend([{ kind: 'static', seed: selected.resonance * 17, durationMs: 1800, volume: 0.14 }, { kind: 'tone', seed: selected.resonance * 29, durationMs: 1600, volume: 0.12, delayMs: 600 }])
                  setCharge(prev => ({ ...prev, [selected.id]: Math.min(100, (prev[selected.id] ?? selected.resonance) + 22) }))
                  setShelfNote('missing section recovered — the tape breathes easier')
                  window.setTimeout(() => setShelfNote(null), 4000)
                }}
              >
                ⊕ recover missing section — the audio is damaged here
              </button>
            )}
            {stage >= 3 && (
              <button type="button" className="relic-trace-toggle" onClick={() => setTracing(t => !t)}>
                {tracing ? '◌ stop tracing' : '⌖ trace the relic'}
              </button>
            )}
            {stage >= 3 && tracing && (() => {
              const trace = relicTrace(selected)
              return (
                <div className="relic-trace-panel" aria-label="Where this relic spread">
                  <div className="rt-map" aria-hidden="true">
                    <svg viewBox="0 0 300 110" preserveAspectRatio="none">
                      <path className="rt-path" d={`M 18 88 C 70 ${20 + (selected.resonance % 40)}, 150 ${80 - (selected.resonance % 35)}, 282 ${24 + (selected.resonance % 30)}`} />
                      <circle className="rt-node" cx="18" cy="88" r="3.5" />
                      <circle className="rt-node rt-node--b" cx={70 + (selected.resonance % 60)} cy={50 + (selected.resonance % 24)} r="3" />
                      <circle className="rt-node rt-node--c" cx="282" cy={24 + (selected.resonance % 30)} r="3.5" />
                    </svg>
                    <span className="rt-orb rt-orb-a" />
                    <span className="rt-orb rt-orb-b" />
                  </div>
                  <ul className="rt-log">
                    <li>first replayed in <b>{trace.rooms[0]}</b></li>
                    {trace.rooms[1] && <li>spread to <b>{trace.rooms[1]}</b>{trace.rooms[2] ? <> · then <b>{trace.rooms[2]}</b></> : null}</li>}
                    <li>replay storm peaked at <b>{trace.spike}</b> · chain of {trace.chainLength}</li>
                    <li>{trace.returned} listeners came back days later for this exact tape</li>
                  </ul>
                </div>
              )
            })()}
            {stage >= 3 && (
              <>
                <div className="relic-wear" aria-label="Handling wear">
                  <span>handling wear · the tape thins a little every replay</span>
                  <div className="relic-wear-track"><i style={{ width: `${Math.min(40, selectedActivity.replays * 4) + 6}%` }} /></div>
                </div>
                <div className="relic-note-row">
                  {myNotes[selected.id] ? (
                    <p className="relic-note-mine">
                      your note is on the case: “{myNotes[selected.id]}”
                      <button type="button" onClick={() => setMyNotes(prev => { const next = { ...prev }; delete next[selected.id]; return next })}>peel it off</button>
                    </p>
                  ) : (
                    <>
                      <input
                        type="text"
                        maxLength={60}
                        placeholder="leave a note on the case…"
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') leaveNote(selected.id) }}
                      />
                      <button type="button" onClick={() => leaveNote(selected.id)}>stick it</button>
                    </>
                  )}
                </div>
              </>
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
  const [reopened, setReopened] = useState<DormantRoom | null>(null)
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
        setRecovered(r => {
          if (r.includes(zoneId)) return r
          const next = [...r, zoneId]
          // every third recovery shakes something solid loose: relic material
          if (next.length % 3 === 0) {
            unlockZoneRelic(`zone-relic-${zoneId}`, 'Recovered From a Dead Room')
            leaveTrace('something solid surfaced under the static — it went to the relics shelf', 'zones')
          }
          return next
        })
        saveToLibrary('drift', `zone-${zoneId}`, zoneFragments[zoneId] ?? 'recovered fragment')
        leaveTrace(`recovered: ${(zoneFragments[zoneId] ?? 'a fragment').slice(0, 50)}`, 'zones')
      }, 3200)
    }
  }

  const zoneAmbient = useMemo(() => [...ZONE_EVENTS, ...livedInLines('zones', 2)], [])

  if (reopened) {
    return (
      <div className="rooms-eco rooms-eco--inroom">
        <CarrierRoom
          frequency={{ label: reopened.label, hz: reopened.hz }}
          recovered={{ quietLabel: quietFor(reopened.quietMins) }}
          onLeave={() => setReopened(null)}
        />
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-kicker">DEAD ZONES</div>
        <h2 className="screen-title">Abandoned Rooms</h2>
        <p className="screen-sub">rooms that went quiet. listen in, recover what's left, bring them back.</p>
      </div>

      <DormantFrequencies onReopen={setReopened} />
      <AmbientLine lines={zoneAmbient} />
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
  /** emotional signal type: how it glows, moves, and sounds */
  tone: string
  /** tiny fragments this signal leaks as you pass */
  subtitles: string[]
  /** a line you cast into the sea yourself */
  mine?: boolean
  /** optimistic sync status for a freshly cast line */
  status?: 'casting' | 'drifting' | 'failed'
}

// every signal out here is a kind of human moment, not a frequency
const SEA_TONES: Array<{ id: string; kind: SeaBuoy['kind']; subtitles: string[] }> = [
  { id: 'music', kind: 'tone', subtitles: ['*someone humming quietly*', 'this song reminds me of her', '*muffled bassline through water*'] },
  { id: 'talk', kind: 'voice', subtitles: ['"you still there?"', '"wait that actually hurt"', '"no— go on"'] },
  { id: 'argument', kind: 'static', subtitles: ['"that\'s not what i meant"', '"can we not. tonight"', '*a pause that costs something*'] },
  { id: 'comfort', kind: 'whisper', subtitles: ['"it\'s okay. i\'m here"', '*long, easy silence*', '"you don\'t have to explain"'] },
  { id: 'driving', kind: 'zone', subtitles: ['*car sounds, wet road*', '"one more exit"', '*turn signal, left on forever*'] },
  { id: 'laughter', kind: 'laugh', subtitles: ['*laughter*', '"STOP— say it again"', '*someone wheezing, far away*'] },
  { id: 'songwriters', kind: 'tone', subtitles: ['*guitar, retuned twice*', '"play that part again"', '*the same four bars, better each time*'] },
  { id: 'insomnia', kind: 'voice', subtitles: ['"i never sent it"', '"why am i like this"', '"is anyone else up"'] },
  { id: 'abandoned', kind: 'static', subtitles: ['*static*', '*a signal left running*', '*nobody has been here for hours*'] },
]

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

function makeBuoy(id: number, night: boolean): SeaBuoy {
  const sources: SeaSource[] = ['unsent', 'reaction', 'deadzone', 'feed', 'room']
  const source = sources[id % sources.length]
  const pool = SEA_FRAGMENTS[source]
  const toneDef = SEA_TONES[(id * 5 + 2) % SEA_TONES.length]
  return {
    id,
    source,
    fragment: pool[(id * 7) % pool.length],
    kind: toneDef.kind,
    seed: id * 97 + 13,
    top: 10 + ((id * 31) % 74),
    duration: 34 + ((id * 13) % 34),
    delay: -((id * 9) % 44),
    fading: id % 5 === 2,
    deep: night && id % 7 === 5,
    tone: toneDef.id,
    subtitles: toneDef.subtitles,
  }
}

// lines you type drift as your own signals — kept on this device so they
// keep floating when you return, capped so the sea never fills with your voice
const SEA_LINES_KEY = 'ecosphere:seaLines'

function loadSeaLines(): string[] {
  try { return JSON.parse(window.localStorage.getItem(SEA_LINES_KEY) ?? '[]') } catch { return [] }
}
function storeSeaLine(text: string): void {
  try { window.localStorage.setItem(SEA_LINES_KEY, JSON.stringify([text, ...loadSeaLines().filter(l => l !== text)].slice(0, 12))) } catch { /* session only */ }
}

/** Count words the way a person would — used to keep cast lines short. */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Turn a typed line into a drifting signal of your own. */
function makeTypedBuoy(id: number, text: string): SeaBuoy {
  return {
    id,
    source: 'unsent',
    fragment: text,
    kind: 'voice',
    seed: (hashLine(text) % 9000) + 100,
    top: 14 + ((id * 23) % 66),
    duration: 38 + ((id * 17) % 30),
    delay: -((id * 13) % 40),
    fading: false,
    deep: false,
    tone: 'insomnia',
    subtitles: [text],
    mine: true,
    status: 'drifting',
  }
}

function hashLine(text: string): number {
  let h = 5
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 0x7fffffff
  return h
}

const SEA_STATUS_LINES = [
  'quiet music detected west',
  'strongest emotional pull northeast',
  '3 overlapping late-night conversations',
  'ocean current unstable tonight',
  'a laugh carrying further than it should',
]

function FrequenciesScreen() {
  const { ecosystemState, reactToSignal, saveToLibrary } = useEcosystemState()
  const night = (() => { const h = new Date().getHours(); return h >= 22 || h < 5 })()
  const [buoys, setBuoys] = useState<SeaBuoy[]>(() => {
    // a bigger sea — more room for many voices to drift at once
    const base = Array.from({ length: night ? 30 : 24 }, (_, i) => makeBuoy(i, night))
    const mine = loadSeaLines().map((text, i) => makeTypedBuoy(900 + i, text))
    return [...mine, ...base]
  })
  // your cast lines carry your sigil color; others drift in their own tones
  const [myColor, setMyColor] = useState('#ffd166')
  useEffect(() => {
    void getHzProfile(ecosystemState.userSignalIdentity ?? 'unclaimed').then(p => setMyColor(p.color))
  }, [ecosystemState.userSignalIdentity])
  // session cast count + live sync status for the pill
  const [castCount, setCastCount] = useState(0)
  const composerInputRef = useRef<HTMLInputElement>(null)
  const myBuoys = buoys.filter(b => b.mine)
  const castingNow = myBuoys.filter(b => b.status === 'casting').length
  // the composer: type a short line and it drifts into the sea
  const [composer, setComposer] = useState('')
  const composerWords = wordCount(composer)
  const composerReady = composerWords >= 5 && composerWords <= 7
  const [nearId, setNearId] = useState<number | null>(null)
  const [, setZoneIdx] = useState(() => Math.floor(Date.now() / 40000) % SEA_ZONES.length)
  const [tideIdx, setTideIdx] = useState(0)
  const [ping, setPing] = useState<string | null>(null)
  const [stabilized, setStabilized] = useState<number[]>([])
  const [orbOpen, setOrbOpen] = useState<number | null>(null)
  // things the sea carries past you — passive discovery, no action required
  const [driftwood, setDriftwood] = useState<{ id: number; text: string; top: number; seed: number } | null>(null)
  const seaOrbs = useMemo(() => [
    { presence: 'a quiet listener', replaying: 'still awake. the quiet feels different tonight.', cassette: 'unlabeled tape, side B', trace: 'drifting for 18 min · paused twice near you' },
    { presence: 'someone half asleep', replaying: 'i kept the voicemail. i know.', cassette: 'heartbeat on the night bus', trace: 'crossed your path 4 min ago' },
    { presence: 'a restless presence', replaying: '(laughing, far away)', cassette: 'static that turns into a song', trace: 'following the same current as you' },
    { presence: 'someone on a long drive', replaying: 'replaying the same memory again.', cassette: 'the hold music', trace: 'left a trail heading east' },
  ], [])
  const timersRef = useRef<number[]>([])

  // every 22-45s something floats past; tap it before it's gone
  useEffect(() => {
    let spawn = 0
    let clear = 0
    const DRIFTWOOD = [
      'half a voicemail, waterlogged',
      "someone's laugh, three currents over",
      'a hummed chorus nobody finished',
      'the quiet after a question',
      'forty seconds of rain from somewhere else',
      'a name, said once, carried far',
    ]
    const cycle = () => {
      spawn = window.setTimeout(() => {
        setDriftwood({ id: Date.now(), text: DRIFTWOOD[Math.floor(Math.random() * DRIFTWOOD.length)], top: 18 + Math.random() * 50, seed: Math.floor(Math.random() * 9000) })
        clear = window.setTimeout(() => setDriftwood(null), 14000)
        cycle()
      }, 22000 + Math.random() * 23000)
    }
    cycle()
    return () => { window.clearTimeout(spawn); window.clearTimeout(clear) }
  }, [])

  const catchDriftwood = () => {
    if (!driftwood) return
    void playSampleBuffer('whisper', driftwood.seed, 5000, 0.3)
    setPing(`caught: ${driftwood.text}`)
    leaveTrace(`caught in the sea: ${driftwood.text}`, 'frequencies')
    setDriftwood(null)
  }

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
      stopChainPlayback()
      cancelSpeech()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const say = (text: string) => {
    setPing(text)
    timersRef.current.push(window.setTimeout(() => setPing(null), 4000))
  }

  // drifting near a signal: it clarifies; drifting away: it fades back to sea.
  // your own cast lines actually read themselves aloud as you pass.
  const driftNear = (b: SeaBuoy) => {
    setNearId(b.id)
    if (b.mine && speechSupported()) {
      speakSignal(b.fragment, b.seed)
    } else {
      void playSampleBuffer(b.kind, b.seed, 7000, 0.3)
    }
  }

  const driftAway = () => {
    setNearId(null)
    stopPreviewBuffer()
    cancelSpeech()
  }

  const saveEcho = (b: SeaBuoy) => {
    saveToLibrary('drift', `sea-${b.id}`, `echo from the sea · "${b.fragment.slice(0, 36)}"`)
    say('echo saved · it will keep drifting with you')
  }

  const stabilize = (b: SeaBuoy) => {
    setStabilized(prev => [...prev, b.id])
    say('signal stabilized · it will not fade tonight')
  }

  const driftDeeper = () => {
    setZoneIdx(i => (i + 1) % SEA_ZONES.length)
    setBuoys(prev => prev.map(b => (stabilized.includes(b.id) ? b : makeBuoy(b.id + 100 + Math.floor(Math.random() * 50), night))))
    say('the water got deeper. different voices down here.')
  }

  const throwVoice = () => {
    reactToSignal('frequency-sea', 'released a signal into the sea')
    say('your voice sank into the water — someone may drift through it')
  }

  // cast a typed line into the sea: short, screened, rate-limited gently, then
  // shown immediately (optimistic) while it settles in the background
  const castLine = () => {
    const text = composer.trim().replace(/\s+/g, ' ')
    const words = wordCount(text)
    if (words < 5 || words > 7) { say('five to seven words — like a line you\'d actually say'); return }
    // AI audit before anything reaches the sea — nothing inappropriate drifts
    if (moderatePublicSignalText(text).status === 'flagged') { say('that one can\'t drift here. try it softer.'); return }
    const gate = castRateCheck()
    if (!gate.allowed) { say(gate.reason ?? 'give it a moment'); return }
    recordCast()

    const id = 900 + Date.now() % 100000
    const buoy: SeaBuoy = { ...makeTypedBuoy(id, text), status: 'casting' }
    setBuoys(prev => [buoy, ...prev].slice(0, 44))
    setComposer('')
    setCastCount(n => n + 1)
    // keep the composer ready — cast the next one without breaking the drift
    composerInputRef.current?.focus()

    // optimistic: it drifts right away, then settles once it's stored (and,
    // when a backend is on, once it's fanned out to everyone else)
    window.setTimeout(() => {
      storeSeaLine(text)
      reactToSignal('frequency-sea', `cast a line into the sea: "${text}"`)
      leaveTrace(`a line you cast is drifting in the sea: "${text}"`, 'frequencies')
      if (seaSyncEnabled) {
        void castToSea(text).then(ok => setBuoys(prev => prev.map(b => (b.id === id ? { ...b, status: ok ? 'drifting' : 'failed' } : b))))
      } else {
        setBuoys(prev => prev.map(b => (b.id === id ? { ...b, status: 'drifting' } : b)))
      }
    }, 600)
  }

  const retryCast = (b: SeaBuoy) => {
    setBuoys(prev => prev.map(x => (x.id === b.id ? { ...x, status: 'casting' } : x)))
    void castToSea(b.fragment).then(ok => setBuoys(prev => prev.map(x => (x.id === b.id ? { ...x, status: ok ? 'drifting' : 'failed' } : x))))
  }

  // others' cast lines drift in live (when a backend is configured)
  const seenSeaIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!seaSyncEnabled) return
    let cancelled = false
    const addLine = (row: SeaLineRow) => {
      if (cancelled || seenSeaIdsRef.current.has(row.id)) return
      seenSeaIdsRef.current.add(row.id)
      const buoy: SeaBuoy = { ...makeTypedBuoy(700000 + (hashLine(row.id) % 90000), row.text), mine: false, status: 'drifting' }
      setBuoys(prev => [buoy, ...prev].slice(0, 44))
    }
    void fetchSeaLines(8).then(rows => rows.slice().reverse().forEach(addLine))
    const unsub = subscribeSeaLines(addLine)
    return () => { cancelled = true; unsub() }
  }, [])

  const seaPresence = useLivePresence()
  const seaCarriers = seaPresence.perPage['frequencies'] ?? 0

  // something you released in the unsent room can resurface out here
  const [resurfaced, setResurfaced] = useState<{ label: string; blob: Blob } | null>(null)
  useEffect(() => {
    void listLocalRecordings().then(rows => {
      const yours = rows.filter(r => r.emotionalTag === 'signal' || r.emotionalTag === 'echo').sort((a, b) => b.createdAt - a.createdAt)
      if (yours.length > 0 && dayOfYear() % 2 === yours[0].createdAt % 2) {
        setResurfaced({ label: yours[0].label, blob: yours[0].blob })
      }
    })
  }, [])

  // proximity: signals get louder, clearer, bigger as you pass close
  const buoyRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const lastNearRef = useRef<number | null>(null)
  const lastSoundAtRef = useRef(0)
  const [muted, setMuted] = useState(false)
  const [chasedId, setChasedId] = useState<number | null>(null)

  const handleSeaPointer = (event: React.PointerEvent) => {
    let closest: { b: SeaBuoy; d: number } | null = null
    for (const b of buoys) {
      const el = buoyRefs.current.get(b.id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const d = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2))
      el.style.setProperty('--prox', Math.max(0, 1 - d / 180).toFixed(2))
      if (!closest || d < closest.d) closest = { b, d }
    }
    if (muted || !closest) return
    if (closest.d < 130) {
      const nowTs = Date.now()
      if (lastNearRef.current !== closest.b.id && nowTs - lastSoundAtRef.current > 750) {
        lastNearRef.current = closest.b.id
        lastSoundAtRef.current = nowTs
        void playChainBlend([{ kind: closest.b.kind, seed: closest.b.seed, durationMs: 4200, volume: 0.1 + Math.max(0, 1 - closest.d / 180) * 0.18 }])
      }
    } else if (closest.d > 200) {
      lastNearRef.current = null
    }
  }

  // the sea is never silent: a distant human moment every few seconds
  useEffect(() => {
    if (muted) return
    const KINDS: SeaBuoy['kind'][] = ['voice', 'whisper', 'tone', 'static', 'laugh']
    const t = window.setInterval(() => {
      if (document.hidden) return
      void playChainBlend([{ kind: KINDS[Math.floor(Math.random() * KINDS.length)], seed: Math.floor(Math.random() * 9000), durationMs: 3600, volume: 0.07 }])
    }, 9000)
    return () => window.clearInterval(t)
  }, [muted])

  const chaseSignal = () => {
    const candidates = buoys.filter(b => !b.fading)
    const target = candidates[Math.floor(Date.now() / 1000) % Math.max(1, candidates.length)] ?? buoys[0]
    if (!target) return
    setChasedId(target.id)
    if (!muted) void playChainBlend([{ kind: target.kind, seed: target.seed, durationMs: 6000, volume: 0.3 }])
    say('you turned toward it. it got a little clearer.')
  }

  const toggleMute = () => {
    setMuted(m => {
      if (!m) stopChainPlayback()
      return !m
    })
    setPing(null)
  }

  const surface = () => {
    stopChainPlayback()
    stopPreviewBuffer()
    setChasedId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    say('you surfaced. the sea keeps moving underneath.')
  }

  // the frequency finder: sweep the band, find tonight's four hidden stations
  const [dial, setDial] = useState(88)
  const [lockedStation, setLockedStation] = useState<string | null>(null)
  const [foundStations, setFoundStations] = useState<string[]>([])
  const stations = useMemo(() => {
    const d = dayOfYear()
    return [
      { at: 26 + ((d * 7) % 44), label: 'somebody humming over engine noise', kind: 'voice' as const },
      { at: 82 + ((d * 13) % 36), label: 'rain on a tent, two voices under it', kind: 'whisper' as const },
      { at: 128 + ((d * 29) % 30), label: 'a station that only plays the sea', kind: 'static' as const },
      { at: 168 + ((d * 11) % 26), label: 'numbers read slowly, then goodnight', kind: 'tone' as const },
    ]
  }, [])
  const lastSweepRef = useRef(0)
  const tune = (value: number) => {
    setDial(value)
    // audible sweep: static between stations, the station bleeding in as you near it
    if (!muted) {
      const nearest = stations.reduce(
        (best, s) => { const d = Math.abs(s.at - value); return d < best.d ? { kind: s.kind, at: s.at, d } : best },
        { kind: 'static' as SeaBuoy['kind'], at: value, d: Infinity },
      )
      const ts = Date.now()
      if (ts - lastSweepRef.current > 110) {
        lastSweepRef.current = ts
        if (nearest.d <= 6) void playSampleBuffer(nearest.kind, Math.round(nearest.at * 31), 520, 0.05 + (1 - nearest.d / 6) * 0.2)
        else void playSampleBuffer('static', Math.round(value * 7), 200, 0.05)
      }
    }
    const hit = stations.find(s => Math.abs(s.at - value) <= 2)
    if (hit && lockedStation !== hit.label) {
      setLockedStation(hit.label)
      setFoundStations(prev => (prev.includes(hit.label) ? prev : [...prev, hit.label]))
      void playSampleBuffer(hit.kind, Math.round(hit.at * 31), 6000, 0.32)
    } else if (!hit && lockedStation) {
      setLockedStation(null)
      stopPreviewBuffer()
    }
  }

  return (
    <div className={`sea-screen${night ? ' sea-screen--night' : ''}`}>
      <div className="sea-fog sea-fog-a" aria-hidden="true" />
      <div className="sea-fog sea-fog-b" aria-hidden="true" />
      <div className="sea-glow" aria-hidden="true" />
      <div className="sea-lightning" aria-hidden="true" />
      <div className="sea-waves" aria-hidden="true"><span /><span /><span /></div>
      <div className="sea-aurora" aria-hidden="true" />
      <div className="sea-stars" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <b key={i} style={{ left: `${(i * 67 + 3) % 100}%`, top: `${(i * 37) % 38}%`, animationDelay: `${-(i * 0.9)}s` } as CSSProperties} />
        ))}
      </div>
      <div className="sea-currents" aria-hidden="true"><span /><span /><span /></div>
      <div className="sea-giants" aria-hidden="true"><span /><span /><span /></div>
      <div className="sea-foreground" aria-hidden="true">
        <em style={{ top: '30%', animationDuration: '37s' }}>someone saved an echo near here</em>
        <em style={{ top: '64%', animationDuration: '49s', animationDelay: '-21s' }}>"play that part again" — drifting</em>
        <em style={{ top: '46%', animationDuration: '57s', animationDelay: '-9s' }}>a signal chain is leaking voices into this water</em>
      </div>
      <div className="sea-sonar" aria-hidden="true" />
      <div className="sea-glints" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${(i * 71 + 9) % 100}%`,
              top: `${30 + ((i * 47) % 60)}%`,
              animationDuration: `${2.4 + (i % 5) * 0.9}s`,
              animationDelay: `${-(i * 0.7)}s`,
            }}
          />
        ))}
      </div>

      <header className="sea-header">
        <span className="sea-kicker">FREQUENCY SEA</span>
        <h1 className="sea-zone">live emotional audio drifting nearby</h1>
        <p className="sea-purpose">move through distant voices without entering them. you don't join anything out here — you overhear it, pass through it, let it go.</p>
        <p className="sea-status" key={tideIdx} role="status">
          <i aria-hidden="true" />
          {seaCarriers > 1 && tideIdx % 2 === 1
            ? `${seaCarriers - 1} real listener${seaCarriers === 2 ? '' : 's'} floating here with you`
            : tideIdx % 3 === 0 ? `${buoys.length} drifting signals nearby` : SEA_STATUS_LINES[tideIdx % SEA_STATUS_LINES.length]}{night ? ' · night tide' : ''}
        </p>
      </header>

      {/* the frequency finder: an actual dial to sweep */}
      <div className="sea-tuner" role="group" aria-label="Frequency finder">
        <div className="sea-tuner-head">
          <span className="sea-tuner-kicker">FREQUENCY FINDER</span>
          <span className={`sea-tuner-lock${lockedStation ? ' on' : ''}`}>
            {lockedStation ? '◉ signal locked' : `sweeping · ${foundStations.length}/4 found tonight`}
          </span>
        </div>
        <div className="sea-tuner-band">
          <div className="sea-tuner-ticks" aria-hidden="true">
            {Array.from({ length: 25 }, (_, i) => <i key={i} className={i % 6 === 0 ? 'major' : ''} />)}
          </div>
          {stations.filter(s => foundStations.includes(s.label)).map(s => (
            <span key={s.label} className="sea-tuner-marker" style={{ left: `${((s.at - 20) / 180) * 100}%` }} aria-hidden="true" />
          ))}
          <div className="sea-tuner-needle" style={{ left: `${((dial - 20) / 180) * 100}%` }} aria-hidden="true" />
          <input
            type="range"
            min={20}
            max={200}
            step={0.5}
            value={dial}
            onChange={e => tune(Number(e.target.value))}
            aria-label="tune the band"
          />
        </div>
        <div className="sea-tuner-readout">
          <strong>{dial.toFixed(1)} Hz</strong>
          <em>{lockedStation ?? 'mostly static out here. four stations are hiding — sweep slowly.'}</em>
        </div>
      </div>

      {/* cast a line: type something short and let it drift into the water */}
      <div className="sea-composer" style={{ '--yours-color': myColor } as CSSProperties}>
        <div className="sea-composer-head">
          <span className="sea-composer-kicker">CAST A LINE</span>
          {castingNow > 0 ? (
            <span className="sea-cast-pill sea-cast-pill--syncing"><i aria-hidden="true" /> casting {castingNow} {castingNow === 1 ? 'line' : 'lines'}…</span>
          ) : castCount > 0 ? (
            <span className="sea-cast-pill sea-cast-pill--done">{castCount} of yours drifting tonight</span>
          ) : (
            <span className={`sea-composer-count${composerReady ? ' ready' : ''}`}>{composerWords}/5–7 words</span>
          )}
        </div>
        <div className="sea-composer-row">
          <input
            ref={composerInputRef}
            type="text"
            value={composer}
            maxLength={90}
            placeholder="five to seven words — like something you'd actually say at 3am"
            onChange={e => setComposer(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') castLine() }}
            aria-label="cast a short line into the sea"
          />
          <button type="button" className="sea-composer-send" disabled={!composerReady} onClick={castLine}>
            ● cast
          </button>
        </div>
        <p className="sea-composer-note">cast as many as you like — they drift off in your color. others pass through them the way you pass through theirs.</p>
      </div>

      <div className="sea-field sea-field--big" style={{ '--yours-color': myColor } as CSSProperties} onPointerMove={handleSeaPointer}>
        {resurfaced && (
          <button
            type="button"
            className="sea-buoy sea-buoy--yours"
            style={{ '--top': '38%', '--dur': '52s', '--delay': '-11s' } as CSSProperties}
            onClick={() => {
              void playChainBlend([{ blob: resurfaced.blob, volume: 0.4 }])
              say('something you never sent, still out here. it kept drifting.')
              leaveTrace(`your unsent signal "${resurfaced.label.slice(0, 36)}" resurfaced in the sea`, 'frequencies')
            }}
          >
            <span className="sea-buoy-light"><i /><i /><i /></span>
            <span className="sea-subtitle">*something you never sent, still out here*</span>
          </button>
        )}
        {driftwood && (
          <button
            type="button"
            className="sea-driftwood"
            key={driftwood.id}
            style={{ top: `${driftwood.top}%` } as CSSProperties}
            onClick={catchDriftwood}
          >
            ◌ {driftwood.text}
          </button>
        )}
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
              ref={el => { if (el) buoyRefs.current.set(b.id, el); else buoyRefs.current.delete(b.id) }}
              className={`sea-buoy sea-buoy--${b.source} sea-buoy--tone-${b.tone}${b.mine ? ' sea-buoy--yours' : ''}${b.status === 'casting' ? ' sea-buoy--casting' : ''}${near ? ' near' : ''}${chasedId === b.id ? ' chased' : ''}${b.fading && !isStable ? ' fading' : ''}${b.deep ? ' deep' : ''}`}
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
              <span className="sea-subtitle" aria-hidden="true" key={(tideIdx + b.id) % b.subtitles.length}>
                {b.subtitles[(tideIdx + b.id) % b.subtitles.length]}
              </span>
              {b.mine && b.status === 'casting' && <span className="sea-cast-status sea-cast-status--casting">syncing…</span>}
              {b.mine && b.status === 'failed' && (
                <button type="button" className="sea-cast-status sea-cast-status--failed" onClick={() => retryCast(b)}>didn't catch · retry</button>
              )}
              {near && (
                <div className="sea-fragment">
                  <p>"{b.fragment}"</p>
                  <div className="sea-fragment-actions">
                    <button type="button" onClick={() => saveEcho(b)}>✶ save echo</button>
                    {b.fading && !isStable && (
                      <button type="button" onClick={() => stabilize(b)}>◌ stay nearby</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {ping && <div className="sea-ping" key={ping}>{ping}</div>}

      <footer className="sea-controls sea-dock">
        <span className="sea-floor-status">current pulling {['east', 'north', 'out', 'west'][tideIdx % 4]} · {listenerCount('sea', Math.floor(Date.now() / 60000))} others floating tonight</span>
        <div className="sea-dock-row">
          <button type="button" onClick={driftDeeper}>↓ drift deeper</button>
          <button type="button" onClick={chaseSignal}>⌖ chase this signal</button>
          <button type="button" className={muted ? 'sea-muted' : ''} onClick={toggleMute}>{muted ? '◉ unmute the water' : '◌ mute nearby chatter'}</button>
          <button type="button" onClick={throwVoice}>● throw your voice into the water</button>
          <button type="button" onClick={surface}>↑ surface</button>
        </div>
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
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const { ecosystemState, toggleLibraryFavorite, unsaveFromLibrary } = useEcosystemState()
  const podAudio = useGlobalAudio()
  const eco = ecosystemState
  const [podPulses, setPodPulses] = usePersistentState<number>('ecosphere:podPulses', 0)
  const [rippling, setRippling] = useState(false)

  const [podHz, setPodHz] = useState<HzProfile | null>(null)
  useEffect(() => {
    void getHzProfile(eco.userSignalIdentity ?? 'unclaimed').then(setPodHz)
  }, [eco.userSignalIdentity])

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
          <button
            type="button"
            className="pod-google-btn"
            disabled={googleBusy}
            onClick={() => {
              setGoogleBusy(true)
              setError(null)
              void signInWithGoogle().then(result => {
                if (!result.ok) {
                  setGoogleBusy(false)
                  setError(result.error)
                }
                // on success the browser is leaving for google — keep the busy state
              })
            }}
          >
            <span className="pod-google-mark" aria-hidden="true">G</span>
            {googleBusy ? 'opening google…' : 'Continue with Google'}
          </button>
          <p className="pod-google-note">your google email stays private — the band only ever sees your signal name.</p>
          <div className="pod-auth-divider" aria-hidden="true"><i />or<i /></div>
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
      <PodPresence
        energy={podEnergy}
        stage={podStage}
        rippling={rippling}
        streak={eco.streak.count}
        identity={eco.userSignalIdentity}
        hzColor={podHz?.color}
        onTouch={touchPod}
      />
      <ProfileHub onNavigate={screen => onNavigate?.(screen as Screen)} />
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
          {humanizeActivity(eco.recentInteractions, 8).map(activity => (
            <div key={activity.id} className="hub-activity-row glass">
              <span className="hub-activity-type" aria-hidden="true">·</span>
              <span className="hub-activity-label">{activity.text}</span>
              <span className="hub-activity-time">{lpTimeAgo(activity.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      <LiveTail page="pod" onNavigate={onNavigate} />
      <SignalToSelf accent={podHz?.color ?? '#66ccff'} />
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
  language: string
  /** 'auto' | 'mobile' | 'desktop' — like a browser's "request desktop site" */
  viewMode: string
  /** false = the five core destinations + search; true = every tab */
  fullNav: boolean
  signalVolume: number
  driftSensitivity: number
}

const defaultPrefs: EcoPrefs = { vibrate: true, anonymous: true, nightMode: false, lurker: false, uiSounds: true, privateProfile: false, language: 'auto', viewMode: 'auto', fullNav: false, signalVolume: 72, driftSensitivity: 60 }

function normalizeIdentity(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24)
}

// identities are 3-24 chars of [a-z0-9_], validated wherever they're set
function isValidIdentity(value: string) {
  return /^[a-z0-9_]{3,24}$/.test(value)
}

export function SettingsScreen() {
  const { ecosystemState } = useEcosystemState()
  const { tr } = useLocale()
  const [prefs, setPrefs] = usePersistentState<EcoPrefs>('ecosphere:settings', defaultPrefs)
  const [identityDraft, setIdentityDraft] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // signed-in (non-anonymous) session: email shown only HERE, never publicly
  const [sessionInfo, setSessionInfo] = useState<string | null>(null)
  useEffect(() => {
    const client = getOptionalSupabaseClient()
    if (!client) return
    void client.auth.getUser().then(({ data }) => {
      const u = data.user
      if (u && !u.is_anonymous) setSessionInfo(u.email ?? 'signed in')
    }).catch(() => { /* local-only */ })
  }, [])

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
    // every flip confirms itself — a toggle should never feel dead
    const confirmations: Partial<Record<keyof EcoPrefs, [string, string]>> = {
      vibrate: ['vibration on', 'vibration off'],
      anonymous: ['anonymous mode on', 'anonymous mode off'],
      nightMode: ['night protocol engaged', 'night protocol off'],
      lurker: ['lurker mode on — recorders resting', 'lurker mode off — voice restored'],
      uiSounds: ['interface sounds on', 'interface sounds muted'],
      fullNav: ['every tab visible', 'minimal drift nav — everything else lives in search (⌖ / ⌘K)'],
      privateProfile: ['profile hidden from the band', 'profile visible again'],
    }
    if ('viewMode' in patch) {
      showNote(patch.viewMode === 'mobile'
        ? 'mobile layout pinned — phone frame on any screen'
        : patch.viewMode === 'desktop'
          ? 'desktop layout requested — zoom out, full width'
          : 'layout back to automatic')
    }
    for (const key of Object.keys(patch) as Array<keyof EcoPrefs>) {
      // vibration silently does nothing on devices without the API (iPhones) —
      // say so instead of pretending it turned on
      if (key === 'vibrate' && patch.vibrate && !('vibrate' in navigator)) {
        showNote("saved — but this device doesn't support vibration")
        continue
      }
      const pair = confirmations[key]
      if (pair) showNote(patch[key] ? pair[0] : pair[1])
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
      window.localStorage.removeItem('ecosphere:tourDone')
      window.localStorage.removeItem('ecosphere:rulesAccepted')
      window.localStorage.removeItem('ecosphere:firstSignalDone')
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
        <h2 className="screen-title">{tr('settings.title')}</h2>
        <p className="screen-sub">{tr('settings.subtitle')}</p>
      </div>

      <div className="settings-list">
        <div className="setting-row glass setting-row--identity">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.identity')}</div>
            <div className="setting-detail">{ecosystemState.userSignalIdentity ?? 'unclaimed frequency'}</div>
          </div>
          <div className="setting-identity-edit">
            <input
              type="text"
              value={identityDraft}
              placeholder={tr('settings.identity.placeholder')}
              onChange={e => setIdentityDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') renameIdentity() }}
            />
            <button type="button" disabled={!isValidIdentity(normalizeIdentity(identityDraft))} onClick={renameIdentity}>{tr('settings.identity.action')}</button>
          </div>
        </div>

        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.anonymous')}</div>
            <div className="setting-detail">{tr('settings.anonymous.detail')}</div>
          </div>
          <button className={`toggle ${prefs.anonymous ? 'on' : ''}`} onClick={() => update({ anonymous: !prefs.anonymous })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.vibrate')}</div>
            <div className="setting-detail">{tr('settings.vibrate.detail')}</div>
          </div>
          <button className={`toggle ${prefs.vibrate ? 'on' : ''}`} onClick={() => update({ vibrate: !prefs.vibrate })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.night')}</div>
            <div className="setting-detail">{tr('settings.night.detail')}</div>
          </div>
          <button className={`toggle ${prefs.nightMode ? 'on' : ''}`} onClick={() => update({ nightMode: !prefs.nightMode })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.private')}</div>
            <div className="setting-detail">{tr('settings.private.detail')}</div>
          </div>
          <button className={`toggle ${prefs.privateProfile ? 'on' : ''}`} onClick={() => update({ privateProfile: !prefs.privateProfile })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.lurker')}</div>
            <div className="setting-detail">{tr('settings.lurker.detail')}</div>
          </div>
          <button className={`toggle ${prefs.lurker ? 'on' : ''}`} onClick={() => update({ lurker: !prefs.lurker })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.push')}</div>
            <div className="setting-detail">{tr('settings.push.detail')}</div>
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
            {pushBusy ? tr('settings.push.busy') : tr('settings.push.action')}
          </button>
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.language')}</div>
            <div className="setting-detail">{tr('settings.language.detail')}</div>
          </div>
          <select
            className="setting-select"
            value={prefs.language}
            onChange={e => update({ language: e.target.value })}
            aria-label={tr('settings.language')}
          >
            <option value="auto">{tr('settings.language.auto')}</option>
            {LOCALES.map(code => (
              <option key={code} value={code}>{LOCALE_NAMES[code]}</option>
            ))}
          </select>
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.view')}</div>
            <div className="setting-detail">{tr('settings.view.detail')}</div>
          </div>
          <select
            className="setting-select"
            value={prefs.viewMode}
            onChange={e => update({ viewMode: e.target.value })}
            aria-label={tr('settings.view')}
          >
            <option value="auto">{tr('settings.view.auto')}</option>
            <option value="mobile">{tr('settings.view.mobile')}</option>
            <option value="desktop">{tr('settings.view.desktop')}</option>
          </select>
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.fullNav')}</div>
            <div className="setting-detail">{tr('settings.fullNav.detail')}</div>
          </div>
          <button className={`toggle ${prefs.fullNav ? 'on' : ''}`} onClick={() => update({ fullNav: !prefs.fullNav })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.sounds')}</div>
            <div className="setting-detail">{tr('settings.sounds.detail')}</div>
          </div>
          <button className={`toggle ${prefs.uiSounds ? 'on' : ''}`} onClick={() => update({ uiSounds: !prefs.uiSounds })} />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.volume')}</div>
            <div className="setting-detail">{prefs.signalVolume}% — {tr('settings.volume.detail')}</div>
          </div>
          <input type="range" min={0} max={100} value={prefs.signalVolume} onChange={e => update({ signalVolume: +e.target.value })} className="range-input" />
        </div>
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.driftSensitivity')}</div>
            <div className="setting-detail">{prefs.driftSensitivity}% — {tr('settings.driftSensitivity.detail')}</div>
          </div>
          <input type="range" min={0} max={100} value={prefs.driftSensitivity} onChange={e => update({ driftSensitivity: +e.target.value })} className="range-input" />
        </div>

        {sessionInfo && (
          <div className="setting-row glass">
            <div className="setting-info">
              <div className="setting-label">{tr('settings.session')}</div>
              <div className="setting-detail">{sessionInfo} — {tr('settings.session.detail')}</div>
            </div>
            <button
              type="button"
              className="setting-action"
              onClick={() => {
                const client = getOptionalSupabaseClient()
                if (!client) return
                void client.auth.signOut().then(() => window.location.reload())
              }}
            >
              {tr('settings.session.action')}
            </button>
          </div>
        )}
        <div className="setting-row glass">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.help')}</div>
            <div className="setting-detail">{tr('settings.help.detail')}</div>
          </div>
          <button type="button" className="setting-action" onClick={() => setHelpOpen(true)}>
            {tr('settings.help.action')}
          </button>
        </div>

        <div className="setting-row glass setting-row--danger">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.replayOnboarding')}</div>
            <div className="setting-detail">{tr('settings.replayOnboarding.detail')}</div>
          </div>
          <button type="button" className="setting-action" onClick={resetIntro}>{tr('settings.replayOnboarding.action')}</button>
        </div>
        {isSupabaseConfigured && (
          <div className="setting-row glass setting-row--danger">
            <div className="setting-info">
              <div className="setting-label">{tr('settings.eraseCloud')}</div>
              <div className="setting-detail">{tr('settings.eraseCloud.detail')}</div>
            </div>
            <button type="button" className={`setting-action setting-action--danger${confirmCloudWipe ? ' confirming' : ''}`} disabled={cloudWipeBusy} onClick={wipeCloudData}>
              {cloudWipeBusy ? '…' : confirmCloudWipe ? tr('settings.confirm') : tr('settings.eraseCloud.action')}
            </button>
          </div>
        )}
        <div className="setting-row glass setting-row--danger">
          <div className="setting-info">
            <div className="setting-label">{tr('settings.eraseLocal')}</div>
            <div className="setting-detail">{tr('settings.eraseLocal.detail')}</div>
          </div>
          <button type="button" className={`setting-action setting-action--danger${confirmWipe ? ' confirming' : ''}`} onClick={wipeLocalData}>
            {confirmWipe ? tr('settings.confirm') : tr('settings.eraseLocal.action')}
          </button>
        </div>
      </div>

      {note && <div className="setting-note">{note}</div>}

      {helpOpen && <HelpBot onClose={() => setHelpOpen(false)} />}

      <div className="settings-footer">
        <div className="settings-version">ecosphere v2.0 · signal observatory</div>
      </div>
    </div>
  )
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const CORE_NAV: Screen[] = ['pod', 'signals', 'frequencies', 'zones', 'relics']

function Nav({ active, onNav }: { active: Screen; onNav: (s: Screen) => void }) {
  const { recordingActive } = useRecordingSession()
  const { tr } = useLocale()
  const fullNav = useEcoPref('fullNav', false)
  const items = fullNav ? navItems : navItems.filter(item => CORE_NAV.includes(item.id))
  return (
    <nav className={`bottom-nav glass-nav${recordingActive ? ' nav--recording' : ''}${fullNav ? '' : ' bottom-nav--minimal'}`}>
      {!fullNav && (
        <button
          type="button"
          className="nav-item nav-item--search"
          disabled={recordingActive}
          title="search the band (⌘K)"
          onClick={() => window.dispatchEvent(new CustomEvent('ecosphere:search'))}
        >
          <span className="nav-glyph">⌖</span>
          <span className="nav-label">find</span>
        </button>
      )}
      {items.map(item => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          data-page={item.id}
          disabled={recordingActive}
          title={recordingActive ? 'finish recording first' : tr(`nav.${item.id}`)}
          onClick={() => {
            try {
              const raw = window.localStorage.getItem('ecosphere:settings')
              if ((!raw || JSON.parse(raw)?.vibrate) && 'vibrate' in navigator) navigator.vibrate(10)
            } catch { /* haptics unavailable */ }
            onNav(item.id)
          }}
        >
          <span className="nav-glyph">{item.glyph}</span>
          <span className="nav-label">{tr(`nav.${item.id}`)}</span>
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

  // 18+ gate: one-time, remembered on the device, shown before anything else
  const [ageOk, setAgeOk] = useState(ageConfirmed)

  // first-visit tour: one pass through what each page is for
  const [tourOpen, setTourOpen] = useState(() => {
    try { return window.localStorage.getItem('ecosphere:tourDone') !== 'yes' } catch { return false }
  })
  const finishTour = () => {
    try { window.localStorage.setItem('ecosphere:tourDone', 'yes') } catch { /* session only */ }
    setTourOpen(false)
  }

  // offline mode: register the cache worker once; banner while disconnected
  const [offline, setOffline] = useState(() => !navigator.onLine)
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => { /* cache is a bonus, not a requirement */ })
    }
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

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

  // google/oauth sign-in: busy + error surfaces for the whole flow
  const [authBusy, setAuthBusy] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getOptionalSupabaseClient()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser({ id: data.session.user.id, email: data.session.user.email })
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
      // a real (non-anonymous) sign-in just landed — build the hub, then route
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user && !session.user.is_anonymous) {
        const userId = session.user.id
        window.setTimeout(() => {
          setAuthBusy('signed in — connecting your hub…')
          void ensureProfileAfterAuth(userId).then(result => {
            setAuthBusy(null)
            if (result.status === 'failed') {
              setAuthError('signed in, but your hub could not be created — it will retry next visit')
              window.setTimeout(() => setAuthError(null), 7000)
              return
            }
            if (result.status === 'needs-claim') {
              // brand-new signal on a fresh device: the claim screen takes over
              window.location.reload()
              return
            }
            if (window.location.pathname !== SCREEN_PATHS.pod) navigate('pod')
          })
        }, 0)
      }
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignOut = async () => {
    const supabase = getOptionalSupabaseClient()
    if (supabase) await supabase.auth.signOut()
    setUser(null)
  }


  // nothing loads — no audio, no screens — until 18+ is confirmed
  if (!ageOk) return <AgeGate onConfirm={() => setAgeOk(true)} />

  const screenMap: Record<Screen, React.ReactNode> = {
    home: <HomeScreen onNavigate={navigate} />,
    signals: <FeedScreen />,
    drift: <DriftScreen />,
    rooms: <RoomsScreenComponent />,
    unsent: <UnsentRoom />,
    capsules: <CapsulesScreen />,
    chains: <SignalChainsScreen />,
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
      <SignalSearch onNavigate={page => navigate(page as Screen)} />
      <QuickCreate onNavigate={page => navigate(page as Screen)} />
      {authBusy && (
        <div className="auth-veil" role="status">
          <span className="auth-veil-spinner" aria-hidden="true" />
          {authBusy}
        </div>
      )}
      {authError && <div className="auth-veil auth-veil--error" role="alert">{authError}</div>}

      {tourOpen && <FirstTour onDone={finishTour} />}

      {liveEcho && (
        <div className="live-echo-chip" role="status">
          <span aria-hidden="true" />
          {liveEcho}
        </div>
      )}

      {offline && (
        <div className="live-echo-chip live-echo-chip--offline" role="status">
          <span aria-hidden="true" />
          you're disconnected · listening to memory cache
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
