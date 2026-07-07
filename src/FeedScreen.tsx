import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useEcosystemState } from './hooks/useEcosystemState'
import { useGlobalAudio } from './hooks/useGlobalAudio'
import VoiceReactionStack from './components/VoiceReactions'
import { HOOK_POOL, downloadBlob, exportFilename, renderStoryImage, renderStoryVideo } from './lib/storyExport'
import type { ExportScene } from './lib/storyExport'
import { playSample } from './lib/sampleAudio'
import { speakSignal, speechSupported, estimateSpeechMs } from './lib/speech'
import { listenerCount, livedInLines } from './lib/livedIn'
import { fetchPublicSignals, mirrorActivity, mirrorSignalFade, publishSignalToFeed, publishVoiceSignalToFeed, mirrorReaction } from './lib/backendBridge'
import { moderatePublicSignalText } from './lib/signalModeration'
import { GHOST_ARCHIVE } from './lib/ghostArchive'
import { getLocalHzProfile, hzForHandle } from './lib/hzSignature'
import HzBadge from './components/HzBadge'
import RelayButton from './components/RelayButton'
import ListenerTraces from './components/ListenerTraces'
import { RETURN_TAGS, addReturn, listReturns, removeReturn } from './lib/returnQueue'
import { DECAY_LABELS, decayLevel, decayText, heatFor, preserveSignal, presenceLine, whyFoundYou } from './lib/signalLife'
import FamiliarFrequency from './components/FamiliarFrequency'
import { recordCrossing } from './lib/familiarFrequency'
import { wordReactionsFor } from './lib/wordReactions'
import { MY_POSTS_KEY } from './lib/postRelics'
import { createVoiceRecorder, micErrorReason } from './lib/audioBudget'
import { saveRecordingLocally, listLocalRecordings } from './lib/localAudioStore'
import { publicHandle, anonymousMode } from './lib/anonymity'

const hiddenKey = 'ecosphere:hiddenSignals'
function loadHidden(): string[] {
  try { return JSON.parse(window.localStorage.getItem(hiddenKey) ?? '[]') } catch { return [] }
}
function storeHidden(ids: string[]) {
  try { window.localStorage.setItem(hiddenKey, JSON.stringify(ids.slice(0, 200))) } catch { /* session only */ }
}

