import { useState, useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { playSampleBuffer, stopPreviewBuffer } from '../lib/sampleAudio'
import { temporalWindow } from '../lib/temporalWindow'
import { futureSignals } from '../lib/futureSignals'
import GroupConversations from './GroupConversations'
import CarrierRoom from './CarrierRoom'
import DormantFrequencies from './DormantFrequencies'
import RoomAtmosphere from './RoomAtmosphere'
import { quietFor } from '../lib/dormantRooms'
import type { DormantRoom } from '../lib/dormantRooms'
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

type RoomCategory = 'late night' | 'relationships' | 'stress & life' | 'comfort' | 'chaotic' | 'creative'

interface RoomDef {
  id: string
  name: string
  tagline: string
  category: RoomCategory
  topics: string[]
  accentRgb: string // "r,g,b"
  baseListeners: number
  baseSpeakers: number
  baseResonance: number
  initialState: RoomStateName
  audio: AudioProfile
  signals: SignalDef[]
  feed: string[]
}

// ─── Room directory: late-night voice spaces ──────────────────
const ROOM_CATEGORIES: RoomCategory[] = ['late night', 'relationships', 'stress & life', 'comfort', 'chaotic', 'creative']

const CATEGORY_META: Record<RoomCategory, { accentRgb: string; audio: AudioProfile; signalTitles: string[]; feed: string[] }> = {
  'late night': {
    accentRgb: '0,212,255',
    audio: { oscFreq: 54, detune: 7, filterFreq: 420, noiseLevel: 0.18 },
    signalTitles: ['a voice note from 3:12am', 'someone describing their ceiling', '40 seconds of rain outside a window', 'a half-asleep story that goes nowhere', 'two people not sleeping, together'],
    feed: ['someone joined quietly', "someone's been listening for an hour", 'a voice note got replayed', '2 people just joined', 'someone said goodnight but stayed'],
  },
  relationships: {
    accentRgb: '255,45,120',
    audio: { oscFreq: 60, detune: 9, filterFreq: 640, noiseLevel: 0.2 },
    signalTitles: ['a voice note about their ex', '30 seconds of almost texting them', 'the story of how they met', 'reading the last message out loud', 'someone practicing what to say'],
    feed: ['someone joined mid-story', 'a reply got replayed twice', 'someone needed to hear that', '3 people just joined', 'someone left to send the text'],
  },
  'stress & life': {
    accentRgb: '155,93,229',
    audio: { oscFreq: 48, detune: 6, filterFreq: 380, noiseLevel: 0.22 },
    signalTitles: ['a vent about today, uncut', 'someone sighing for 15 seconds', 'a pep talk that got real', 'the to-do list, read like a confession', 'quitting fantasies, narrated'],
    feed: ['someone joined after a long day', 'someone said \'same\' out loud', 'a vent got an echo', '2 people just joined', "someone's lurking and that's okay"],
  },
  comfort: {
    accentRgb: '134,239,172',
    audio: { oscFreq: 58, detune: 4, filterFreq: 520, noiseLevel: 0.12 },
    signalTitles: ['a soft check-in for whoever needs it', 'someone reading a nice comment aloud', 'a small win, told slowly', 'gentle advice nobody asked for', 'a thank-you to the room'],
    feed: ['someone joined and exhaled', 'a kind reply landed', 'someone stayed longer than planned', '2 people just joined', 'someone said it helped'],
  },
  chaotic: {
    accentRgb: '255,170,90',
    audio: { oscFreq: 72, detune: 14, filterFreq: 980, noiseLevel: 0.3 },
    signalTitles: ['a story with zero context', 'someone laughing too hard to finish', 'a take that should stay private', 'a dramatic reading of their own texts', 'the plan, explained badly'],
    feed: ['someone joined yelling (affectionately)', 'a story got replayed 3 times', 'someone cannot stop laughing', '4 people just joined', 'someone said \'wait what\''],
  },
  creative: {
    accentRgb: '192,132,252',
    audio: { oscFreq: 64, detune: 8, filterFreq: 760, noiseLevel: 0.16 },
    signalTitles: ['an unfinished chorus, first play', 'a beat looped four times', 'someone humming the missing part', 'a poem read too fast', 'the idea, pitched at 1am'],
    feed: ['someone shared a rough demo', 'a hook got replayed', 'someone asked to hear it again', '2 people just joined', 'feedback landed gently'],
  },
}

type RoomSeed = [RoomCategory, string, string, string[], number, number, RoomStateName]

const ROOM_DATA: RoomSeed[] = [
  ['late night', 'Can\'t Sleep', 'for everyone staring at the ceiling right now', ['sleep schedules that don\'t exist', 'random memories at 2am'], 48, 4, 'quiet-bloom'],
  ['late night', 'Still Awake', 'no reason to be up. here anyway', ['why we\'re all still up', 'what everyone\'s snacking on'], 36, 3, 'quiet-bloom'],
  ['late night', '3am Thoughts', 'the thoughts that only show up after midnight', ['things we\'d never say in daylight', 'weird realizations tonight'], 52, 5, 'resonance-spike'],
  ['late night', 'Late Night Driving', 'voices for the empty highway', ['where everyone\'s driving to', 'best songs for an empty road'], 29, 3, 'quiet-bloom'],
  ['late night', 'Background Voices', 'leave us on while you do something else', ['quiet room with background conversations', 'low-effort company'], 64, 2, 'dead-silence'],
  ['late night', 'Nobody\'s Sleeping', 'group insomnia. at least we\'re together', ['collective insomnia check-in', 'how many hours until alarm'], 41, 4, 'static-interference'],
  ['late night', 'Night Shift Workers', 'for everyone whose day starts at 10pm', ['break room talk', 'what normal people are doing right now'], 22, 3, 'quiet-bloom'],
  ['late night', 'Up Too Late Again', 'we said one more episode three hours ago', ['what we\'re watching instead of sleeping', 'tomorrow\'s regrets, tonight'], 33, 3, 'static-interference'],
  ['late night', 'Quiet Hours', 'barely talking. mostly just here', ['long pauses welcome', 'the occasional half-thought'], 18, 1, 'dead-silence'],
  ['relationships', 'Missing Someone', 'for whoever\'s on your mind right now', ['people we can\'t stop thinking about', 'voicemails we still keep'], 57, 5, 'resonance-spike'],
  ['relationships', 'Should I Text Them?', 'the group chat decides. don\'t do it alone', ['live drafting messages together', 'votes on whether to send it'], 73, 6, 'signal-storm'],
  ['relationships', 'Situationship Support Group', 'it\'s complicated. we get it', ['defining the relationship, badly', 'mixed signals decoded live'], 68, 6, 'signal-storm'],
  ['relationships', 'Thinking About My Ex', 'you\'re not the only one tonight', ['mostly people venting about exes', 'the ones that got away'], 61, 5, 'static-interference'],
  ['relationships', 'We Don\'t Talk Anymore', 'friendships and people that faded out', ['friends we lost without a fight', 'last conversations we remember'], 44, 4, 'quiet-bloom'],
  ['relationships', 'Post Argument', 'just had a fight. decompress here', ['cooling off out loud', 'what we wish we\'d said instead'], 38, 4, 'static-interference'],
  ['relationships', 'Long Distance', 'same call, different time zones', ['surviving the distance', 'countdown to the next visit'], 31, 3, 'quiet-bloom'],
  ['relationships', 'Crushing Hard', 'giggling about someone. no shame here', ['overanalyzing their last message', 'do they like me back, evidence thread'], 59, 5, 'resonance-spike'],
  ['relationships', 'Just Got Ghosted', 'they vanished. we\'re here', ['closure we\'re never getting', 'red flags we ignored'], 47, 4, 'static-interference'],
  ['stress & life', 'Burned Out', 'running on empty together', ['jobs that take everything', 'what rest even looks like'], 42, 4, 'dead-silence'],
  ['stress & life', 'Work Broke Me Today', 'clock out and let it out', ['venting about today\'s shift', 'worst meeting of the week'], 55, 5, 'signal-storm'],
  ['stress & life', 'Mentally Exhausted', 'no advice. just understanding', ['tired beyond sleep', 'saying it out loud helps'], 49, 4, 'quiet-bloom'],
  ['stress & life', 'Avoiding Responsibilities', 'the to-do list can wait. we\'re here', ['what we\'re all avoiding right now', 'productive procrastination tips'], 66, 5, 'static-interference'],
  ['stress & life', 'Existing Only', 'minimum effort mode. doing our best', ['bare minimum check-in', 'small wins that count today'], 35, 3, 'dead-silence'],
  ['stress & life', 'Social Battery Dead', 'people who like people, from a distance', ['recovering from being perceived', 'introvert hangout, low volume'], 28, 2, 'quiet-bloom'],
  ['stress & life', 'Students Cramming', 'exam tomorrow. misery loves company', ['study sessions and panic', 'what we should have started last week'], 51, 4, 'signal-storm'],
  ['stress & life', 'Broke Until Friday', 'payday countdown support group', ['surviving until the deposit hits', 'cart abandoned, again'], 39, 4, 'static-interference'],
  ['stress & life', 'Overthinking Everything', 'replaying that one conversation again', ['the thing we said five years ago', 'spiraling, but together'], 58, 5, 'resonance-spike'],
  ['comfort', 'Soft Talking', 'low voices, easy pace, no pressure', ['whatever comes to mind, gently', 'stories told quietly'], 45, 3, 'quiet-bloom'],
  ['comfort', 'Good Energy Only', 'leave the bad day at the door', ['good things that happened today', 'hype for strangers'], 62, 5, 'resonance-spike'],
  ['comfort', 'Comfort Room', 'like a weighted blanket but it\'s voices', ['comfort shows and comfort food', 'being okay, slowly'], 53, 4, 'quiet-bloom'],
  ['comfort', 'Tiny Victories', 'got out of bed? that counts. tell us', ['small wins worth saying out loud', 'celebrating the little stuff'], 40, 4, 'resonance-spike'],
  ['comfort', 'Need Company', 'don\'t want to talk? just stay', ['people keeping each other company', 'presence over conversation'], 71, 3, 'quiet-bloom'],
  ['comfort', 'Real Conversations', 'no small talk. say the actual thing', ['what\'s actually going on with you', 'honest answers only'], 56, 6, 'resonance-spike'],
  ['comfort', 'Morning People', 'up early on purpose. coffee in hand', ['sunrise check-ins', 'today\'s plans, optimistic version'], 26, 3, 'quiet-bloom'],
  ['comfort', 'Slow Sunday Feeling', 'no plans, no rush, no guilt', ['doing nothing, professionally', 'soft weekend recaps'], 34, 3, 'dead-silence'],
  ['comfort', 'You\'re Doing Fine', 'reassurance on demand', ['proof that you\'re not behind in life', 'kind words from strangers'], 48, 4, 'quiet-bloom'],
  ['chaotic', 'Oversharing Hour', 'no context, no shame, full stories', ['stories with way too much detail', 'things we shouldn\'t admit, loudly'], 77, 7, 'signal-storm'],
  ['chaotic', 'Delusional Confidence', 'manifesting unrealistic outcomes together', ['plans with zero evidence they\'ll work', 'betting on ourselves, irresponsibly'], 63, 6, 'signal-storm'],
  ['chaotic', 'Hot Mess Club', 'everything\'s falling apart. it\'s fine', ['this week\'s disasters, ranked', 'laughing instead of coping'], 69, 6, 'static-interference'],
  ['chaotic', 'Fake Scenarios Again', 'rehearsing arguments that will never happen', ['shower arguments we always win', 'imaginary award speeches'], 54, 5, 'static-interference'],
  ['chaotic', 'Main Character Energy', 'the soundtrack is playing. act like it', ['main character moments of the day', 'dramatic exits we wish we\'d made'], 50, 5, 'resonance-spike'],
  ['chaotic', 'Bad Decisions Tonight', 'we already know. we\'re doing it anyway', ['choices our future selves will hate', 'live talking each other into it'], 72, 6, 'signal-storm'],
  ['chaotic', 'Unhinged Hour', 'logic left. vibes remain', ['takes that should stay private', 'energy with no explanation'], 65, 6, 'signal-storm'],
  ['chaotic', 'Conspiracy Corner', 'harmless theories, fully committed', ['why birds are suspicious actually', 'connecting dots that don\'t exist'], 43, 4, 'static-interference'],
  ['chaotic', 'Group Chat Energy', 'like the group chat but with voices', ['inside jokes forming in real time', 'roasting with love'], 60, 6, 'resonance-spike'],
  ['creative', 'Songwriters Awake', 'people sharing unfinished songs tonight', ['unfinished songs, brave first plays', 'one lyric that won\'t resolve'], 37, 4, 'quiet-bloom'],
  ['creative', 'Brain Dump', 'every idea, zero filter', ['ideas too raw for daylight', 'thinking out loud, messy version'], 46, 4, 'static-interference'],
  ['creative', 'Half Finished Ideas', 'the graveyard of almost-projects. revive one', ['projects at 60 percent forever', 'what we\'d finish with one free week'], 32, 3, 'quiet-bloom'],
  ['creative', 'Midnight Recording Booth', 'record something. play it for strangers', ['fresh recordings, instant feedback', 'first takes only'], 41, 4, 'resonance-spike'],
  ['creative', 'Artists Avoiding Sleep', 'one more layer, one more hour', ['what everyone\'s making right now', 'the piece that won\'t cooperate'], 38, 4, 'quiet-bloom'],
  ['creative', 'Creative Spiral', 'either a breakthrough or a breakdown', ['riding the 2am inspiration wave', 'is this genius or exhaustion'], 44, 5, 'signal-storm'],
  ['creative', 'Writers Block Support', 'the cursor is blinking. come hide', ['sentences we\'ve rewritten ten times', 'tricks that actually unstick you'], 27, 3, 'dead-silence'],
  ['creative', 'Beat Makers Lounge', 'loops, drums, and honest reactions', ['tonight\'s loops on repeat', 'drum patterns getting roasted gently'], 35, 4, 'resonance-spike'],
  ['creative', 'Show Your Demos', 'rough mixes welcome. be kind', ['demo swaps and feedback', 'the hook that almost works'], 30, 3, 'quiet-bloom'],
]

function makeRoom(seed: RoomSeed, index: number): RoomDef {
  const [category, name, tagline, topics, baseListeners, baseSpeakers, initialState] = seed
  const meta = CATEGORY_META[category]
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const titles = meta.signalTitles
  return {
    id,
    name,
    tagline,
    category,
    topics,
    accentRgb: meta.accentRgb,
    baseListeners,
    baseSpeakers,
    baseResonance: 38 + ((index * 7) % 47),
    initialState,
    audio: { ...meta.audio, oscFreq: meta.audio.oscFreq + (index % 5) * 3 },
    signals: [0, 1, 2].map(n => ({
      id: `${id}-${n}`,
      title: titles[(index + n) % titles.length],
      duration: 14 + ((index * 13 + n * 17) % 46),
    })),
    feed: meta.feed,
  }
}

const ROOMS: RoomDef[] = ROOM_DATA.map(makeRoom)

const ACTIVITY_LABEL: Record<RoomStateName, string> = {
  'quiet-bloom': 'chill',
  'signal-storm': 'busy',
  'dead-silence': 'quiet',
  'resonance-spike': 'vibing',
  'static-interference': 'chaotic',
}

// hover sound preview: shared AudioContext (unlocked by first tap anywhere),
// quiet, one at a time, mouse only
let hoverPreviewTimer: number | null = null

function startHoverPreview(seed: number) {
  stopHoverPreview()
  hoverPreviewTimer = window.setTimeout(() => {
    hoverPreviewTimer = null
    void playSampleBuffer('voice', seed, 5000, 0.22)
  }, 160)
}

function stopHoverPreview() {
  if (hoverPreviewTimer !== null) {
    window.clearTimeout(hoverPreviewTimer)
    hoverPreviewTimer = null
  }
  stopPreviewBuffer()
}

function wobble(seed: number, tick: number, range: number) {
  let x = seed * 374761393 + tick * 668265263
  x = (x ^ (x >> 13)) * 1274126177
  return Math.abs(x ^ (x >> 16)) % range
}

function RoomCard({ room, index, tick, onEnter }: { room: RoomDef; index: number; tick: number; onEnter: () => void }) {
  const state = room.initialState
  const listeners = Math.max(2, room.baseListeners + wobble(index + 1, tick, 9) - 4)
  const speakers = Math.max(state === 'dead-silence' ? 0 : 1, room.baseSpeakers + wobble(index + 7, tick, 3) - 1)
  const topic = room.topics[tick % room.topics.length]
  const previewSeed = index * 53 + 19

  return (
    <article
      className={`room-card eco-room-card room-state--${state}`}
      onClick={() => { stopHoverPreview(); onEnter() }}
      onPointerEnter={e => { if (e.pointerType === 'mouse') startHoverPreview(previewSeed) }}
      onPointerLeave={stopHoverPreview}
      style={{ '--room-accent-rgb': room.accentRgb } as CSSProperties}
    >
      <div className="eco-card-aura" aria-hidden="true" />
      <header className="eco-card-top">
        <span className="eco-card-livebadge"><i aria-hidden="true" />LIVE</span>
        <span className="eco-card-state">{ACTIVITY_LABEL[state]}</span>
      </header>
      <h3 className="room-name">{room.name}</h3>
      <p className="eco-card-tagline">{room.tagline}</p>
      <div className="eco-card-talk">talking about: {topic}</div>
      <div className="eco-card-wavebars" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <i
            key={i}
            style={{
              '--bh': `${25 + wobble(index * 31 + i, 0, 70)}%`,
              '--bd': `${(i % 7) * 0.09}s`,
            } as CSSProperties}
          />
        ))}
      </div>
      <footer className="eco-card-bottom">
        <span className="eco-card-listeners">
          <i className="eco-live-dot" aria-hidden="true" />
          {listeners} listening
        </span>
        <span className="eco-card-speakers">
          <span className="eco-speaking-dots" aria-hidden="true"><i /><i /><i /></span>
          {speakers === 0 ? 'nobody talking yet' : `${speakers} talking`}
        </span>
      </footer>
      <div className="eco-card-join">tap to join · leave whenever</div>
    </article>
  )
}


