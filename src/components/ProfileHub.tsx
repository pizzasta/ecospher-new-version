import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useEcosystemState } from '../hooks/useEcosystemState'
import { useGlobalAudio } from '../hooks/useGlobalAudio'
import { playSample } from '../lib/sampleAudio'
import { deleteLocalRecording, listLocalRecordings } from '../lib/localAudioStore'
import type { StoredRecording } from '../lib/localAudioStore'
import { getListenCounts, getProfile, syncProfile } from '../lib'
import { isSupabaseConfigured } from '../lib/supabase-env'
import { moderatePublicSignalText } from '../lib/signalModeration'
import { readStatus, writeStatus, readFeatured, writeFeatured } from '../lib/profileExtras'
import type { FeaturedSignal } from '../lib/profileExtras'
import { getHzProfile, getLocalHzProfile } from '../lib/hzSignature'
import { useEcoPref } from '../hooks/useEcoPrefs'
import { readAvatar, saveAvatar, sigilGlyph } from '../lib/avatar'
import { SIGIL_THEMES, sigilsInTheme } from '../lib/sigilThemes'
import type { HzProfile } from '../lib/hzSignature'
import AudioPlayer from './AudioPlayer'
import AudioRecorder from './AudioRecorder'
import ColorWave from './ColorWave'
import ProfileScene from './ProfileScene'
import HzBadge from './HzBadge'
import HzSettingsModal from './HzSettingsModal'
import FrequencyGradientModal from './FrequencyGradientModal'
import ProfileOnboarding, { shouldAutoOnboard } from './ProfileOnboarding'
import { readMood, moodToVars } from '../lib/profileMood'
import { loadGradientSettings, readGradientSettings, resolveGradientColors } from '../lib/frequencyGradient'
import type { GradientSettings } from '../lib/frequencyGradient'
import { useFrequencyGradient } from '../hooks/useFrequencyGradient'
import { deriveAtmosphere, deriveTraits, memoryLines, pickTonightAction, tonightLines, topReturns } from '../lib/listeningIdentity'
import type { IdentityInput } from '../lib/listeningIdentity'
import { daySeed, grainPositions, visitorGrainCount } from '../lib/visitorStatic'
import type { Grain } from '../lib/visitorStatic'
import { readLastVoiceAt, silentDays } from '../lib/weightOfSilence'
import { recapAvailable } from '../lib/frequencyRecap'
import { currentDrop } from '../lib/frequencyDrops'
import { localDayKey } from '../lib/frequencyRecap'
import { fireMoment, momentIdentitySelect, momentOnboardStep } from '../lib/audioMoments'
import { listHarmonies } from '../lib/echolocation'
import './ProfileHub.css'

const FIRST_SEEN_KEY = 'ecosphere:firstSeenAt'
const TUNED_TO_KEY = 'ecosphere:tunedTo'
const ECHO_PAGE = 10