// faded signals: chosen forgetting — gone from this user's memory forever
const fadedKey = 'ecosphere:fadedSignals'
function loadFaded(): string[] {
  try { return JSON.parse(window.localStorage.getItem(fadedKey) ?? '[]') } catch { return [] }
}
function storeFaded(ids: string[]) {
  try { window.localStorage.setItem(fadedKey, JSON.stringify(ids.slice(0, 500))) } catch { /* session only */ }
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SignalStatus = 'live' | 'fading' | 'drifting' | 'archiving' | 'corrupted' | 'resonating'
type SignalType = 'voice_note' | 'drifting_thought' | 'unresolved_echo' | 'static_bloom' | 'dead_zone' | 'memory_fragment' | 'nocturne_broadcast' | 'abandoned_carrier'
type Mood = 'nocturne' | 'bloom' | 'drift' | 'static' | 'lost'
type ExportType = 'tiktok' | 'story' | 'relic' | 'drift' | 'remix'

type FeedSignal = {
  id: string
  handle: string
  timeAgo: string
  content: string
  mood: Mood
  resonance: number
  anonymous: boolean
  duration: string
  type: SignalType
  status: SignalStatus
  emotionalBand: string
  waveformSeed: number
  typewriterEffect?: boolean
  expiresIn?: number
  mine?: boolean
  audioId?: string
  audioUrl?: string
  remote?: boolean
  postedAt?: number
}

// ─── Local feed posts (what you upload to the feed) ─────────────────────────
const myPostsKey = MY_POSTS_KEY
function loadMyPosts(): FeedSignal[] {
  try { return JSON.parse(window.localStorage.getItem(myPostsKey) ?? '[]') } catch { return [] }
}
function storeMyPost(sig: FeedSignal) {
  try {
    const next = [sig, ...loadMyPosts().filter(p => p.id !== sig.id)].slice(0, 50)
    window.localStorage.setItem(myPostsKey, JSON.stringify(next))
  } catch { /* session only */ }
}
// voice posts keep their audio in IndexedDB; fetch the blob on demand to play
async function postBlob(audioId: string): Promise<Blob | null> {
  try { return (await listLocalRecordings()).find(r => r.id === audioId)?.blob ?? null } catch { return null }
}
// derive a mood from what was written, so a post lands in the right band
function moodFromText(text: string): Mood {
  const t = text.toLowerCase()
  if (/\b(miss|gone|lost|alone|empty|ex|goodbye|cry)\b/.test(t)) return 'lost'
  if (/\b(thank|grateful|better|love|soft|warm|proud|nice)\b/.test(t)) return 'bloom'
  if (/\b(static|noise|radio|signal|glitch|broken)\b/.test(t)) return 'static'
  if (/\b(night|3am|2am|sleep|awake|dark|moon|insomnia)\b/.test(t)) return 'nocturne'
  return 'drift'
}

type EcosystemEvent = {
  id: string
  message: string
  visible: boolean
}

type Particle = {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  speedX: number
  speedY: number
  color: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FEED_SIGNALS: FeedSignal[] = [
  { id: 'f1', handle: 'anonymous_03:14', timeAgo: '2m ago', content: 'still awake. the quiet feels different tonight. like something is about to remember itself.', mood: 'nocturne', resonance: 94, anonymous: true, duration: '0:38', type: 'nocturne_broadcast', status: 'resonating', emotionalBand: 'nocturne-depth', waveformSeed: 42, typewriterEffect: true },
  { id: 'f2', handle: 'signal_veil', timeAgo: 'currently resonating', content: 'replaying that moment again. the part before everything shifted. i keep landing in the same second.', mood: 'drift', resonance: 87, anonymous: false, duration: '1:04', type: 'unresolved_echo', status: 'live', emotionalBand: 'drift-loop', waveformSeed: 17 },
  { id: 'f3', handle: 'anonymous_fade', timeAgo: 'fading', content: 'found a pocket of warm static on the radio. there is something almost like a song inside it.', mood: 'static', resonance: 79, anonymous: true, duration: '0:22', type: 'static_bloom', status: 'fading', emotionalBand: 'static-warm', waveformSeed: 88, expiresIn: 180 },
  { id: 'f4', handle: 'lost_carrier_7', timeAgo: 'drifting', content: 'there are frequencies you only hear when no one else is listening. late night internet knows this.', mood: 'lost', resonance: 63, anonymous: false, duration: '0:51', type: 'abandoned_carrier', status: 'drifting', emotionalBand: 'lost-frequency', waveformSeed: 31 },
  { id: 'f5', handle: 'anonymous_0:48', timeAgo: 'archiving soon', content: 'the ecosystem held the channel open. like it was waiting.', mood: 'bloom', resonance: 91, anonymous: true, duration: '0:44', type: 'memory_fragment', status: 'archiving', emotionalBand: 'bloom-memory', waveformSeed: 65, expiresIn: 60, typewriterEffect: true },
  { id: 'f6', handle: 'echo_fragment_9', timeAgo: '14m ago', content: 'dead zone at the edge of the listening field. signal fragments still visible if you stay quiet.', mood: 'nocturne', resonance: 72, anonymous: true, duration: '0:29', type: 'dead_zone', status: 'drifting', emotionalBand: 'void-edge', waveformSeed: 53 },
  { id: 'f7', handle: 'drift_channel', timeAgo: '31m ago', content: 'something about 3am feels like the only honest hour. this is a voice note from inside that.', mood: 'drift', resonance: 85, anonymous: false, duration: '1:12', type: 'voice_note', status: 'live', emotionalBand: 'drift-honest', waveformSeed: 76 },
  { id: 'f8', handle: 'corrupted_band_∅', timeAgo: '???', content: '̸̱͊s̶̯͌ì̸̲g̶̞̓n̴̬͑a̸͔̔l̷͈̑ ̶̰͝d̵̗̿e̷͚͒g̶͈͑r̶̞͐a̵̰͋d̶͙̃e̵̘̚d̷̝̈́...̵͓̂ ̸̯͊c̸͔̅o̸̰͊r̵̮̒r̴̲̐u̷͓͐p̵͉͑t̵̹̄ī̷̬o̷̮̓n̵̟͊ ̴͔̇a̸̩͗c̶͓̅t̶̼͋ī̷̭v̴̙͑e̴̼̓', mood: 'static', resonance: 33, anonymous: true, duration: '0:07', type: 'unresolved_echo', status: 'corrupted', emotionalBand: 'corrupted', waveformSeed: 99 },
]

// the ghost archive drifts in below the live signals, ten at a time
const GHOST_TYPE_BY_MOOD: Record<Mood, SignalType> = {
  nocturne: 'nocturne_broadcast',
  bloom: 'memory_fragment',
  drift: 'drifting_thought',
  static: 'static_bloom',
  lost: 'abandoned_carrier',
}

const GHOST_FEED: FeedSignal[] = GHOST_ARCHIVE.map((ghost, index) => ({
  id: ghost.id,
  handle: ghost.handle,
  timeAgo: ghost.timeAgo,
  content: ghost.content,
  mood: ghost.mood,
  resonance: ghost.resonance,
  anonymous: ghost.anonymous,
  duration: ghost.duration,
  type: GHOST_TYPE_BY_MOOD[ghost.mood],
  status: index % 4 === 1 ? 'resonating' : 'drifting',
  emotionalBand: `archive-${ghost.mood}`,
  waveformSeed: ghost.waveformSeed,
}))

const GHOST_PAGE_SIZE = 10

const ECOSYSTEM_EVENTS = [
  'a dormant carrier has returned',
  'quiet frequency spike detected',
  'multiple users replaying this signal',
  'ecosystem interference detected',
  'signal bloom opened nearby',
  'carrier wave collapsed and reformed',
  'deep frequency breach at 3:17am',
  'a memory fragment surfaced from archive',
  'new signal entering the drift field',
  'emotional resonance peak: nocturne band',
]

const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  voice_note: 'voice note',
  drifting_thought: 'drifting thought',
  unresolved_echo: 'unresolved echo',
  static_bloom: 'warm static',
  dead_zone: 'dead zone discovery',
  memory_fragment: 'memory fragment',
  nocturne_broadcast: 'nocturne broadcast',
  abandoned_carrier: 'abandoned carrier',
}

const MOOD_COLORS: Record<Mood, { primary: string; glow: string; dim: string }> = {
  nocturne: { primary: '#c084fc', glow: 'rgba(192,132,252,0.4)', dim: 'rgba(192,132,252,0.1)' },
  bloom:    { primary: '#f472b6', glow: 'rgba(244,114,182,0.4)', dim: 'rgba(244,114,182,0.1)' },
  drift:    { primary: '#22d3ee', glow: 'rgba(34,211,238,0.4)',  dim: 'rgba(34,211,238,0.1)'  },
  static:   { primary: '#a78bfa', glow: 'rgba(167,139,250,0.4)', dim: 'rgba(167,139,250,0.1)' },
  lost:     { primary: '#64748b', glow: 'rgba(100,116,139,0.4)', dim: 'rgba(100,116,139,0.1)' },
}

const STATUS_LABELS: Record<SignalStatus, string> = {
  live:       'currently resonating',
  fading:     'fading',
  drifting:   'drifting',
  archiving:  'archiving soon',
  corrupted:  'corrupted',
  resonating: 'resonating',
}
// ─── Waveform Generator ───────────────────────────────────────────────────────
function generateWaveform(seed: number, bars: number = 32): number[] {
  const waveform: number[] = []
  let s = seed
  for (let i = 0; i < bars; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const val = Math.abs(s) / 0x7fffffff
    // Create organic shape with peaks and valleys
    const shape = Math.sin(i * 0.4 + seed * 0.1) * 0.3 + 0.5
    waveform.push(Math.max(0.05, Math.min(1, val * shape + 0.1)))
  }
  return waveform
}

// ─── Particle System ──────────────────────────────────────────────────────────
function generateParticles(count: number = 40): Particle[] {
  const colors = ['#f472b6', '#22d3ee', '#c084fc', '#a78bfa', '#ffffff']
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.4 + 0.05,
    speedX: (Math.random() - 0.5) * 0.015,
    speedY: (Math.random() - 0.5) * 0.015 - 0.005,
    color: colors[Math.floor(Math.random() * colors.length)],
  }))
}

// ─── Typewriter Hook ──────────────────────────────────────────────────────────
function useTypewriter(text: string, enabled: boolean, speed: number = 28): string {
  const [displayed, setDisplayed] = useState(enabled ? '' : text)
  const [done, setDone] = useState(!enabled)
  useEffect(() => {
    if (!enabled || done) return
    if (displayed.length >= text.length) { setDone(true); return }
    const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), speed + Math.random() * 20)
    return () => clearTimeout(t)
  }, [displayed, text, enabled, done, speed])
  return displayed
}