// ─── Main screen ───────────────────────────────────────────────
function roomHash(id: string): number {
  let h = 7
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 0x7fffffff
  return h
}

export default function RoomsScreen() {
  const [carrierRoom, setCarrierRoom] = useState<{ label: string; hz: string; seed: number } | null>(null)
  const [reopened, setReopened] = useState<DormantRoom | null>(null)
  const [pulling, setPulling] = useState(true)

  // pull the band on open — a short, responsive "tuning in" before the rooms land
  useEffect(() => {
    const t = window.setTimeout(() => setPulling(false), 480)
    return () => window.clearTimeout(t)
  }, [])

  // temporal resonance: the 3:33-3:43am window, re-checked every 30s
  // (set localStorage 'ecosphere:temporalOverride' = 'open' to preview)
  const [temporal, setTemporal] = useState(() => temporalWindow())
  const [temporalOpen, setTemporalOpen] = useState(false)
  useEffect(() => {
    const check = () => {
      let state = temporalWindow()
      try {
        if (window.localStorage.getItem('ecosphere:temporalOverride') === 'open') {
          state = { phase: 'open', minutesRemaining: 10, minutesUntilOpen: 0 }
        }
      } catch { /* storage unavailable */ }
      setTemporal(state)
      if (state.phase !== 'open') setTemporalOpen(false)
    }
    check()
    const t = window.setInterval(check, 30000)
    return () => window.clearInterval(t)
  }, [])

  // entering a room from the list opens the structured carrier view:
  // participants, the speaker queue, mute (self / others / room-wide), the live
  // waveform, and "drift away" — all seeded from the room.
  const handleEnter = (room: RoomDef) => {
    const seed = roomHash(room.id)
    setCarrierRoom({ label: room.name, hz: (80 + (seed % 1200) / 10).toFixed(1), seed })
  }

  if (temporalOpen && temporal.phase === 'open') {
    return <TemporalRoomView minutesRemaining={temporal.minutesRemaining} onExit={() => setTemporalOpen(false)} />
  }

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

  if (carrierRoom) {
    return (
      <div className="rooms-eco rooms-eco--inroom">
        <CarrierRoom
          key={carrierRoom.label}
          frequency={{ label: carrierRoom.label, hz: carrierRoom.hz }}
          seed={carrierRoom.seed}
          onLeave={() => setCarrierRoom(null)}
        />
      </div>
    )
  }

  return (
    <div className="rooms-eco">
      <RoomAtmosphere accent="#9b5de5" density="sparse" className="rooms-eco-atmosphere" />
      <div className="rooms-eco-shell">
        <header className="rooms-eco-header">
          <span className="rooms-eco-kicker">live voice rooms</span>
          <h1 className="rooms-eco-title">rooms</h1>
          <p className="rooms-eco-sub">anonymous frequencies — live ones to drop into, dead ones to recover. listen, talk, leave whenever.</p>
        </header>

        {pulling ? (
          <div className="rooms-pull" role="status">
            <div className="rooms-pull-wave" aria-hidden="true"><span /><span /><span /><span /><span /></div>
            <p>pulling open frequencies…</p>
          </div>
        ) : (
        <>
        <div className="rooms-section-label">ACTIVE FREQUENCIES</div>
        <GroupConversations />

        <button type="button" className="carrier-entry-card" onClick={() => setCarrierRoom({ label: 'quiet hours', hz: '98.1', seed: 7 })}>
          <span className="carrier-entry-glyph" aria-hidden="true">∿</span>
          <span className="carrier-entry-body">
            <strong>98.1 · quiet hours</strong>
            <em>one carrier at a time · take a turn or just drift</em>
          </span>
          <span className="carrier-entry-live">◉ open</span>
        </button>

        {temporal.phase !== 'closed' && (
          <button
            type="button"
            className={`temporal-room-card temporal-room-card--${temporal.phase}`}
            disabled={temporal.phase !== 'open'}
            onClick={() => { if (temporal.phase === 'open') setTemporalOpen(true) }}
          >
            <span className="temporal-room-glyph" aria-hidden="true">{temporal.phase === 'open' ? '◬' : '🔒'}</span>
            <span className="temporal-room-body">
              <strong>Temporal Resonance (future echoes)</strong>
              <em>
                {temporal.phase === 'open'
                  ? `open · closes in ${temporal.minutesRemaining} min`
                  : `forms at 3:33am · ${temporal.minutesUntilOpen} min`}
              </em>
            </span>
          </button>
        )}

        <RoomsDirectory onEnter={handleEnter} />

        <div className="rooms-section-label rooms-section-label--dead">DEAD ZONES · abandoned &amp; recoverable</div>
        <DormantFrequencies onReopen={setReopened} />
        </>
        )}

        <footer className="rooms-eco-hint">
          <p>hover a live room to hear it · reopen a dead one to bring it back. people come and go all night.</p>
        </footer>
      </div>
    </div>
  )
}

