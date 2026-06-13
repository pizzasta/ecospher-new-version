import { createVoiceRecorder } from '../lib/audioBudget'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { CSSProperties, MutableRefObject } from 'react'
import { playSampleBuffer, stopPreviewBuffer } from '../lib/sampleAudio'
import { useRecordingSession } from '../hooks/useRecordingSession'
import { useEcoPref } from '../hooks/useEcoPrefs'
import { temporalWindow } from '../lib/temporalWindow'
import { futureSignals } from '../lib/futureSignals'
import { usePredictiveText } from '../hooks/usePredictiveText'
import { moderatePublicSignalText } from '../lib/signalModeration'
import GroupConversations from './GroupConversations'
import CarrierRoom from './CarrierRoom'
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
  mine: boolean
}

interface VibeDef {
  glyph: string
  label: string
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

const ROOM_STATES: RoomStateName[] = [
  'quiet-bloom',
  'signal-storm',
  'dead-silence',
  'resonance-spike',
  'static-interference',
]

const WEATHER: Record<RoomStateName, string[]> = {
  'quiet-bloom': ['calm and cozy', 'soft voices', 'easy pace tonight'],
  'signal-storm': ['busy right now', 'everyone talking at once', 'a lot of energy in here'],
  'dead-silence': ['very quiet', 'mostly listeners', 'nobody talking yet'],
  'resonance-spike': ['great conversation going', 'people really vibing', 'this one got good'],
  'static-interference': ['a little chaotic', 'people coming and going', 'overlapping voices'],
}

const ACTIVITY_LABEL: Record<RoomStateName, string> = {
  'quiet-bloom': 'chill',
  'signal-storm': 'busy',
  'dead-silence': 'quiet',
  'resonance-spike': 'vibing',
  'static-interference': 'chaotic',
}

const STATE_GLYPH: Record<RoomStateName, string> = {
  'quiet-bloom': '✦',
  'signal-storm': '∿',
  'dead-silence': '◌',
  'resonance-spike': '◑',
  'static-interference': '⋯',
}


// reaction vibes: aimed at whoever's on the mic when someone is talking,
// otherwise they just land on the room
const VIBES: VibeDef[] = [
  { glyph: '❤️', label: 'felt that' },
  { glyph: '🔥', label: 'go off' },
  { glyph: '😭', label: 'too real' },
  { glyph: '💀', label: "i'm dead" },
  { glyph: '👏', label: 'say it' },
  { glyph: '✨', label: 'needed this' },
]

const NODE_FRAGMENTS = [
  'someone said the real thing here',
  'a story about their ex',
  'an unfinished song',
  'a 2am confession',
  'somebody laughing too hard',
  'advice that actually helped',
  'a long pause that meant something',
  'someone admitting they miss them',
  'the good part of the conversation',
]

const AMBIENT_WHISPERS = [
  'same honestly.',
  'felt that.',
  'ok that one was real.',
  'no because same.',
  'say more.',
  'we are all here.',
  'this room gets it.',
  'glad i stayed up.',
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
  const recordingSession = useRecordingSession()
  const lurker = useEcoPref('lurker', false)
  const energyRef = useRef(0)
  const [energy, setEnergy] = useState(0)
  const { listeners, resonance, state, weather } = useLiveRoomSim(room, energyRef)
  const [signals, setSignals] = useState<SignalDef[]>(room.signals)
  const [playback, setPlayback] = useState<{ id: string; elapsed: number; duration: number } | null>(null)
  const [whispers, setWhispers] = useState<FloatWhisper[]>([])
  const [whisperText, setWhisperText] = useState('')
  const whisperEcho = usePredictiveText(whisperText)
  const [pops, setPops] = useState<ReactionPop[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [recStatus, setRecStatus] = useState<'idle' | 'recording'>('idle')
  const [recElapsed, setRecElapsed] = useState(0)
  const recElapsedRef = useRef(0)
  const [touchedNode, setTouchedNode] = useState<number | null>(null)
  const [talkerTag, setTalkerTag] = useState<string | null>(null)
  const [liveVibes, setLiveVibes] = useState<Record<string, number>>({})
  const talkerRef = useRef<string | null>(null)
  const youVibesRef = useRef<Record<string, number>>({})
  talkerRef.current = talkerTag

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

  const spawnVibePop = useCallback((glyph: string, mine: boolean) => {
    const id = ++idRef.current
    setPops(prev => [...prev.slice(-11), { id, glyph, left: 12 + Math.random() * 76, mine }])
    window.setTimeout(() => setPops(prev => prev.filter(p => p.id !== id)), 1700)
  }, [])

  const addVibeTally = useCallback((glyph: string) => {
    setLiveVibes(prev => ({ ...prev, [glyph]: (prev[glyph] ?? 0) + 1 }))
    if (talkerRef.current === 'you') {
      youVibesRef.current[glyph] = (youVibesRef.current[glyph] ?? 0) + 1
    }
  }, [])

  // someone is usually on the mic: a carrier talks for a stretch, goes
  // quiet, someone else picks it up. recording puts you on the mic.
  useEffect(() => {
    if (recStatus === 'recording') {
      setTalkerTag('you')
      return () => setTalkerTag(null)
    }
    let alive = true
    let timer = 0
    const tags = carriers.slice(0, 3).map(c => c.tag)
    const goQuiet = () => {
      if (!alive) return
      setTalkerTag(null)
      timer = window.setTimeout(speak, 1800 + Math.random() * 4200)
    }
    const speak = () => {
      if (!alive) return
      setTalkerTag(tags[Math.floor(Math.random() * tags.length)])
      timer = window.setTimeout(goQuiet, 4500 + Math.random() * 6500)
    }
    timer = window.setTimeout(speak, 1200 + Math.random() * 2400)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [recStatus, room.id, carriers])

  // vibes belong to whoever's talking — tallies reset when the mic changes hands
  useEffect(() => {
    setLiveVibes({})
  }, [talkerTag])

  // the room reacts while someone (including you) is talking
  useEffect(() => {
    if (!talkerTag) return
    const t = window.setInterval(() => {
      if (Math.random() < 0.55) {
        const v = VIBES[Math.floor(Math.random() * VIBES.length)]
        spawnVibePop(v.glyph, false)
        addVibeTally(v.glyph)
      }
    }, 2600)
    return () => window.clearInterval(t)
  }, [talkerTag, spawnVibePop, addVibeTally])

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
    if (text && moderatePublicSignalText(text).status === 'flagged') {
      showNotice('that one stays unsaid. the room keeps drifting.')
      setWhisperText('')
      return
    }
    if (!text) return
    spawnWhisper(text, true)
    setWhisperText('')
    bumpEnergy(5)
  }

  const handleVibe = (vibe: VibeDef) => {
    spawnVibePop(vibe.glyph, true)
    if (talkerRef.current) addVibeTally(vibe.glyph)
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
      const rec = createVoiceRecorder(stream)
      rec.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const n = ++fragmentCountRef.current
        const dur = Math.max(1, Math.round(recElapsedRef.current))
        const stamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        // drift notes persist: kept on-device and mirrored to the backend with the room attached
        recordingSession.enqueueUpload({
          title: `drift note · ${room.name} · ${stamp}`,
          kind: 'drift_note',
          roomId: room.id,
          durationMs: dur * 1000,
          blob,
        })
        setSignals(sigs => [
          { id: `mine-${Date.now()}`, title: `your fragment ${n} — released ${stamp}`, duration: dur, url, mine: true },
          ...sigs,
        ])
        recElapsedRef.current = 0
        setRecElapsed(0)
        stream.getTracks().forEach(tr => tr.stop())
        streamRef.current = null
        recordingSession.setRecordingActive(false)
        spawnWhisper('a new fragment settles into the room', false)
        const gotVibes = Object.entries(youVibesRef.current)
        if (gotVibes.length > 0) {
          showNotice(`while you talked: ${gotVibes.map(([g, c]) => (c > 1 ? `${g} ×${c}` : g)).join('  ')}`)
        }
        bumpEnergy(10)
      }
      recorderRef.current = rec
      rec.start()
      recElapsedRef.current = 0
      setRecElapsed(0)
      youVibesRef.current = {}
      setRecStatus('recording')
      recordingSession.setRecordingActive(true)
    } catch {
      showNotice('the room couldn’t hear you — mic unavailable. it’s okay.')
      setRecStatus('idle')
      recordingSession.setRecordingActive(false)
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
          <span key={p.id} className={`eco-reaction-pop${p.mine ? ' eco-reaction-pop--mine' : ''}`} style={{ left: `${p.left}%` }}>
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
        <span className="eco-vital eco-vital--freq">{room.category}</span>
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

      {/* on the mic: live talkers + vibes aimed at them */}
      <div className="eco-mic-strip">
        <span className="eco-section-label">on the mic</span>
        <div className="eco-mic-row">
          {carriers.slice(0, 3).map(c => (
            <div key={c.id} className={`eco-mic-chip${talkerTag === c.tag ? ' eco-mic-chip--talking' : ''}`}>
              <span className="eco-mic-rings" aria-hidden="true"><i /><i /><i /></span>
              <span className="eco-mic-tag">{c.tag}</span>
              {talkerTag === c.tag && <em className="eco-mic-live">talking…</em>}
            </div>
          ))}
          <div className={`eco-mic-chip eco-mic-chip--you${talkerTag === 'you' ? ' eco-mic-chip--talking' : ''}`}>
            <span className="eco-mic-rings" aria-hidden="true"><i /><i /><i /></span>
            <span className="eco-mic-tag">you</span>
            {talkerTag === 'you' && <em className="eco-mic-live">talking…</em>}
          </div>
        </div>
        {talkerTag && Object.keys(liveVibes).length > 0 && (
          <div className="eco-mic-vibes" aria-live="polite">
            {Object.entries(liveVibes).map(([g, c]) => (
              <span key={g} className="eco-mic-vibe">{g}{c > 1 ? ` ×${c}` : ''}</span>
            ))}
          </div>
        )}
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
        <div className="eco-vibe-target" aria-live="polite">
          {talkerTag === 'you'
            ? "you're on the mic — the room is reacting"
            : talkerTag
              ? `${talkerTag} is talking — send a vibe`
              : 'nobody on the mic — vibe at the room'}
        </div>
        <div className="eco-dock-row eco-dock-row--reactions">
          {VIBES.map(v => (
            <button key={v.glyph} type="button" className="eco-vibe-btn" onClick={() => handleVibe(v)} title={v.label}>
              <span aria-hidden="true">{v.glyph}</span>
              <em>{v.label}</em>
            </button>
          ))}
        </div>
        <div className="eco-dock-row">
          <button
            type="button"
            className={`eco-record-btn ${recStatus === 'recording' ? 'eco-record-btn--live' : ''}`}
            disabled={lurker && recStatus !== 'recording'}
            title={lurker ? 'lurker mode on — just listening tonight' : undefined}
            onClick={recStatus === 'recording' ? stopRecording : startRecording}
          >
            {lurker && recStatus !== 'recording' ? '◌ just listening' : recStatus === 'recording' ? `releasing… ${recElapsed.toFixed(0)}s ◼` : '● leave a fragment'}
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
        {whisperEcho && (
          <button
            type="button"
            className="predictive-echo"
            title="Predictive Echo — finishes your thought"
            onClick={() => setWhisperText((whisperText + whisperEcho).slice(0, 70))}
          >
            <i aria-hidden="true">?</i>
            <span>{whisperText}<em>{whisperEcho}</em></span>
          </button>
        )}
      </div>

      {notice && <div className="eco-notice">{notice}</div>}
    </div>
  )
}

// ─── Main screen ───────────────────────────────────────────────
export default function RoomsScreen() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [carrierOpen, setCarrierOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [ambientOn, setAmbientOn] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const engineRef = useRef<AmbientEngine | null>(null)
  const driftTimerRef = useRef<number | null>(null)

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

  if (temporalOpen && temporal.phase === 'open') {
    return <TemporalRoomView minutesRemaining={temporal.minutesRemaining} onExit={() => setTemporalOpen(false)} />
  }

  if (carrierOpen) {
    return (
      <div className="rooms-eco rooms-eco--inroom">
        <CarrierRoom frequency={{ label: 'quiet hours', hz: '98.1' }} onLeave={() => setCarrierOpen(false)} />
      </div>
    )
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
          <span className="rooms-eco-kicker">live voice rooms</span>
          <h1 className="rooms-eco-title">rooms</h1>
          <p className="rooms-eco-sub">anonymous group calls. drop in, listen, talk, leave whenever.</p>
        </header>

        <GroupConversations />

        <button type="button" className="carrier-entry-card" onClick={() => setCarrierOpen(true)}>
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

        <footer className="rooms-eco-hint">
          <p>hover a room to hear it. people come and go all night.</p>
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

      <div className="rooms-eco-grid">
        {visible.map((room, i) => (
          <RoomCard key={room.id} room={room} index={ROOMS.indexOf(room)} tick={tick + i} onEnter={() => onEnter(room)} />
        ))}
      </div>
    </>
  )
}

// ─── Temporal Resonance ────────────────────────────────────────
// Only reachable between 3:33 and 3:43am. Signals are dated tomorrow and
// cannot be replied to — they haven't happened yet.
function TemporalRoomView({ minutesRemaining, onExit }: { minutesRemaining: number; onExit: () => void }) {
  const signals = useMemo(() => futureSignals(), [])

  return (
    <div className="rooms-eco rooms-eco--inroom temporal-room">
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