function durationToMs(duration: string): number {
  const [m, sec] = duration.split(':').map(Number)
  const total = (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(sec) ? sec : 0)
  return Math.max(1500, total * 1000)
}

// ─── Waveform Card Component ──────────────────────────────────────────────────
function WaveformBar({ height, active, color, animated, index }: {
  height: number; active: boolean; color: string; animated: boolean; index: number
}) {
  const baseH = Math.round(height * 40) + 4
  const animClass = animated ? 'waveform-animate' : ''
  return (
    <div
      className={`waveform-bar ${animClass}`}
      style={{
        height: `${baseH}px`,
        width: '3px',
        borderRadius: '2px',
        backgroundColor: active ? color : `${color}55`,
        transition: 'height 0.3s ease, background-color 0.2s ease',
        animationDelay: `${index * 0.04}s`,
        flexShrink: 0,
      }}
    />
  )
}

// ─── Export Modal ─────────────────────────────────────────────────────────────
const EXPORT_SCENES: { id: ExportScene; label: string }[] = [
  { id: 'void', label: 'void' },
  { id: 'rain', label: 'rain on glass' },
  { id: 'street', label: 'dark street' },
  { id: 'room', label: 'dim room' },
]

function ExportModal({ signal, onClose }: { signal: FeedSignal; onClose: () => void }) {
  const [exporting, setExporting] = useState<ExportType | null>(null)
  const [done, setDone] = useState(false)
  const [exportError, setExportError] = useState(false)
  const [scene, setScene] = useState<ExportScene>('void')
  const [hookIndex, setHookIndex] = useState(() => signal.waveformSeed % (HOOK_POOL.length + 1))
  const colors = MOOD_COLORS[signal.mood]
  const waveform = generateWaveform(signal.waveformSeed, 20)
  const hook = hookIndex < HOOK_POOL.length ? HOOK_POOL[hookIndex] : null

  const handleExport = async (type: ExportType) => {
    setExporting(type)
    setExportError(false)
    const opts = {
      handle: signal.handle,
      caption: signal.content,
      duration: signal.duration,
      typeLabel: SIGNAL_TYPE_LABELS[signal.type],
      accentColor: colors.primary,
      waveformSeed: signal.waveformSeed,
      scene,
      hook: hook ?? undefined,
    }

    // vertical clip when the browser can record canvas; story card otherwise
    let kind: 'video' | 'image' = 'image'
    let blob: Blob | null = null
    if (type === 'tiktok' || type === 'story') {
      blob = await renderStoryVideo(opts, 4500)
      if (blob) kind = 'video'
    }
    if (!blob) blob = await renderStoryImage(opts)

    if (blob) {
      downloadBlob(blob, exportFilename(signal.handle, kind))
      setDone(true)
    } else {
      setExportError(true)
      setExporting(null)
    }
  }

  const exports: { type: ExportType; label: string; icon: string }[] = [
    { type: 'tiktok', label: 'Export to TikTok', icon: '▶' },
    { type: 'story',  label: 'Export as Story',  icon: '◎' },
    { type: 'relic',  label: 'Save to Relic',    icon: '◈' },
    { type: 'drift',  label: 'Drift Signal',      icon: '∿' },
    { type: 'remix',  label: 'Remix Frequency',   icon: '≋' },
  ]

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal" style={{ '--mood-glow': colors.glow, '--mood-color': colors.primary } as React.CSSProperties} onClick={e => e.stopPropagation()}>
        {!exporting ? (
          <>
            <div className="export-preview">
              <div className="export-tiktok-preview" style={{ background: `linear-gradient(180deg, #000 0%, ${colors.dim} 50%, #000 100%)` }}>
                <div className="export-preview-handle">@{signal.handle}</div>
                <div className="export-preview-waveform">
                  {waveform.map((h, i) => (
                    <div key={i} className="export-wave-bar" style={{ height: `${h * 50 + 4}px`, backgroundColor: colors.primary, opacity: 0.8 }} />
                  ))}
                </div>
                <div className="export-preview-text">{signal.content.substring(0, 60)}...</div>
                <div className="export-preview-band" style={{ color: colors.primary }}>{signal.emotionalBand}</div>
                <div className="export-ecosphere-watermark">◈ ecosphere</div>
              </div>
            </div>
            <div className="export-title">{exportError ? 'export failed — try again' : 'package this signal'}</div>
            <div className="export-buttons">
              <div className="export-vignette-controls">
              <div className="export-scene-row" role="radiogroup" aria-label="Backdrop scene">
                {EXPORT_SCENES.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={scene === option.id}
                    className={`export-scene-chip${scene === option.id ? ' active' : ''}`}
                    onClick={() => setScene(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="export-hook-row"
                title="cycle hook overlay"
                onClick={() => setHookIndex(i => (i + 1) % (HOOK_POOL.length + 1))}
              >
                <em>hook</em>
                <span>{hook ?? 'no hook overlay'}</span>
                <i aria-hidden="true">↻</i>
              </button>
            </div>
            {exports.map(ex => (
                <button key={ex.type} className="export-btn" style={{ '--btn-color': colors.primary } as React.CSSProperties} onClick={() => handleExport(ex.type)}>
                  <span className="export-btn-icon">{ex.icon}</span>
                  {ex.label}
                </button>
              ))}
            </div>
          </>
        ) : !done ? (
          <div className="export-loading">
            <div className="export-pulse" style={{ backgroundColor: colors.primary }} />
            <div className="export-loading-text">packaging signal</div>
            <div className="export-loading-sub" style={{ color: colors.primary }}>{exporting === 'tiktok' || exporting === 'story' ? 'rendering vertical clip…' : 'rendering story card…'}</div>
          </div>
        ) : (
          <div className="export-success">
            <div className="export-success-icon" style={{ color: colors.primary }}>◈</div>
            <div className="export-success-text">signal packaged successfully</div>
            <div className="export-success-sub">saved to your downloads · ready for transmission</div>
            <button className="export-close-btn" onClick={onClose}>close</button>
          </div>
        )}
        <button className="export-modal-close" onClick={onClose}>✕</button>
      </div>
    </div>
  )
}
// ─── Signal Card Component ────────────────────────────────────────────────────
function SignalCard({ signal, index, decayRemaining, dissolving, presenceTick, livePulse = false }: { signal: FeedSignal; index: number; decayRemaining: number | null; dissolving: boolean; presenceTick: number; livePulse?: boolean }) {
  const { ecosystemState, saveSignal, unsaveFromLibrary, reactToSignal } = useEcosystemState()
  const globalAudio = useGlobalAudio()
  // your Hz — what the relay folds into the signal's chorus
  const myHz = useMemo(() => getLocalHzProfile(ecosystemState.userSignalIdentity ?? 'unclaimed').hz, [ecosystemState.userSignalIdentity])
  const [visible, setVisible] = useState(false)
  const [waveformVisible, setWaveformVisible] = useState(false)
  const [textVisible, setTextVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [tagPicker, setTagPicker] = useState(false)
  const [marked, setMarked] = useState<string | null>(() => listReturns().find(m => m.id === signal.id)?.tag ?? null)
  const [reportNote, setReportNote] = useState<string | null>(null)
  const [fading, setFading] = useState(false)
  const [fadedAway, setFadedAway] = useState(false)
  const [confirmingFade, setConfirmingFade] = useState(false)
  const playing = globalAudio.current?.id === signal.id && globalAudio.playing
  // guard delayed state updates so a card scrolled/filtered away mid-timeout
  // never sets state after unmount
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  // auto word-reactions: short responses that change with what was posted
  const wordReacts = useMemo(() => wordReactionsFor(signal.content, signal.mood), [signal.content, signal.mood])
  const [reactCounts, setReactCounts] = useState<Record<string, number>>({})
  const tapWordReact = (word: string) => {
    setReactCounts(prev => ({ ...prev, [word]: (prev[word] ?? 0) + 1 }))
    reactToSignal(signal.id, `reacted "${word}"`)
    // on real backend signals this notifies the author (DB trigger)
    if (signal.remote) mirrorReaction(signal.id, word)
  }

  // fully automated report flow: instant hide + AI screening verdict, no human review
  const submitReport = (reason: string) => {
    setReporting(false)
    if (playing) globalAudio.stop()
    const verdict = moderatePublicSignalText(signal.content)
    storeHidden([signal.id, ...loadHidden().filter(id => id !== signal.id)])
    mirrorActivity('signal_reported', `reported: ${reason}`, { signalId: signal.id, autoFlags: verdict.flags, autoFlagged: verdict.status === 'flagged' })
    setReportNote(verdict.status === 'flagged'
      ? 'auto-review: content flagged · removed and logged'
      : 'auto-review complete · hidden from your feed')
    window.setTimeout(() => { if (mountedRef.current) setReportNote('__hide__') }, 2600)
  }

  const wasReplayed = ecosystemState.playedSignals.includes(signal.id)
  const isSaved = ecosystemState.savedSignals.includes(signal.id)


  const togglePlay = () => {
    if (playing) {
      globalAudio.stop()
      return
    }
    const meta = { id: signal.id, label: signal.handle, source: 'signals' as const }
    // a deliberate replay is a real crossing — recurring strangers become familiar
    if (!signal.anonymous) recordCrossing(signal.handle, signal.id, signal.mood, signal.content)
    // your own voice posts play their real recording
    if (signal.audioId) {
      void postBlob(signal.audioId).then(blob => {
        if (blob) globalAudio.playBlob(blob, meta)
        else if (signal.audioUrl) globalAudio.playUrl(signal.audioUrl, meta)
        else if (speechSupported()) { globalAudio.playSimulated(meta, estimateSpeechMs(signal.content) + 4000); speakSignal(signal.content, signal.waveformSeed, { onEnd: () => globalAudio.stop() }) }
      }).catch(() => { /* recording unavailable — stay quiet */ })
      return
    }
    // others' voice posts play the moderated public clip
    if (signal.audioUrl) { globalAudio.playUrl(signal.audioUrl, meta); return }
    // speakable signals are read aloud in a real voice; static/corrupted stay textured
    const speakable = signal.status !== 'corrupted' && signal.mood !== 'static'
    if (speakable && speechSupported()) {
      // drive the waveform/listening state silently; the real voice carries the
      // sound and its onEnd stops the visual — the padded timer is only a fallback
      globalAudio.playSimulated(meta, estimateSpeechMs(signal.content) + 4000)
      speakSignal(signal.content, signal.waveformSeed, { onEnd: () => globalAudio.stop() })
    } else {
      const kind = signal.mood === 'static' || signal.status === 'corrupted' ? 'static' : 'voice'
      void playSample(globalAudio, meta, kind, signal.waveformSeed, durationToMs(signal.duration))
    }
  }
  const colors = MOOD_COLORS[signal.mood]
  const waveform = generateWaveform(signal.waveformSeed)
  // signal life: decay (until preserved) + replay heat + a human reason
  const [decay, setDecay] = useState(() => (signal.status === 'corrupted' || signal.mine ? 0 : decayLevel(signal.id)))
  const heat = useMemo(() => heatFor(signal.id), [signal.id])
  const lifeLine = useMemo(() => (index % 3 === 0 ? whyFoundYou(signal.id) : index % 3 === 1 ? presenceLine(signal.id) : null), [signal.id, index])
  const decayedContent = useMemo(() => decayText(signal.content, decay, signal.id), [signal.content, decay, signal.id])

  const displayText = useTypewriter(decayedContent, !!(signal.typewriterEffect && textVisible))

  useEffect(() => {
    const baseDelay = Math.min(index, 8) * 350 + 200
    const t1 = setTimeout(() => setVisible(true), baseDelay)
    const t2 = setTimeout(() => setWaveformVisible(true), baseDelay + 300)
    const t3 = setTimeout(() => setTextVisible(true), baseDelay + 700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [index])

  const isCorrupted = signal.status === 'corrupted'
  const isFading = signal.status === 'fading' || signal.status === 'archiving'

  // fade: chosen forgetting — confirm in-world, dissolve, never resurface
  const runFade = () => {
    setConfirmingFade(false)
    if (playing) globalAudio.stop()
    setFading(true)
    storeFaded([signal.id, ...loadFaded().filter(id => id !== signal.id)])
    mirrorSignalFade(signal.id)
    window.setTimeout(() => { if (mountedRef.current) setFadedAway(true) }, 720)
  }

  // hooks above must run every render; the post-report hide bails out here
  if (reportNote === '__hide__' || fadedAway) return null

  return (
    <>
      <div
        className={`signal-card ${visible ? 'signal-card--visible' : ''} ${hovered ? 'signal-card--hovered' : ''} ${isCorrupted ? 'signal-card--corrupted' : ''} ${isFading ? 'signal-card--fading' : ''} ${playing ? 'signal-card--playing' : ''} ${wasReplayed ? 'signal-card--replayed' : ''} ${dissolving || fading ? 'signal-card--dissolving' : ''} ${livePulse ? 'signal-card--live-pulse' : ''} signal-card--decay-${decay} signal-card--heat-${heat.level}`}
        style={{ '--mood-color': colors.primary, '--mood-glow': colors.glow, '--mood-dim': colors.dim, '--entry-delay': `${Math.min(index, 8) * 350}ms` } as React.CSSProperties}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={() => setHovered(true)}
        onTouchEnd={() => setHovered(false)}
      >
        {/* Breathing neon edge */}
        <div className="card-neon-edge" style={{ boxShadow: `inset 0 0 0 1px ${hovered ? colors.glow : colors.dim}, 0 0 ${hovered ? '24px' : '8px'} ${hovered ? colors.glow : 'transparent'}` }} />

        {/* Card Header */}
        <div className="card-header">
          <div className="card-handle-row">
            <div className="card-handle" style={{ color: isCorrupted ? '#ff3366' : colors.primary }}>
              {signal.anonymous ? '⬡' : '◈'}{' '}
              {signal.anonymous ? signal.handle : (
                <button
                  type="button"
                  className="card-handle-link"
                  title="open this carrier"
                  onClick={e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('ecosphere:viewCarrier', { detail: { handle: signal.handle, line: signal.content, seed: signal.waveformSeed } })) }}
                >
                  {signal.handle}
                </button>
              )}{' '}
              <HzBadge compact {...hzForHandle(signal.handle)} />
            </div>
            <div className="card-status" style={{ color: colors.primary, opacity: 0.7 }}>
              {STATUS_LABELS[signal.status]}
              {(signal.status === 'live' || signal.status === 'resonating') && (
                <span className="card-listeners"> · {listenerCount(signal.id, presenceTick)} listening</span>
              )}
            </div>
          </div>
          <div className="card-meta-row">
            <span className="card-type-label">{SIGNAL_TYPE_LABELS[signal.type]}</span>
            <span className="card-band" style={{ color: colors.primary }}>{signal.emotionalBand}</span>
            <span className="card-time">{signal.timeAgo}</span>
            {signal.expiresIn != null && (
              isSaved ? (
                <span className="card-decay card-decay--preserved">✶ preserved</span>
              ) : decayRemaining != null ? (
                <span className={`card-decay${decayRemaining <= 30 ? ' card-decay--urgent' : ''}`}>
                  fades in {Math.floor(decayRemaining / 60)}:{String(decayRemaining % 60).padStart(2, '0')}
                </span>
              ) : null
            )}
          </div>
        </div>

        {/* Waveform Player */}
        <div className={`card-waveform-section ${waveformVisible ? 'card-waveform--visible' : ''} ${hovered ? 'card-waveform--expanded' : ''}`}>
          <button
            className={`waveform-play-btn ${playing ? 'waveform-play-btn--active' : ''}`}
            style={{ borderColor: colors.primary, color: colors.primary }}
            onClick={togglePlay}
          >
            {playing ? '▐▐' : '▶'}
          </button>
          <div className="waveform-bars">
            {waveform.map((h, i) => (
              <WaveformBar key={i} height={h} active={playing && i < (waveform.length * 0.4)} color={colors.primary} animated={playing || hovered} index={i} />
            ))}
          </div>
          <div className="waveform-right">
            <span className="waveform-duration">{signal.duration}</span>
            <span className="waveform-resonance" style={{ color: colors.primary }}>{signal.resonance}%</span>
          </div>
        </div>

        {/* Resonance bars */}
        <div className="card-resonance-bars">
          <div className="resonance-track">
            <div className="resonance-fill" style={{ width: `${signal.resonance}%`, background: `linear-gradient(90deg, ${colors.dim}, ${colors.primary})` }} />
          </div>
          <span className="resonance-label" style={{ color: colors.primary }}>resonance</span>
        </div>

        {/* Signal content text */}
        <div className={`card-content ${textVisible ? 'card-content--visible' : ''}`}>
          {isCorrupted ? (
            <span className="corrupted-text">{signal.content}</span>
          ) : (
            <span className={decay >= 2 ? 'decay-text' : undefined}>{displayText}</span>
          )}
          {decay >= 3 && <span className="decay-static" aria-hidden="true" />}
        </div>

        {/* auto word-reactions — tuned to what this signal says */}
        {!isCorrupted && (
          <div className="card-word-reactions" role="group" aria-label="quick reactions">
            {wordReacts.map(word => (
              <button
                key={word}
                type="button"
                className={`word-react${reactCounts[word] ? ' word-react--on' : ''}`}
                style={{ '--btn-color': colors.primary } as React.CSSProperties}
                onClick={e => { e.stopPropagation(); tapWordReact(word) }}
              >
                {word}{reactCounts[word] ? ` · ${reactCounts[word]}` : ''}
              </button>
            ))}
          </div>
        )}

        {/* signal life: heat, decay, and the reason it found you */}
        {(heat.line || decay > 0 || lifeLine) && (
          <div className="card-life-row">
            {heat.line && <span className="card-heat-line">∿ {heat.line}</span>}
            {decay > 0 && (
              <button
                type="button"
                className="card-preserve"
                onClick={e => {
                  e.stopPropagation()
                  preserveSignal(signal.id)
                  const wasGone = decay >= 3
                  setDecay(0)
                  if (wasGone) reactToSignal(signal.id, 'pulled a signal back from static — relic material')
                }}
              >
                ◍ {DECAY_LABELS[decay]}
              </button>
            )}
            {lifeLine && <span className="card-why-line">{lifeLine}</span>}
          </div>
        )}

        {/* Voice reactions */}
        <VoiceReactionStack signalId={signal.id} moodColor={colors.primary} />

        {/* Relay: push it further down the band — your frequency joins the chorus */}
        <RelayButton signalId={signal.id} myHz={myHz} color={colors.primary} />

        {/* listener traces — only on replayed / heavily replayed signals */}
        <ListenerTraces signalId={signal.id} resonance={signal.resonance} replayed={wasReplayed} />

        {livePulse && (
          <span className="card-replay-pulse" role="status">
            <i aria-hidden="true" /> someone is replaying this right now
          </span>
        )}

        {/* Export action */}
        <div className={`card-export-row ${hovered ? 'card-export-row--visible' : ''}`}>
          <button
            className={`action-btn action-btn--save ${isSaved ? 'action-btn--saved' : ''}`}
            style={{ '--btn-color': colors.primary } as React.CSSProperties}
            onClick={() => (isSaved ? unsaveFromLibrary('signal', signal.id) : saveSignal(signal.id, signal.handle))}
          >
            <span>{isSaved ? '✦' : '✧'}</span> {isSaved ? 'kept' : 'keep'}
          </button>
          <button
            className="action-btn action-btn--export"
            style={{ '--btn-color': colors.primary } as React.CSSProperties}
            onClick={() => setShowExport(true)}
          >
            <span>⬡</span> export signal
          </button>
          <button
            className={`action-btn action-btn--later${marked ? ' action-btn--saved' : ''}`}
            style={{ '--btn-color': colors.primary } as React.CSSProperties}
            onClick={() => setTagPicker(t => !t)}
            aria-expanded={tagPicker}
            title="mark this to come back to"
          >
            <span>◔</span> {marked ? marked : 'later'}
          </button>
          <button
            className="action-btn action-btn--report"
            onClick={() => setReporting(r => !r)}
            aria-expanded={reporting}
          >
            <span>⚑</span> report
          </button>
          <button
            className={`action-btn action-btn--fade${confirmingFade ? ' action-btn--fade-armed' : ''}`}
            title="Fade — this signal leaves your memory forever"
            aria-expanded={confirmingFade}
            onClick={() => setConfirmingFade(c => !c)}
          >
            <span>◌</span> fade
          </button>
        </div>

        {confirmingFade && (
          <div className="card-fade-row" role="group" aria-label="Let this signal fade forever?">
            <span className="card-fade-warn">this one leaves your memory for good.</span>
            <button type="button" className="card-fade-go" onClick={runFade}>let it fade ◌</button>
            <button type="button" className="card-fade-keep" onClick={() => setConfirmingFade(false)}>keep it</button>
          </div>
        )}

        {tagPicker && (
          <div className="card-return-row" role="group" aria-label="Come back to this">
            {RETURN_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  addReturn({ id: signal.id, label: `"${signal.content.slice(0, 48)}…"`, page: 'signals', tag })
                  setMarked(tag)
                  setTagPicker(false)
                }}
              >
                ◔ {tag}
              </button>
            ))}
            {marked && (
              <button type="button" className="card-return-clear" onClick={() => { removeReturn(signal.id); setMarked(null); setTagPicker(false) }}>
                ✕ unmark
              </button>
            )}
          </div>
        )}
        {reporting && (
          <div className="card-report-row" role="group" aria-label="Report reason">
            {['harassment', 'spam', 'unsafe content', 'sexual content', 'child safety', 'other'].map(reason => (
              <button key={reason} type="button" onClick={() => submitReport(reason)}>{reason}</button>
            ))}
          </div>
        )}
        {reportNote && reportNote !== '__hide__' && (
          <div className="card-report-note" role="status">{reportNote}</div>
        )}

        {/* Ambient glow pulse */}
        {hovered && (
          <div className="card-glow-pulse" style={{ background: `radial-gradient(ellipse at 50% 50%, ${colors.dim} 0%, transparent 70%)` }} />
        )}
      </div>
      {showExport && <ExportModal signal={signal} onClose={() => setShowExport(false)} />}
    </>
  )
}
// ─── Particle Canvas ──────────────────────────────────────────────────────────
function ParticleLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>(generateParticles(50))
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particlesRef.current.forEach(p => {
        p.x += p.speedX
        p.y += p.speedY
        if (p.x < -2) p.x = 102
        if (p.x > 102) p.x = -2
        if (p.y < -2) p.y = 102
        if (p.y > 102) p.y = -2

        const x = (p.x / 100) * canvas.width
        const y = (p.y / 100) * canvas.height

        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, '0')
        ctx.fill()
      })
      animRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  return <canvas ref={canvasRef} className="feed-particle-canvas" />
}