function RoomsDirectory({ onEnter }: { onEnter: (room: RoomDef) => void }) {
  const [category, setCategory] = useState<RoomCategory>('late night')
  const [tick, setTick] = useState(0)

  // one shared timer drives every card's counters and topics
  useEffect(() => {
    const t = window.setInterval(() => setTick(n => n + 1), 5000)
    return () => {
      window.clearInterval(t)
      stopHoverPreview()
    }
  }, [])

  const visible = useMemo(() => ROOMS.filter(r => r.category === category), [category])
  const joinFeed = CATEGORY_META[category].feed

  return (
    <>
      <nav className="rooms-cat-tabs" aria-label="Room categories">
        {ROOM_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            className={`rooms-cat-tab${category === cat ? ' active' : ''}`}
            onClick={() => { stopHoverPreview(); setCategory(cat) }}
          >
            {cat}
            <em>{ROOMS.filter(r => r.category === cat).length}</em>
          </button>
        ))}
      </nav>

      <div className="rooms-join-line" aria-live="polite">
        <i aria-hidden="true" />
        {joinFeed[tick % joinFeed.length]}
      </div>

      {visible.length === 0 ? (
        <div className="rooms-empty" role="status">
          <span className="rooms-empty-glyph" aria-hidden="true">◌</span>
          <p>the band is quiet on this frequency tonight.</p>
          <small>drift to another, or reopen a dead zone below.</small>
        </div>
      ) : (
        <div className="rooms-eco-grid">
          {visible.map((room, i) => (
            <RoomCard key={room.id} room={room} index={ROOMS.indexOf(room)} tick={tick + i} onEnter={() => onEnter(room)} />
          ))}
        </div>
      )}
    </>
  )
}