function readLocal(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function writeLocal(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch { /* session only */ }
}

export function readTunedTo(): string[] {
  try { return JSON.parse(window.localStorage.getItem(TUNED_TO_KEY) ?? '[]') } catch { return [] }
}

/**
 * Profile Hub: the user's own page inside the Soul Pod. Header with editable
 * bio + AI bio, echo archive, 7-day listening history, capsule vault counts,
 * and listener / tuned-to stats. Two columns on desktop, one on mobile.
 */
// deep questions worth thirty seconds of honesty — answered out loud,
// kept private by default, shareable to your page if you choose
const VOICE_PROMPTS = [
  "what's something you believe but can't prove?",
  'who were you at fifteen that you miss?',
  "describe the moment you knew everything was about to change.",
  "what do you keep apologizing for that wasn't your fault?",
  'what does home sound like?',
  'tell me about a door you didn\'t open.',
  'what are you still waiting for?',
  "what's the kindest thing a stranger ever did for you?",
  'which memory would you give up last?',
  'what would you say to the person you almost became?',
  "what's a question you hope nobody ever asks you?",
  'when did you last feel completely unhurried?',
]

// which cards live on the public Profile vs the private Dashboard
const PROFILE_TILES = ['identity', 'featured', 'wall']
const DASHBOARD_TILES = ['tonightAction', 'prompts', 'echoes', 'tonight', 'history', 'shelf', 'vault', 'reach', 'tuning']

export default function ProfileHub({ onNavigate, variant = 'profile' }: { onNavigate?: (screen: string) => void; variant?: 'profile' | 'dashboard' }) {
  const allowedTiles = variant === 'profile' ? PROFILE_TILES : DASHBOARD_TILES
  const { ecosystemState, setSignalIdentity } = useEcosystemState()
  const globalAudio = useGlobalAudio()
  const privateProfile = useEcoPref('privateProfile', false)
  // rename your signal — the one identity field you choose outright
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const commitRename = async () => {
    const clean = nameDraft.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (clean.length < 2) { setNameError('give your signal at least 2 characters'); return }
    if (moderatePublicSignalText(clean).status === 'flagged') { setNameError('that name can’t go on the band'); return }
    // with a backend, sync FIRST — syncProfile returns null on failure (e.g. the
    // username is taken / unique-violation), so confirm it stuck before applying
    // locally, or the profile diverges across devices.
    if (isSupabaseConfigured) {
      setRenaming(true)
      const saved = await syncProfile(clean)
      setRenaming(false)
      if (!saved) { setNameError('that name is taken — or wouldn’t sync. try another.'); return }
    }
    setSignalIdentity(clean)
    setEditingName(false); setNameError(null)
  }
  // status line — a short "now broadcasting…" you set
  const [status, setStatus] = useState(() => readStatus())
  const [editingStatus, setEditingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')
  const [statusError, setStatusError] = useState<string | null>(null)
  const commitStatus = () => {
    const clean = statusDraft.trim().replace(/\s+/g, ' ').slice(0, 80)
    if (clean && moderatePublicSignalText(clean).status === 'flagged') { setStatusError('that one can’t broadcast'); return }
    writeStatus(clean); setStatus(clean); setEditingStatus(false); setStatusError(null)
  }
  // featured signal — one recording pinned as your frequency anthem
  const [featured, setFeatured] = useState<FeaturedSignal | null>(() => readFeatured())
  const [featuredPicker, setFeaturedPicker] = useState(false)
  const [featuredOptions, setFeaturedOptions] = useState<StoredRecording[]>([])
  const openFeaturedPicker = () => {
    setFeaturedPicker(true)
    void listLocalRecordings().then(rows => setFeaturedOptions(rows.sort((a, b) => b.createdAt - a.createdAt))).catch(() => { /* none stored */ })
  }
  const pinFeatured = (rec: StoredRecording) => {
    const next = { id: rec.id, label: rec.label, durationMs: rec.durationMs }
    writeFeatured(next); setFeatured(next); setFeaturedPicker(false)
  }
  const clearFeatured = () => { writeFeatured(null); setFeatured(null) }
  const playFeatured = () => {
    if (!featured) return
    void listLocalRecordings()
      .then(rows => { const r = rows.find(x => x.id === featured.id); if (r) globalAudio.playBlob(r.blob, { id: r.id, label: r.label, source: 'pod' }) })
      .catch(() => { /* recording unavailable */ })
  }
  // avatar sigil: a chosen mark instead of a photo — there are no photos here
  const [avatar, setAvatar] = useState(() => readAvatar())
  const [settling, setSettling] = useState<string | null>(null)
  const chooseSigil = (id: string) => {
    saveAvatar(id); setAvatar(id)
    fireMoment('identitySelect', () => momentIdentitySelect(hzProfile.hz))
    setSettling(id); window.setTimeout(() => setSettling(s => (s === id ? null : s)), 700)
  }
  const [sigilOpen, setSigilOpen] = useState(false)

  // ── header data ──
  const username = ecosystemState.userSignalIdentity ?? 'unclaimed frequency'
  const [joined, setJoined] = useState<string | null>(null)
  // tape intro: a ten-second voice introduction instead of a written bio
  const [tapeIntro, setTapeIntro] = useState<{ id: string; durationMs: number; recordedAt: number } | null>(() => {
    try { return JSON.parse(window.localStorage.getItem('ecosphere:tapeIntro') ?? 'null') } catch { return null }
  })
  const [tapeRecording, setTapeRecording] = useState(false)
  const [hzProfile, setHzProfile] = useState<HzProfile>(() => getLocalHzProfile(ecosystemState.userSignalIdentity ?? 'unclaimed'))
  const [hzSettingsOpen, setHzSettingsOpen] = useState(false)
  const [gradient, setGradient] = useState<GradientSettings>(() => readGradientSettings())
  const [gradientOpen, setGradientOpen] = useState(false)
  const [onboarding, setOnboarding] = useState(shouldAutoOnboard)
  const [moodVars, setMoodVars] = useState(() => moodToVars(readMood()))
  // carriers bound through echolocation — the profile wears them as stars
  const [constellation] = useState(() => listHarmonies())
  const gradientAngle = useFrequencyGradient(gradient)

  useEffect(() => {
    void getHzProfile(username).then(setHzProfile).catch(() => { /* keep local hz fallback */ })
    void loadGradientSettings().then(loaded => setGradient(prev => (prev.locked && !loaded.locked) ? prev : loaded)).catch(() => { /* keep current gradient */ })
  }, [username])

  const [gradientStart, gradientEnd] = resolveGradientColors(gradient, hzProfile.hz)

  // ── echo archive ──
  const [echoes, setEchoes] = useState<StoredRecording[]>([])
  const [echoLimit, setEchoLimit] = useState(ECHO_PAGE)

  // listening identity: who this person is inside the ecosystem
  const identityInput: IdentityInput = useMemo(() => ({
    interactions: ecosystemState.recentInteractions,
    listens: ecosystemState.listeningHistory,
    savedCount: ecosystemState.savedSignals.length,
    recordingsCount: echoes.length,
    silentDays: silentDays(readLastVoiceAt()),
    streak: ecosystemState.streak.count,
  }), [ecosystemState.recentInteractions, ecosystemState.listeningHistory, ecosystemState.savedSignals.length, ecosystemState.streak.count, echoes.length])

  const atmosphere = useMemo(() => deriveAtmosphere(identityInput), [identityInput])
  const traits = useMemo(() => deriveTraits(identityInput), [identityInput])
  const tonight = useMemo(() => tonightLines(identityInput), [identityInput])
  const memories = useMemo(() => memoryLines(identityInput), [identityInput])

  // the wall of returns: top replayed fragments — behavior picks them, not the user
  const returns = useMemo(() => topReturns(ecosystemState.listeningHistory), [ecosystemState.listeningHistory])
  const maxReturnCount = Math.max(2, ...returns.map(r => r.count))

  // identity readout: pattern, hours, tendency — derived, never asked
  const listeningPattern = useMemo(() => {
    const plays = ecosystemState.listeningHistory.length
    if (plays === 0) return 'still forming'
    const unique = new Set(ecosystemState.listeningHistory.map(l => l.label ?? l.id)).size
    return plays / Math.max(1, unique) >= 1.8 ? 'loops more than it explores' : 'explores more than it loops'
  }, [ecosystemState.listeningHistory])
  const activeHoursLabel = useMemo(() => {
    const hours = ecosystemState.listeningHistory.map(l => new Date(l.playedAt).getHours())
    if (hours.length === 0) return 'unmapped'
    const buckets: Array<[string, (h: number) => boolean]> = [
      ['deep night · 12–5am', h => h < 5],
      ['late evening · 9pm–12', h => h >= 21],
      ['evening · 6–9pm', h => h >= 18 && h < 21],
      ['daylight hours', h => h >= 5 && h < 18],
    ]
    let best = buckets[0][0]
    let bestCount = -1
    for (const [label, test] of buckets) {
      const count = hours.filter(test).length
      if (count > bestCount) { best = label; bestCount = count }
    }
    return best
  }, [ecosystemState.listeningHistory])
  const replayTendency = useMemo(() => {
    if (returns.length === 0) return 'no anchors yet'
    const top = returns[0]
    return `returns to the same voice · ${top.count}× and counting`
  }, [returns])

  // visitor static: anonymous grains left by everyone who passed through (24h)
  const [grains, setGrains] = useState<Grain[]>([])
  useEffect(() => {
    void visitorGrainCount().then(count => setGrains(grainPositions(count, daySeed())))
  }, [])

  // live presence: while you watch your page, visitors drift through —
  // a comet crosses, a status line names them (anonymously), then it fades
  const [liveVisitor, setLiveVisitor] = useState<{ id: number; tag: string } | null>(null)
  useEffect(() => {
    const TAGS = ['a night listener', 'someone from the band', 'a passing carrier', 'an unnamed frequency', 'someone who keeps coming back']
    let alive = true
    let timer = 0
    let fadeTimer = 0
    const visit = () => {
      if (!alive) return
      setLiveVisitor({ id: Date.now(), tag: TAGS[Math.floor(Math.random() * TAGS.length)] })
      // every live visit also thickens the static a touch
      setGrains(prev => (prev.length < 40 ? [...prev, ...grainPositions(1, Date.now() % 100000)] : prev))
      fadeTimer = window.setTimeout(() => { if (alive) setLiveVisitor(null) }, 9000)
      timer = window.setTimeout(visit, 35000 + Math.random() * 55000)
    }
    timer = window.setTimeout(visit, 9000 + Math.random() * 9000)
    return () => {
      alive = false
      window.clearTimeout(timer)
      window.clearTimeout(fadeTimer)
    }
  }, [])
  const recoveredFragments = useMemo(() => {
    try { return (JSON.parse(window.localStorage.getItem('ecosphere:zoneFragments') ?? '[]') as unknown[]).length } catch { return 0 }
  }, [])

  // active nights: 14-day replay heatmap from real listening timestamps
  const activeNights = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const day = new Date()
      day.setHours(0, 0, 0, 0)
      day.setDate(day.getDate() - (13 - i))
      return { start: day.getTime(), plays: 0 }
    })
    for (const listen of ecosystemState.listeningHistory) {
      const t = new Date(listen.playedAt).getTime()
      for (const day of days) {
        if (t >= day.start && t < day.start + 24 * 60 * 60 * 1000) { day.plays += 1; break }
      }
    }
    return days
  }, [ecosystemState.listeningHistory])
  const maxNightPlays = Math.max(1, ...activeNights.map(d => d.plays))

  useEffect(() => {
    // join date: backend profile when available, else first local visit
    if (!readLocal(FIRST_SEEN_KEY)) writeLocal(FIRST_SEEN_KEY, String(Date.now()))
    void getProfile().then(profile => {
      if (profile) {
        setJoined(new Date(profile.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' }))
        return
      }
      const local = Number(readLocal(FIRST_SEEN_KEY))
      if (Number.isFinite(local) && local > 0) {
        setJoined(new Date(local).toLocaleDateString([], { month: 'short', year: 'numeric' }))
      }
    }).catch(() => { /* fall back to local first-seen date */ })
  }, [])

  const saveTapeIntro = (meta: { id: string; durationMs: number }) => {
    const next = { ...meta, recordedAt: Date.now() }
    setTapeIntro(next)
    setTapeRecording(false)
    writeLocal('ecosphere:tapeIntro', JSON.stringify(next))
    void listLocalRecordings().then(rows => setEchoes(rows.sort((a, b) => b.createdAt - a.createdAt))).catch(() => { /* keep current echoes */ })
  }
  useEffect(() => {
    void listLocalRecordings().then(rows => setEchoes(rows.sort((a, b) => b.createdAt - a.createdAt))).catch(() => { /* none stored / store unavailable */ })
  }, [])

  const echoBlobFor = (id: string): Blob | null => echoes.find(e => e.id === id)?.blob ?? null

  // ── voice prompts: deep questions answered out loud, shared or kept ──
  const [voiceAnswers, setVoiceAnswers] = useState<Array<{ id: string; prompt: string; durationMs: number; recordedAt: number; shared: boolean }>>(() => {
    try { return JSON.parse(window.localStorage.getItem('ecosphere:voicePrompts') ?? '[]') } catch { return [] }
  })
  const persistVoiceAnswers = (next: Array<{ id: string; prompt: string; durationMs: number; recordedAt: number; shared: boolean }>) => {
    setVoiceAnswers(next)
    try { window.localStorage.setItem('ecosphere:voicePrompts', JSON.stringify(next)) } catch { /* session only */ }
  }
  const [promptShuffle, setPromptShuffle] = useState(0)
  const [promptRecording, setPromptRecording] = useState(false)
  const dayIndex = Math.floor(Date.now() / 86400000)
  const answeredPrompts = voiceAnswers.map(a => a.prompt)
  const openPrompts = VOICE_PROMPTS.filter(p => !answeredPrompts.includes(p))
  const featuredPrompt = openPrompts.length > 0 ? openPrompts[(dayIndex + promptShuffle) % openPrompts.length] : null

  const deleteEcho = (id: string) => {
    // only drop it from the list once the store confirms — keep it on failure
    void deleteLocalRecording(id)
      .then(() => setEchoes(prev => prev.filter(e => e.id !== id)))
      .catch(() => { /* delete didn't take — leave the echo in place */ })
  }

  // ── listening history (last 7 days) ──
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const history = ecosystemState.listeningHistory.filter(entry => new Date(entry.playedAt).getTime() >= weekAgo).slice(0, 12)

  const relisten = (entry: { id: string; label: string }) => {
    void playSample(globalAudio, { id: `relisten-${entry.id}`, label: entry.label, source: 'pod' }, 'voice', entry.label.length * 31, 5000)
  }

  // ── capsule vault counts ──
  const personalCapsules = useMemo(() => {
    try { return (JSON.parse(window.localStorage.getItem('ecosphere:personalCapsules') ?? '[]') as unknown[]).length } catch { return 0 }
  }, [])
  const forming = useMemo(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem('ecosphere:capsuleForming') ?? '{}') as { readyAt?: number }
      return raw.readyAt != null && raw.readyAt > Date.now() ? 1 : 0
    } catch { return 0 }
  }, [])

  // one thing tonight: the hub's single suggested action, dismissable per day
  const [tonightDone, setTonightDone] = useState(() => {
    try { return window.localStorage.getItem('ecosphere:tonightDone') === localDayKey() } catch { return false }
  })
  const tonightAction = useMemo(() => pickTonightAction({
    recapAvailable: recapAvailable(),
    silentDays: silentDays(readLastVoiceAt()),
    topReturn: returns[0]?.label ?? null,
    personalCapsules,
    dropLive: currentDrop() != null,
  }), [returns, personalCapsules])
  const markTonightDone = () => {
    try { window.localStorage.setItem('ecosphere:tonightDone', localDayKey()) } catch { /* session only */ }
    setTonightDone(true)
  }


  // ── social stats: listeners / tuned to ──
  const [counts, setCounts] = useState<{ listeners: number; tunedTo: number }>({ listeners: 0, tunedTo: readTunedTo().length })
  useEffect(() => {
    if (!isSupabaseConfigured) return
    void getListenCounts().then(remote => {
      setCounts({ listeners: remote.listeners, tunedTo: Math.max(remote.tunedTo, readTunedTo().length) })
    })
  }, [])

  // the board: every card is a movable tile, order persisted on this device
  const tiles: Record<string, ReactNode> = {
    identity: (
        <div className="ph-card glass">
          <div className="ph-header-row">
            <h3 className="ph-username">◈ {username}</h3>
            <span className="ph-header-hz">
              <HzBadge hz={hzProfile.hz} displayName={hzProfile.displayName} color={hzProfile.color} />
              <button type="button" className="ph-hz-cog" title="hz signature settings" aria-label="hz signature settings" onClick={() => setHzSettingsOpen(true)}>⚙</button>
              <button type="button" className="ph-hz-cog" title="background settings" aria-label="background gradient settings" onClick={() => setGradientOpen(true)}>◰</button>
            </span>
          </div>
          {joined && <p className="ph-joined">on the band since {joined}</p>}
          {hzSettingsOpen && (
            <HzSettingsModal profile={hzProfile} onChange={(p) => { setHzProfile(p); fireMoment('identitySelect', () => momentIdentitySelect(p.hz)) }} onClose={() => setHzSettingsOpen(false)} />
          )}
          {gradientOpen && (
            <FrequencyGradientModal
              settings={gradient}
              hz={hzProfile.hz}
              onChange={setGradient}
              onClose={() => setGradientOpen(false)}
            />
          )}

          {/* tape intro: an answering machine — ten seconds, after the tone */}
          <div className="ph-tape ph-answerphone">
            <div className="ph-answerphone-head" aria-hidden="true">
              <span className={`ph-msg-light${tapeIntro ? ' on' : ''}`} />
              <span className="ph-answerphone-label">ANSWERING MACHINE</span>
              <span className="ph-msg-count">{tapeIntro ? '1 message' : 'no messages'}</span>
            </div>
            {tapeIntro && !tapeRecording ? (
              <>
                <div className="ph-tape-shell" aria-label="Your intro tape">
                  <span className="ph-cassette-spools" aria-hidden="true"><i /><i /></span>
                  <div className="ph-tape-body">
                    <span className="ph-tape-label">intro tape · {Math.max(1, Math.round(tapeIntro.durationMs / 1000))}s · {new Date(tapeIntro.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    {echoBlobFor(tapeIntro.id)
                      ? <AudioPlayer src={echoBlobFor(tapeIntro.id)!} seed={tapeIntro.recordedAt % 9973} durationSeconds={tapeIntro.durationMs / 1000} accent={hzProfile.color} />
                      : <span className="ph-tape-missing">this tape lives on the device that recorded it</span>}
                  </div>
                </div>
                <button type="button" className="ph-tape-rerecord" onClick={() => setTapeRecording(true)}>↻ record over it</button>
              </>
            ) : (
              <>
                {!tapeRecording && <p className="ph-tape-empty">no message yet. leave one after the tone — who's there?</p>}
                <AudioRecorder
                  kind="signal"
                  context="intro tape"
                  prompt="ten seconds, after the tone. say whatever a stranger should hear first."
                  minSeconds={3}
                  maxSeconds={10}
                  onComplete={({ durationMs, uploadId }) => saveTapeIntro({ id: uploadId, durationMs })}
                />
                {tapeRecording && (
                  <button type="button" className="ph-tape-rerecord" onClick={() => setTapeRecording(false)}>keep the old tape</button>
                )}
              </>
            )}
          </div>
        </div>
    ),
    echoes: (
        <div className="ph-card glass">
          <div className="ph-card-head">
            <span className="ph-card-kicker">ECHO ARCHIVE</span>
            <span className="ph-card-count">{echoes.length}</span>
          </div>
          {echoes.length === 0 && <p className="ph-empty">no echoes yet. your recordings gather here.</p>}
          <div className="ph-echo-list">
            {echoes.slice(0, echoLimit).map(echo => (
              <div key={echo.id} className="ph-echo">
                <div className="ph-echo-meta">
                  <span>{new Date(echo.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  <span>{Math.max(1, Math.round(echo.durationMs / 1000))}s</span>
                  <button type="button" className="ph-icon-btn ph-icon-btn--danger" title="delete echo" onClick={() => deleteEcho(echo.id)}>✕</button>
                </div>
                <AudioPlayer src={echo.blob} title={echo.label} seed={echo.createdAt % 9973} durationSeconds={echo.durationMs / 1000} accent={hzProfile.color} />
              </div>
            ))}
          </div>
          {echoes.length > echoLimit && (
            <button type="button" className="ph-load-more" onClick={() => setEchoLimit(n => n + ECHO_PAGE)}>load more</button>
          )}
        </div>
    ),
    tonightAction: !tonightDone && (
          <div className="ph-card glass ph-tonight-action">
            <div className="ph-card-head">
              <span className="ph-card-kicker">ONE THING TONIGHT</span>
              <button type="button" className="ph-tonight-skip" onClick={markTonightDone}>not tonight</button>
            </div>
            {tonightAction === 'recap' && (
              <button type="button" className="ph-tonight-btn" onClick={() => { markTonightDone(); onNavigate?.('home') }}>
                ◉ your frequency recap is ready — play it
              </button>
            )}
            {tonightAction === 'silence' && (
              <button type="button" className="ph-tonight-btn" onClick={() => { markTonightDone(); onNavigate?.('unsent') }}>
                ● break the silence — leave ten seconds in the unsent room
              </button>
            )}
            {tonightAction === 'return' && (
              <button type="button" className="ph-tonight-btn" onClick={() => { markTonightDone(); relisten({ id: `tonight-${returns[0].label}`, label: returns[0].label }) }}>
                ↻ return to "{returns[0]?.label}" one more time
              </button>
            )}
            {tonightAction === 'seal' && (
              <button type="button" className="ph-tonight-btn" onClick={() => { markTonightDone(); onNavigate?.('capsules') }}>
                ◎ seal your first transmission
              </button>
            )}
            {tonightAction === 'drop' && (
              <button type="button" className="ph-tonight-btn" onClick={() => { markTonightDone(); onNavigate?.('capsules') }}>
                ◬ a rare frequency is open — hear it before it dissolves
              </button>
            )}
            {tonightAction === 'drift' && (
              <button type="button" className="ph-tonight-btn" onClick={() => { markTonightDone(); onNavigate?.('frequencies') }}>
                ∿ drift the sea — something will float past
              </button>
            )}
          </div>
        ),
    tonight: (
        <div className="ph-card glass ph-recap">
          <div className="ph-card-head">
            <span className="ph-card-kicker">TONIGHT'S RECAP</span>
            <span className="ph-card-count">watched, kindly</span>
          </div>
          <div className="ph-recap-cards">
            {tonight.map((line, i) => (
              <div key={line} className="ph-recap-card" style={{ '--recap-idx': i } as CSSProperties}>
                <span className="ph-recap-wave" aria-hidden="true">
                  {Array.from({ length: 9 }, (_, b) => (
                    <b key={b} style={{ '--rw-h': `${25 + ((line.length * (b + 3) * 13) % 65)}%`, '--rw-d': `${(b % 5) * 0.14}s` } as CSSProperties} />
                  ))}
                </span>
                {line}
              </div>
            ))}
          </div>
          {memories.length > 0 && (
            <div className="ph-memory">
              {memories.map(line => <p key={line}>{line}</p>)}
            </div>
          )}
          <div className="ph-nights" aria-label="active nights, last 14 days">
            {activeNights.map(day => (
              <i
                key={day.start}
                title={`${new Date(day.start).toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${day.plays} replay${day.plays === 1 ? '' : 's'}`}
                style={{ opacity: day.plays === 0 ? 0.12 : 0.3 + (day.plays / maxNightPlays) * 0.7 } as CSSProperties}
              />
            ))}
            <span>active nights · 14d</span>
          </div>
        </div>
    ),
    history: (
        <div className="ph-card glass">
          <div className="ph-card-head">
            <span className="ph-card-kicker">LISTENING HISTORY</span>
            <span className="ph-card-count">7 days</span>
          </div>
          {history.length === 0 && <p className="ph-empty">nothing replayed this week. the band waits.</p>}
          <ul className="ph-history ph-history--memories">
            {history.map((entry, i) => {
              const playCount = ecosystemState.listeningHistory.filter(l => (l.label ?? l.id) === (entry.label ?? entry.id)).length
              const ageHours = (Date.now() - new Date(entry.playedAt).getTime()) / 3600000
              const trace = playCount > 2 ? 'returned again' : ageHours < 6 ? 'still resonating' : ageHours < 48 ? 'faded gently' : 'almost archived'
              const seed = (entry.label ?? entry.id).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 3)
              return (
                <li key={entry.id} style={{ '--mem-idx': i } as CSSProperties}>
                  <span className="ph-mem-wave" aria-hidden="true">
                    {Array.from({ length: 11 }, (_, b) => (
                      <b key={b} style={{ height: `${20 + ((seed * (b + 2) * 17) % 70)}%` }} />
                    ))}
                  </span>
                  <span className="ph-history-label">{entry.label}</span>
                  <span className="ph-mem-trace">{trace}{playCount > 1 ? ` · ${playCount}×` : ''}</span>
                  <span className="ph-history-date">{new Date(entry.playedAt).toLocaleDateString([], { weekday: 'short' })}</span>
                  <button type="button" onClick={() => relisten(entry)}>↻ relisten</button>
                </li>
              )
            })}
          </ul>
        </div>
    ),
    featured: (
        <div className="ph-card glass ph-featured">
          <div className="ph-card-head">
            <span className="ph-card-kicker">FREQUENCY ANTHEM</span>
            {featured && <button type="button" className="ph-featured-clear" onClick={clearFeatured}>unpin</button>}
          </div>
          {featured ? (
            <div className="ph-featured-now">
              <button type="button" className="ph-featured-play" aria-label="play your frequency anthem" onClick={playFeatured}>▶</button>
              <div className="ph-featured-meta">
                <strong>{featured.label}</strong>
                <em>{Math.max(1, Math.round(featured.durationMs / 1000))}s · plays first when someone tunes in</em>
              </div>
            </div>
          ) : featuredPicker ? (
            <div className="ph-featured-picker">
              {featuredOptions.length === 0 ? (
                <p className="ph-empty">no recordings yet — leave one in the Dashboard, then pin it here.</p>
              ) : featuredOptions.map(rec => (
                <button key={rec.id} type="button" className="ph-featured-option" onClick={() => pinFeatured(rec)}>
                  <span>{rec.label}</span>
                  <em>{Math.max(1, Math.round(rec.durationMs / 1000))}s</em>
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className="ph-featured-add" onClick={openFeaturedPicker}>
              ◈ pin a signal as your frequency anthem
            </button>
          )}
        </div>
    ),
    wall: returns.length > 0 && (
          <div className="ph-card glass">
            <div className="ph-card-head">
              <span className="ph-card-kicker">THE WALL OF RETURNS</span>
              <span className="ph-card-count">chosen by your replays</span>
            </div>
            <div className="ph-returns">
              {returns.map(item => {
                const wear = item.count / maxReturnCount
                return (
                  <button
                    key={item.label}
                    type="button"
                    className="ph-cassette"
                    style={{ '--wear': wear.toFixed(2) } as CSSProperties}
                    title={`returned ${item.count} times — relisten`}
                    onClick={() => relisten({ id: `return-${item.label}`, label: item.label })}
                  >
                    <span className="ph-cassette-spools" aria-hidden="true"><i /><i /></span>
                    <span className="ph-cassette-label">{item.label}</span>
                    <span className="ph-cassette-count">
                      {item.count >= 5 ? `you came back to this ${item.count} times` : item.count >= 3 ? `still replaying after days · ${item.count}×` : 'you never archived this one'}
                    </span>
                    <span className="ph-cassette-wear" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </div>
        ),
    shelf: (recoveredFragments > 0 || ecosystemState.savedSignals.length > 0) && (
          <div className="ph-card glass">
            <div className="ph-card-head">
              <span className="ph-card-kicker">FROM THE SHELF</span>
            </div>
            {recoveredFragments > 0 && (
              <p className="ph-shelf-line">
                {recoveredFragments} fragment{recoveredFragments === 1 ? '' : 's'} recovered from dead zones
              </p>
            )}
            {ecosystemState.savedSignals.length > 0 && (
              <p className="ph-shelf-line">
                {ecosystemState.savedSignals.length} trace{ecosystemState.savedSignals.length === 1 ? '' : 's'} kept from the feed
              </p>
            )}
          </div>
        ),
    vault: (
        <div className="ph-card glass">
          <div className="ph-card-head">
            <span className="ph-card-kicker">CAPSULE VAULT</span>
          </div>
          <div className="ph-vault-row">
            <button type="button" className="ph-vault-stat" onClick={() => onNavigate?.('capsules')}>
              <strong>{personalCapsules}</strong>
              <span>sealed transmissions</span>
            </button>
            <button type="button" className="ph-vault-stat" onClick={() => onNavigate?.('capsules')}>
              <strong>{forming}</strong>
              <span>still forming</span>
            </button>
          </div>
        </div>
    ),
    reach: (
        <div className="ph-card glass">
          <div className="ph-card-head">
            <span className="ph-card-kicker">SIGNAL REACH</span>
          </div>
          <div className="ph-vault-row">
            <div className="ph-vault-stat ph-vault-stat--static">
              <strong>{counts.listeners}</strong>
              <span>listeners</span>
            </div>
            <div className="ph-vault-stat ph-vault-stat--static">
              <strong>{counts.tunedTo}</strong>
              <span>tuned to</span>
            </div>
          </div>
          <p className="ph-hint">tune to carriers from the observatory's active carriers panel.</p>
        </div>
    ),
    prompts: (
        <div className="ph-card glass ph-prompts">
          <div className="ph-card-head">
            <span className="ph-card-kicker">VOICE PROMPTS</span>
            <span className="ph-card-count">{voiceAnswers.length} answered</span>
          </div>
          {featuredPrompt ? (
            <>
              <p className="ph-prompt-question">“{featuredPrompt}”</p>
              {promptRecording ? (
                <>
                  <AudioRecorder
                    kind="signal"
                    context="voice prompt"
                    prompt={featuredPrompt}
                    minSeconds={3}
                    maxSeconds={15}
                    onComplete={({ durationMs, uploadId }) => {
                      persistVoiceAnswers([{ id: uploadId, prompt: featuredPrompt, durationMs, recordedAt: Date.now(), shared: false }, ...voiceAnswers])
                      setPromptRecording(false)
                    }}
                  />
                  <button type="button" className="ph-prompt-skip" onClick={() => setPromptRecording(false)}>not this one</button>
                </>
              ) : (
                <div className="ph-prompt-actions">
                  <button type="button" className="ph-prompt-answer" onClick={() => setPromptRecording(true)}>● answer out loud — 30s max</button>
                  <button type="button" className="ph-prompt-shuffle" title="different question" onClick={() => setPromptShuffle(n => n + 1)}>↻ ask me something else</button>
                </div>
              )}
              <p className="ph-prompt-note">answers stay private unless you put them on your page.</p>
            </>
          ) : (
            <p className="ph-empty">you've answered every question the band has. more arrive eventually.</p>
          )}
          {voiceAnswers.length > 0 && (
            <div className="ph-prompt-list">
              {voiceAnswers.map(answer => (
                <div key={answer.id} className="ph-prompt-entry">
                  <p className="ph-prompt-entry-q">“{answer.prompt}”</p>
                  {echoBlobFor(answer.id)
                    ? <AudioPlayer src={echoBlobFor(answer.id)!} seed={answer.recordedAt % 9973} durationSeconds={answer.durationMs / 1000} accent={hzProfile.color} />
                    : <span className="ph-tape-missing">this answer lives on the device that recorded it</span>}
                  <div className="ph-prompt-entry-row">
                    <button
                      type="button"
                      className={`ph-prompt-share${answer.shared ? ' on' : ''}`}
                      onClick={() => persistVoiceAnswers(voiceAnswers.map(a => (a.id === answer.id ? { ...a, shared: !a.shared } : a)))}
                    >
                      {answer.shared ? '◉ on your page' : '◌ just for you'}
                    </button>
                    <button
                      type="button"
                      className="ph-icon-btn ph-icon-btn--danger"
                      title="delete this answer"
                      onClick={() => persistVoiceAnswers(voiceAnswers.filter(a => a.id !== answer.id))}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    ),
    tuning: (
        <div className="ph-card glass">
          <div className="ph-card-head">
            <span className="ph-card-kicker">TUNING</span>
          </div>
          <div className="ph-settings-links">
            <button type="button" onClick={() => setOnboarding(true)}>✧ set up your profile — guided</button>
            <button type="button" onClick={() => setHzSettingsOpen(true)}>✦ shift signal colors</button>
            <button type="button" onClick={() => setGradientOpen(true)}>◰ tune your atmosphere</button>
            <button type="button" onClick={() => setSigilOpen(open => !open)}>◈ choose your sigil — no photos here, ever</button>
          </div>
          {sigilOpen && (
            <div className="ph-sigil-themes">
              {SIGIL_THEMES.map(theme => (
                <div key={theme.id} className="ph-sigil-theme">
                  <div className="ph-sigil-theme-head">
                    <strong>{theme.label}</strong>
                    <em>{theme.line}</em>
                  </div>
                  <div className="ph-sigil-picker" role="radiogroup" aria-label={theme.label}>
                    {sigilsInTheme(theme.id).map(sigil => (
                      <button
                        key={sigil.id}
                        type="button"
                        role="radio"
                        aria-checked={avatar === sigil.id}
                        className={`ph-sigil-option${avatar === sigil.id ? ' active' : ''}${settling === sigil.id ? ' settling' : ''}`}
                        title={sigil.label}
                        style={{ '--sigil-color': hzProfile.color } as CSSProperties}
                        onClick={() => chooseSigil(sigil.id)}
                      >
                        {sigil.id === 'hz' ? <small>{hzProfile.hz.toFixed(0)}hz</small> : sigil.glyph}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="ph-settings-links">
            <button type="button" onClick={() => onNavigate?.('settings')}>◌ lower your signal visibility</button>
            <button type="button" onClick={() => onNavigate?.('settings')}>⬡ drift invisibly</button>
            <button type="button" onClick={() => onNavigate?.('settings')}>✕ disappear from the band</button>
          </div>
        </div>
    ),
  }


  // pinterest-board layout: tile order is yours, saved per device
  const [boardOrder, setBoardOrder] = useState<string[]>(() => {
    const defaults = ['identity', 'featured', 'tonightAction', 'prompts', 'echoes', 'tonight', 'history', 'wall', 'shelf', 'vault', 'reach', 'tuning']
    try {
      const stored = JSON.parse(window.localStorage.getItem('ecosphere:hubBoard') ?? '[]') as string[]
      const valid = stored.filter(id => defaults.includes(id))
      return [...valid, ...defaults.filter(id => !valid.includes(id))]
    } catch {
      return defaults
    }
  })
  const [arranging, setArranging] = useState(false)
  const moveTile = (id: string, dir: -1 | 1) => {
    setBoardOrder(prev => {
      const idx = prev.indexOf(id)
      const swap = idx + dir
      if (idx < 0 || swap < 0 || swap >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      try { window.localStorage.setItem('ecosphere:hubBoard', JSON.stringify(next)) } catch { /* session only */ }
      return next
    })
  }
  return (
    <section className="profile-hub atmo-grain" aria-label="Profile hub" style={moodVars as CSSProperties}>
      {onboarding && (
        <ProfileOnboarding
          accentColor={hzProfile.color}
          onDone={() => {
            fireMoment('onboardDone', momentOnboardStep)
            setGradient(readGradientSettings())
            setAvatar(readAvatar())
            setMoodVars(moodToVars(readMood()))
            setOnboarding(false)
          }}
        />
      )}
      {privateProfile && (
        <div className="ph-private-chip">
          ⬡ hidden from the band — only you can see this page right now
        </div>
      )}
      <div
        className="ph-gradient-layer"
        aria-hidden="true"
        style={gradient.style === 'gradient'
          ? { background: `linear-gradient(${Math.round(gradientAngle)}deg, ${gradientStart}, ${gradientEnd})` }
          : { background: '#06080f' }}
      >
        {gradient.style === 'wave' && (
          <ColorWave variant="local" colors={[gradientStart, gradientEnd, hzProfile.color]} />
        )}
        {gradient.style !== 'gradient' && gradient.style !== 'wave' && (
          <ProfileScene design={gradient.style} colors={[gradientStart, gradientEnd, hzProfile.color]} />
        )}
      </div>
      {liveVisitor && (
        <>
          <span className="ph-live-comet" aria-hidden="true" style={{ '--comet-color': hzProfile.color } as CSSProperties} />
          <div className="ph-live-visitor" role="status">
            <i aria-hidden="true" />
            {liveVisitor.tag} is on your page right now
          </div>
        </>
      )}
      {grains.length > 0 && (
        <div
          className="ph-visitor-static"
          aria-hidden="true"
          title="the static is everyone who passed through your frequency in the last 24 hours"
        >
          {grains.map((grain, index) => (
            <i
              key={index}
              style={{
                left: `${grain.x}%`,
                top: `${grain.y}%`,
                width: `${grain.size}px`,
                height: `${grain.size}px`,
                opacity: grain.opacity,
              }}
            />
          ))}
        </div>
      )}

      {/* centerpiece: the identity ring — your frequency, breathing (public profile) */}
      {variant === 'profile' && (
      <div className={`ph-centerpiece${settling ? ' ph-centerpiece--settling' : ''}`}>
        <div className={`ph-ring${ecosystemState.activeAudio ? ' ph-ring--live' : ''}`} style={{ '--ring-color': hzProfile.color } as CSSProperties} aria-hidden="true">
          <div className="ph-ring-bars">
            {Array.from({ length: 36 }, (_, i) => (
              <i
                key={i}
                style={{
                  '--bar-angle': `${i * 10}deg`,
                  '--bar-scale': `${0.35 + (((Math.round(hzProfile.hz * 10) * (i + 7)) % 60) / 100)}`,
                  '--bar-delay': `${(i % 9) * 0.35}s`,
                } as CSSProperties}
              />
            ))}
          </div>
          <div className="ph-ring-center">
            {avatar === 'hz' ? (
              <>
                <strong>{hzProfile.hz.toFixed(1)}</strong>
                <span>Hz</span>
              </>
            ) : (
              <span className="ph-sigil" style={{ color: hzProfile.color }}>{sigilGlyph(avatar)}</span>
            )}
          </div>
        </div>
        <div className="ph-identity">
          <span className="ph-identity-kicker">YOUR SIGNAL IDENTITY</span>
          <div className="ph-atmosphere" role="status">
            <i aria-hidden="true" />
            {atmosphere}
          </div>
          {traits.length > 0 ? (
            <ul className="ph-traits">
              {traits.map(trait => (
                <li key={trait}>
                  <span className="ph-trait-wave" aria-hidden="true"><b /><b /><b /><b /></span>
                  {trait}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ph-empty">the ecosystem is still learning how you listen.</p>
          )}
          <div className="ph-identity-readout">
            <div className="ph-readout-group ph-readout-group--chosen">
              <span className="ph-readout-label">chosen by you</span>
              <dl>
                <div className="ph-readout-name">
                  <dt>signal name</dt>
                  <dd>
                    {editingName ? (
                      <span className="ph-name-edit">
                        <input
                          type="text"
                          autoFocus
                          maxLength={40}
                          value={nameDraft}
                          aria-label="rename your signal"
                          placeholder="your signal name"
                          onChange={e => { setNameDraft(e.target.value); setNameError(null) }}
                          onKeyDown={e => { if (e.key === 'Enter') void commitRename(); if (e.key === 'Escape') { setEditingName(false); setNameError(null) } }}
                        />
                        <button type="button" className="ph-name-save" disabled={renaming} onClick={() => void commitRename()}>{renaming ? '…' : 'set'}</button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="ph-name-current"
                        title="rename your signal"
                        onClick={() => { setNameDraft(username === 'unclaimed frequency' ? '' : username); setEditingName(true) }}
                      >
                        {username} <span aria-hidden="true">✎</span>
                      </button>
                    )}
                  </dd>
                </div>
                {nameError && <div className="ph-readout-error"><dd role="alert">{nameError}</dd></div>}
                <div><dt>sigil</dt><dd>{avatar === 'hz' ? `${hzProfile.hz.toFixed(0)}hz` : sigilGlyph(avatar)}</dd></div>
                <div className="ph-readout-status">
                  <dt>broadcasting</dt>
                  <dd>
                    {editingStatus ? (
                      <span className="ph-name-edit">
                        <input
                          type="text"
                          autoFocus
                          maxLength={80}
                          value={statusDraft}
                          aria-label="set your status"
                          placeholder="now broadcasting…"
                          onChange={e => { setStatusDraft(e.target.value); setStatusError(null) }}
                          onKeyDown={e => { if (e.key === 'Enter') commitStatus(); if (e.key === 'Escape') { setEditingStatus(false); setStatusError(null) } }}
                        />
                        <button type="button" className="ph-name-save" onClick={commitStatus}>set</button>
                      </span>
                    ) : (
                      <button type="button" className="ph-name-current" title="set your status" onClick={() => { setStatusDraft(status); setEditingStatus(true) }}>
                        {status || 'set a status'} <span aria-hidden="true">✎</span>
                      </button>
                    )}
                  </dd>
                </div>
                {statusError && <div className="ph-readout-error"><dd role="alert">{statusError}</dd></div>}
              </dl>
            </div>
            <div className="ph-readout-group ph-readout-group--sensed">
              <span className="ph-readout-label">how you listen · sensed by the band</span>
              <dl>
                <div><dt>signature frequency</dt><dd>{hzProfile.hz.toFixed(1)} Hz · {hzProfile.displayName}</dd></div>
                <div><dt>emotional weather</dt><dd>{atmosphere}</dd></div>
                <div><dt>listening pattern</dt><dd>{listeningPattern}</dd></div>
                <div><dt>active hours</dt><dd>{activeHoursLabel}</dd></div>
                <div><dt>replay tendency</dt><dd>{replayTendency}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </div>
      )}

      {constellation.length > 0 && (
        <div className="ph-constellation" aria-label="Your constellation">
          <span className="ph-constellation-kicker">YOUR CONSTELLATION · found by harmony</span>
          <div className="ph-constellation-stars">
            {constellation.map(h => (
              <button
                key={h.handle}
                type="button"
                className={`ph-constellation-star${h.mutual ? ' ph-constellation-star--mutual' : ''}`}
                style={{ '--star-color': h.color } as CSSProperties}
                title={`${h.interval}${h.mutual ? ' · you answered each other' : ''}`}
                onClick={() => window.dispatchEvent(new CustomEvent('ecosphere:viewCarrier', { detail: { handle: h.handle } }))}
              >
                <i aria-hidden="true">{h.mutual ? '✦' : '✧'}</i>
                {h.handle}
                <em>{h.interval.replace(' apart', '')}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ph-board-bar">
        <button type="button" className={`ph-arrange-toggle${arranging ? ' on' : ''}`} onClick={() => setArranging(a => !a)}>
          {arranging ? '✓ done arranging' : '✥ arrange your board'}
        </button>
      </div>
      <div className={`ph-board${arranging ? ' ph-board--arranging' : ''}`}>
        {boardOrder.filter(id => allowedTiles.includes(id)).map(tileId => {
          const tile = tiles[tileId]
          if (!tile) return null
          return (
            <div key={tileId} className="ph-tile">
              {arranging && (
                <div className="ph-tile-handle" aria-label="move this card">
                  <button type="button" aria-label="move earlier" onClick={() => moveTile(tileId, -1)}>◀</button>
                  <button type="button" aria-label="move later" onClick={() => moveTile(tileId, 1)}>▶</button>
                </div>
              )}
              {tile}
            </div>
          )
        })}
      </div>
    </section>
  )
}