// ─── Scan Lines Overlay ───────────────────────────────────────────────────────
function ScanLines() {
  return <div className="feed-scan-lines" aria-hidden="true" />
}

// ─── Grain Overlay ────────────────────────────────────────────────────────────
function GrainOverlay() {
  return <div className="feed-grain" aria-hidden="true" />
}

// ─── Ecosystem Event Banner ───────────────────────────────────────────────────
function EcosystemEventBanner({ event, onDismiss }: { event: EcosystemEvent; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5500)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="ecosystem-event-banner">
      <span className="ecosystem-event-icon">◈</span>
      <span className="ecosystem-event-text">{event.message}</span>
      <button className="ecosystem-event-dismiss" onClick={onDismiss}>✕</button>
    </div>
  )
}

// ─── Feed Header ──────────────────────────────────────────────────────────────
function FeedHeader() {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="feed-header">
      <div className="feed-header-left">
        <div className={`feed-live-dot ${pulse ? 'feed-live-dot--pulse' : ''}`} />
        <span className="feed-header-title">signal feed</span>
      </div>
      <div className="feed-header-right">
        <span className="feed-header-sub">emotional ecosystem · live</span>
      </div>
    </div>
  )
}
// ─── Composer: release your own signal into the feed (text + optional voice) ──
function FeedComposer({ onPost }: { onPost: (s: FeedSignal) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [recMs, setRecMs] = useState(0)
  const [draftBlob, setDraftBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  const stopRec = useCallback(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null }
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* already stopped */ }
    setRecording(false)
  }, [])

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* no-op */ }
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const startRec = async () => {
    setError(null)
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) { setError('this browser can’t record'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = createVoiceRecorder(stream)
      recRef.current = rec
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        if (blob.size > 0) setDraftBlob(blob)
      }
      rec.start()
      startedRef.current = Date.now()
      setRecMs(0); setRecording(true)
      timerRef.current = window.setInterval(() => {
        const ms = Date.now() - startedRef.current
        setRecMs(ms)
        if (ms >= 30000) stopRec()
      }, 200)
    } catch (err) {
      const reason = micErrorReason(err)
      setError(reason === 'permission' ? 'microphone permission was declined' : reason === 'device' ? 'no microphone answered' : 'the mic wouldn’t open')
    }
  }

  const clearDraft = () => { setDraftBlob(null); setRecMs(0) }

  const post = async () => {
    const body = text.trim().replace(/\s+/g, ' ')
    if (!body && !draftBlob) { setError('say something, or record a moment'); return }
    if (body) {
      if (words < 3 || words > 40) { setError('keep it between 3 and 40 words'); return }
      if (moderatePublicSignalText(body).status === 'flagged') { setError('that one stays unsent — it didn’t pass screening'); return }
    }
    const anon = anonymousMode()
    const mood = moodFromText(body)
    const durMs = draftBlob ? Math.max(1000, recMs) : 0
    // publish to the backend (when configured) so others see it; the real
    // signal id becomes the card id so reactions notify the author
    let id: string = crypto.randomUUID?.() ?? `post-${Date.now()}`
    let remote = false
    if (draftBlob) {
      // voice post: upload + publish + run the clip through moderate-audio
      const res = await publishVoiceSignalToFeed(draftBlob, body, mood, anon, Math.round(durMs / 1000))
      if (res.id) { id = res.id; remote = true }
      // keep a local copy (under the final id) for the author's own instant playback
      await saveRecordingLocally({ id, label: body.slice(0, 40) || 'your signal', durationMs: durMs, emotionalTag: 'signal', createdAt: Date.now(), blob: draftBlob }).catch(() => { /* stays in-session if store fails */ })
    } else if (body) {
      const remoteId = await publishSignalToFeed(body, mood, anon)
      if (remoteId) { id = remoteId; remote = true }
    }
    const signal: FeedSignal = {
      id,
      handle: anon ? 'you · anonymous' : publicHandle(),
      timeAgo: 'just now',
      content: body || '(a voice signal, no words)',
      mood,
      resonance: 70,
      anonymous: anon,
      duration: draftBlob ? `0:${String(Math.min(30, Math.round(durMs / 1000))).padStart(2, '0')}` : `0:${String(10 + (words % 30)).padStart(2, '0')}`,
      type: draftBlob ? 'voice_note' : 'drifting_thought',
      status: 'live',
      emotionalBand: 'yours',
      waveformSeed: Math.floor(Math.random() * 9000) + 100,
      mine: true,
      audioId: draftBlob ? id : undefined,
      remote,
      postedAt: Date.now(),
    }
    onPost(signal)
    setText(''); clearDraft(); setError(null); setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className="feed-compose-open" onClick={() => setOpen(true)}>
        ✎ release a signal into the feed
      </button>
    )
  }
  return (
    <div className="feed-composer">
      <textarea
        className="feed-composer-input"
        placeholder="say the thing you'd only say at this hour…"
        maxLength={240}
        value={text}
        onChange={e => setText(e.target.value)}
        aria-label="write your signal"
      />
      <div className="feed-composer-row">
        <span className="feed-composer-count">{words ? `${words} words` : 'words optional'}</span>
        {!draftBlob ? (
          <button type="button" className={`feed-composer-rec${recording ? ' on' : ''}`} onClick={() => (recording ? stopRec() : void startRec())}>
            {recording ? `■ stop · ${(recMs / 1000).toFixed(0)}s` : '● add voice'}
          </button>
        ) : (
          <button type="button" className="feed-composer-rec on" onClick={clearDraft}>✕ voice attached · {(recMs / 1000).toFixed(0)}s</button>
        )}
      </div>
      {error && <span className="feed-composer-error" role="alert">{error}</span>}
      <div className="feed-composer-actions">
        <button type="button" className="feed-composer-cancel" onClick={() => { setText(''); clearDraft(); setError(null); if (recording) stopRec(); setOpen(false) }}>drift off</button>
        <button type="button" className="feed-composer-post" onClick={() => void post()}>release ∿</button>
      </div>
    </div>
  )
}