// ─── Temporal Resonance ────────────────────────────────────────
// Only reachable between 3:33 and 3:43am. Signals are dated tomorrow and
// cannot be replied to — they haven't happened yet.
const TEMPORAL_WHISPERS = [
  'you heard it first.',
  'this hasn\'t happened yet.',
  'tomorrow, already drifting.',
  'a signal out of order.',
] as const

function TemporalRoomView({ minutesRemaining, onExit }: { minutesRemaining: number; onExit: () => void }) {
  const signals = useMemo(() => futureSignals(), [])

  return (
    <div className="rooms-eco rooms-eco--inroom temporal-room">
      <RoomAtmosphere accent="#7af7ff" density="full" whisperLines={TEMPORAL_WHISPERS} className="temporal-atmosphere" />
      <div className="rooms-eco-inner">
        <header className="rooms-eco-head temporal-room-head">
          <h1 className="rooms-eco-title">temporal resonance</h1>
          <p className="rooms-eco-sub">future echoes · window closes in {minutesRemaining} min</p>
          <button type="button" className="temporal-room-exit" onClick={onExit}>
            ← back to now
          </button>
        </header>

        <div className="temporal-signal-list">
          {signals.map(signal => (
            <article key={signal.id} className={`temporal-signal temporal-signal--${signal.mood}`}>
              <div className="temporal-signal-meta">
                <span className="temporal-signal-handle">◈ {signal.handle}</span>
                <span className="temporal-signal-time">{signal.timeLabel}</span>
              </div>
              <p className="temporal-signal-content">{signal.content}</p>
              <div className="temporal-signal-wave" aria-hidden="true">
                {Array.from({ length: 18 }, (_, i) => (
                  <i key={i} style={{ height: `${22 + ((signal.waveformSeed * (i + 3)) % 58)}%` }} />
                ))}
              </div>
              <span className="temporal-signal-locked">replies disabled — this hasn't happened yet</span>
            </article>
          ))}
        </div>

        <footer className="rooms-eco-hint">
          <p>whatever you hear in here, you heard it first.</p>
        </footer>
      </div>
    </div>
  )
}