// ─── Main FeedScreen ──────────────────────────────────────────────────────────
export default function FeedScreen() {
  const { ecosystemState } = useEcosystemState()
  const [activeEvent, setActiveEvent] = useState<EcosystemEvent | null>(null)
  const [signals, setSignals] = useState<FeedSignal[]>([])
  const [expiries, setExpiries] = useState<Record<string, number>>({})
  const [dissolving, setDissolving] = useState<string[]>([])
  const [decayNow, setDecayNow] = useState(() => Date.now())
  const [ambientEnabled, setAmbientEnabled] = useState(false)
  const eventIndexRef = useRef(0)

  const handlePost = useCallback((sig: FeedSignal) => {
    setSignals(prev => [sig, ...prev.filter(p => p.id !== sig.id)])
    storeMyPost(sig)
  }, [])

  // Stagger signal entry + arm decay timers on unfaded ephemerals
  useEffect(() => {
    const hidden = new Set([...loadHidden(), ...loadFaded()])
    setSignals([...loadMyPosts(), ...FEED_SIGNALS, ...GHOST_FEED.slice(0, GHOST_PAGE_SIZE)].filter(sig => !hidden.has(sig.id)))
    setExpiries(Object.fromEntries(
      FEED_SIGNALS.filter(sig => sig.expiresIn != null).map(sig => [sig.id, Date.now() + (sig.expiresIn ?? 60) * 1000]),
    ))

    // live backend signals (when Supabase is configured) lead the feed
    let cancelled = false
    void fetchPublicSignals(8).then(remote => {
      if (cancelled || remote.length === 0) return
      const moods: Mood[] = ['nocturne', 'bloom', 'drift', 'static', 'lost']
      const mapped: FeedSignal[] = remote.map((r, i) => ({
        id: r.id,
        handle: 'anonymous',
        timeAgo: 'from the network',
        content: r.caption,
        mood: (moods.includes(r.mood as Mood) ? r.mood : 'drift') as Mood,
        resonance: 60 + ((i * 13) % 35),
        anonymous: true,
        duration: `0:${String(20 + ((i * 9) % 39)).padStart(2, '0')}`,
        type: 'voice_note',
        status: 'live',
        emotionalBand: 'live-network',
        waveformSeed: (r.createdAt % 997) + i,
        remote: true,
        audioUrl: r.audioUrl,
      }))
      setSignals(prev => {
        const known = new Set(prev.map(p => p.id))
        const hidden = new Set([...loadHidden(), ...loadFaded()])
        // automated protection: AI-screen incoming network signals before display
        const safe = mapped.filter(m => !known.has(m.id) && !hidden.has(m.id) && moderatePublicSignalText(m.content).status !== 'flagged')
        return [...safe, ...prev]
      })
    }).catch(() => { /* offline — the seeded + ghost feed is the source of truth */ })
    return () => { cancelled = true }
  }, [])

  // decay tick: expired signals dissolve unless someone preserved them
  useEffect(() => {
    const t = window.setInterval(() => setDecayNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  // live replay pulses: every so often, one card is visibly being replayed
  const [livePulseId, setLivePulseId] = useState<string | null>(null)
  useEffect(() => {
    let clearTimer: number | undefined
    const schedule = () => window.setTimeout(() => {
      setSignals(current => {
        if (current.length > 0) {
          const pick = current[Math.floor(Math.random() * Math.min(current.length, 12))]
          setLivePulseId(pick.id)
          clearTimer = window.setTimeout(() => setLivePulseId(null), 6500)
        }
        return current
      })
      timer = schedule()
    }, 40000 + Math.random() * 40000)
    let timer = schedule()
    // real replays from the live bus land as immediate pulses
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string }>).detail
      if (detail?.type !== 'replay') return
      setSignals(current => {
        if (current.length > 0) {
          const pick = current[Math.floor(Math.random() * Math.min(current.length, 12))]
          setLivePulseId(pick.id)
          clearTimer = window.setTimeout(() => setLivePulseId(null), 6500)
        }
        return current
      })
    }
    window.addEventListener('ecosphere:live', onLive)
    return () => { window.clearTimeout(timer); window.clearTimeout(clearTimer); window.removeEventListener('ecosphere:live', onLive) }
  }, [])

  // ghost archive: scrolling to the drift zone surfaces another page
  const [ghostCount, setGhostCount] = useState(GHOST_PAGE_SIZE)
  const driftZoneRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = driftZoneRef.current
    if (!node || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setGhostCount(count => Math.min(GHOST_FEED.length, count + GHOST_PAGE_SIZE))
      }
    }, { rootMargin: '200px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (ghostCount <= GHOST_PAGE_SIZE) return
    setSignals(prev => {
      const known = new Set(prev.map(p => p.id))
      const hidden = new Set([...loadHidden(), ...loadFaded()])
      const next = GHOST_FEED.slice(0, ghostCount).filter(g => !known.has(g.id) && !hidden.has(g.id))
      return next.length > 0 ? [...prev, ...next] : prev
    })
  }, [ghostCount])

  useEffect(() => {
    Object.entries(expiries).forEach(([id, expiresAt]) => {
      if (ecosystemState.savedSignals.includes(id)) return
      if (decayNow >= expiresAt && !dissolving.includes(id)) {
        setDissolving(d => [...d, id])
        window.setTimeout(() => {
          setSignals(prev => prev.filter(sig => sig.id !== id))
          setExpiries(prev => {
            const next = { ...prev }
            delete next[id]
            return next
          })
          setActiveEvent({ id: `decay-${id}`, message: 'a signal finished fading. nobody preserved it.', visible: true })
        }, 1600)
      }
    })
  }, [decayNow, expiries, dissolving, ecosystemState.savedSignals])

  // Ecosystem events
  useEffect(() => {
    let cancelled = false
    let recurring = 0
    const scheduleNext = () => {
      const delay = Math.random() * 18000 + 12000
      recurring = window.setTimeout(() => {
        if (cancelled) return
        const pool = eventIndexRef.current % 3 === 2 ? livedInLines('signals', 4) : ECOSYSTEM_EVENTS
        const msg = pool[eventIndexRef.current % pool.length]
        eventIndexRef.current++
        setActiveEvent({ id: Date.now().toString(), message: msg, visible: true })
        scheduleNext()
      }, delay)
    }
    // First event after a short delay
    const t = window.setTimeout(() => {
      if (!cancelled) setActiveEvent({ id: '0', message: ECOSYSTEM_EVENTS[0], visible: true })
    }, 6000)
    scheduleNext()
    return () => { cancelled = true; window.clearTimeout(t); window.clearTimeout(recurring) }
  }, [])

  const dismissEvent = useCallback(() => setActiveEvent(null), [])

  return (
    <div className={`feed-screen ${ambientEnabled ? 'feed-screen--ambient' : ''}`}>
      {/* Background atmosphere layers */}
      <div className="feed-atmosphere">
        <div className="feed-fog-layer feed-fog-1" />
        <div className="feed-fog-layer feed-fog-2" />
        <div className="feed-fog-layer feed-fog-3" />
      </div>

      {/* Drifting waveform shards */}
      <div className="feed-waveform-shards" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      {/* Depth vignette */}
      <div className="feed-depth-vignette" aria-hidden="true" />

      {/* Particle system */}
      <ParticleLayer />

      {/* Scan lines */}
      <ScanLines />

      {/* Film grain */}
      <GrainOverlay />

      {/* Ambient glow orbs */}
      <div className="feed-glow-orb feed-glow-orb--pink" />
      <div className="feed-glow-orb feed-glow-orb--cyan" />
      <div className="feed-glow-orb feed-glow-orb--purple" />

      {/* Main content */}
      <div className="feed-content">
        {/* Header */}
        <FeedHeader />

        {/* recurring strangers — signals that keep crossing yours */}
        <FamiliarFrequency />

        {/* Ambient toggle */}
        <div className="feed-ambient-row">
          <button
            className={`ambient-toggle ${ambientEnabled ? 'ambient-toggle--active' : ''}`}
            onClick={() => setAmbientEnabled(a => !a)}
          >
            <span className="ambient-icon">{ambientEnabled ? '◉' : '○'}</span>
            ambient layer {ambientEnabled ? 'on' : 'off'}
          </button>
          <span className="feed-signal-count">{signals.length} signals active</span>
        </div>

        {/* compose: release your own signal into the feed */}
        <FeedComposer onPost={handlePost} />

        {/* Signal cards */}
        <div className="feed-cards">
          {signals.map((signal, i) => {
            const expiresAt = expiries[signal.id]
            const remaining = expiresAt != null ? Math.max(0, Math.ceil((expiresAt - decayNow) / 1000)) : null
            return (
              <SignalCard
                key={signal.id}
                signal={signal}
                index={i}
                decayRemaining={remaining}
                dissolving={dissolving.includes(signal.id)}
                presenceTick={Math.floor(decayNow / 8000)}
                livePulse={livePulseId === signal.id}
              />
            )
          })}
          {signals.length === 0 && (
            <p className="feed-empty" role="status">
              the frequency is quiet right now — no signals in range. drift back later; the band never stays empty for long.
            </p>
          )}
        </div>

        {/* Bottom drift zone — older archive signals surface as you approach */}
        <div className="feed-drift-zone" ref={driftZoneRef}>
          <div className="drift-zone-line" />
          <span className="drift-zone-text">
            {ghostCount < GHOST_FEED.length ? 'older signals surfacing from the archive…' : 'signals drift beyond this point'}
          </span>
          <div className="drift-zone-line" />
        </div>
      </div>

      {/* Ecosystem event */}
      {activeEvent && (
        <EcosystemEventBanner event={activeEvent} onDismiss={dismissEvent} />
      )}
    </div>
  )
}
