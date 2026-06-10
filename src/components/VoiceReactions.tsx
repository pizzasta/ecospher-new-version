import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useEcosystemState } from '../hooks/useEcosystemState'
import { useGlobalAudio } from '../hooks/useGlobalAudio'
import './VoiceReactions.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReactionKind = 'voice' | 'laugh' | 'static' | 'whisper'

type VoiceReaction = {
  id: string
  kind: ReactionKind
  /** mock transcript — only shown while the reaction is playing */
  caption: string | null
  handle: string
  durationMs: number
  waveformSeed: number
  replays: number
  createdAt: number
  dataUrl?: string
  distorted?: boolean
  yours?: boolean
}

type RecorderPhase = 'idle' | 'recording' | 'preview' | 'denied'

const MAX_REACTION_MS = 5000
const MAX_STORED_BYTES = 220_000

// ─── Mock reaction pool (seeded per signal) ──────────────────────────────────

const MOCK_REACTIONS: Array<{ kind: ReactionKind; caption: string; handle: string }> = [
  { kind: 'voice', caption: 'nah this one hurts', handle: 'sodacanecho' },
  { kind: 'voice', caption: 'why does this sound like 3am', handle: 'anonymous' },
  { kind: 'laugh', caption: '(laughing)', handle: 'blurrywafflehouse' },
  { kind: 'static', caption: '(four seconds of static)', handle: 'anonymous' },
  { kind: 'voice', caption: 'whoever made this… yeah', handle: 'leftoneearbudin' },
  { kind: 'voice', caption: 'this feels weirdly familiar', handle: 'anonymous' },
  { kind: 'whisper', caption: '(whispered) i replayed this twice', handle: 'porchlightorbit' },
  { kind: 'voice', caption: 'ok wait. play that again', handle: 'fridgehumat3am' },
  { kind: 'laugh', caption: '(one short laugh, then quiet)', handle: 'anonymous' },
  { kind: 'voice', caption: 'no because same', handle: 'dialtoneangel' },
  { kind: 'whisper', caption: '(too quiet to make out)', handle: 'anonymous' },
  { kind: 'voice', caption: 'this is somebody’s whole year', handle: 'reststopfog' },
]

function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return Math.abs(s) / 0x7fffffff
  }
}

function seedFromId(id: string) {
  return id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0) * 7, 13)
}

function buildMockReactions(signalId: string): VoiceReaction[] {
  const seed = seedFromId(signalId)
  const rand = seededRand(seed)
  const count = 2 + Math.floor(rand() * 4)
  const used = new Set<number>()
  const out: VoiceReaction[] = []
  for (let i = 0; i < count; i++) {
    let idx = Math.floor(rand() * MOCK_REACTIONS.length)
    while (used.has(idx)) idx = (idx + 1) % MOCK_REACTIONS.length
    used.add(idx)
    const m = MOCK_REACTIONS[idx]
    out.push({
      id: `${signalId}-mock-${idx}`,
      kind: m.kind,
      caption: m.caption,
      handle: m.handle,
      durationMs: Math.round(1200 + rand() * 3600),
      waveformSeed: seed + idx * 31,
      replays: Math.floor(rand() * 14),
      createdAt: Date.now() - Math.floor(rand() * 36_000_000),
    })
  }
  return out
}

function reactionBars(seedValue: number, bars = 14): number[] {
  const rand = seededRand(seedValue)
  return Array.from({ length: bars }, (_, i) => {
    const shape = Math.sin(i * 0.6 + seedValue * 0.03) * 0.25 + 0.55
    return Math.max(0.15, Math.min(1, rand() * shape + 0.18))
  })
}

function formatSecs(ms: number) {
  return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`
}

// ─── Persistence (metadata + small audio payloads only) ──────────────────────

function storageKey(signalId: string) {
  return `ecosphere:voiceReactions:${signalId}`
}

function loadStoredReactions(signalId: string): VoiceReaction[] {
  try {
    const raw = window.localStorage.getItem(storageKey(signalId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function storeReactions(signalId: string, reactions: VoiceReaction[]) {
  try {
    window.localStorage.setItem(storageKey(signalId), JSON.stringify(reactions.filter(r => r.yours)))
  } catch { /* storage unavailable — session-only reactions */ }
}

// Only one reaction audible anywhere in the app
let stopActiveReaction: (() => void) | null = null

// ─── Component ────────────────────────────────────────────────────────────────

export default function VoiceReactionStack({ signalId, moodColor }: { signalId: string; moodColor: string }) {
  const { reactToSignal } = useEcosystemState()
  const globalAudio = useGlobalAudio()

  const [reactions, setReactions] = useState<VoiceReaction[]>(() => [
    ...loadStoredReactions(signalId),
    ...buildMockReactions(signalId),
  ])
  const [expanded, setExpanded] = useState(false)
  const [sortBy, setSortBy] = useState<'newest' | 'replayed'>('newest')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [anonymous, setAnonymous] = useState(false)
  const [distorted, setDistorted] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const draftRef = useRef<{ blob: Blob; durationMs: number } | null>(null)
  const timersRef = useRef<number[]>([])
  const playbackRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(t => window.clearTimeout(t))
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (playbackRef.current) {
        playbackRef.current.pause()
        playbackRef.current = null
      }
    }
  }, [])

  const sorted = useMemo(() => {
    const copy = [...reactions]
    copy.sort((a, b) => (sortBy === 'newest' ? b.createdAt - a.createdAt : b.replays - a.replays))
    return copy
  }, [reactions, sortBy])

  const visible = expanded ? sorted : sorted.slice(0, 2)
  const hiddenCount = sorted.length - visible.length

  // ── playback ────────────────────────────────────────────────────────────────
  const stopReaction = () => {
    if (playbackRef.current) {
      playbackRef.current.pause()
      playbackRef.current = null
    }
    timersRef.current.forEach(t => window.clearTimeout(t))
    setPlayingId(null)
  }

  const playReaction = (reaction: VoiceReaction) => {
    if (playingId === reaction.id) {
      stopReaction()
      stopActiveReaction = null
      return
    }

    // one voice anywhere: silence the main signal and any other reaction
    globalAudio.stop()
    stopActiveReaction?.()
    stopActiveReaction = stopReaction

    setReactions(prev => prev.map(r => (r.id === reaction.id ? { ...r, replays: r.replays + 1 } : r)))
    setPlayingId(reaction.id)

    if (reaction.dataUrl) {
      const audio = new Audio(reaction.dataUrl)
      playbackRef.current = audio
      if (reaction.distorted) {
        audio.playbackRate = 0.82
        try {
          ;(audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false
        } catch { /* not supported */ }
      }
      audio.onended = () => { setPlayingId(p => (p === reaction.id ? null : p)) }
      audio.onerror = () => { setPlayingId(p => (p === reaction.id ? null : p)) }
      audio.play().catch(() => setPlayingId(p => (p === reaction.id ? null : p)))
    } else {
      // mock reactions: simulated playback with transcript shimmer
      timersRef.current.push(window.setTimeout(() => {
        setPlayingId(p => (p === reaction.id ? null : p))
      }, reaction.durationMs))
    }
  }

  // ── recording ───────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPhase('denied')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      const startedAt = Date.now()

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const durationMs = Math.min(MAX_REACTION_MS, Date.now() - startedAt)
        if (blob.size === 0) {
          setPhase('idle')
          return
        }
        draftRef.current = { blob, durationMs }
        setPhase('preview')
      }

      recorder.start(100)
      setElapsed(0)
      setPhase('recording')

      const tick = window.setInterval(() => setElapsed(e => e + 100), 100)
      timersRef.current.push(tick as unknown as number)
      timersRef.current.push(window.setTimeout(() => {
        window.clearInterval(tick)
        if (recorder.state === 'recording') recorder.stop()
      }, MAX_REACTION_MS))
    } catch {
      setPhase('denied')
      timersRef.current.push(window.setTimeout(() => setPhase('idle'), 4000))
    }
  }

  const stopRecording = () => {
    timersRef.current.forEach(t => { window.clearTimeout(t); window.clearInterval(t) })
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const discardDraft = () => {
    draftRef.current = null
    setPhase('idle')
    setDistorted(false)
  }

  const replayDraft = () => {
    const draft = draftRef.current
    if (!draft) return
    stopActiveReaction?.()
    const audio = new Audio(URL.createObjectURL(draft.blob))
    playbackRef.current = audio
    if (distorted) {
      audio.playbackRate = 0.82
      try {
        ;(audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false
      } catch { /* not supported */ }
    }
    audio.play().catch(() => { /* preview unavailable */ })
  }

  const sendDraft = async () => {
    const draft = draftRef.current
    if (!draft) return

    let dataUrl: string | undefined
    if (draft.blob.size <= MAX_STORED_BYTES) {
      dataUrl = await new Promise<string | undefined>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined)
        reader.onerror = () => resolve(undefined)
        reader.readAsDataURL(draft.blob)
      })
    }

    const reaction: VoiceReaction = {
      id: `you-${Date.now()}`,
      kind: 'voice',
      caption: null,
      handle: anonymous ? 'anonymous' : 'you',
      durationMs: draft.durationMs,
      waveformSeed: Date.now() % 9973,
      replays: 0,
      createdAt: Date.now(),
      dataUrl,
      distorted,
      yours: true,
    }

    setReactions(prev => {
      const next = [reaction, ...prev]
      storeReactions(signalId, next)
      return next
    })
    reactToSignal(signalId, anonymous ? 'left an anonymous voice reaction' : 'left a voice reaction')
    draftRef.current = null
    setPhase('idle')
    setDistorted(false)
    setExpanded(true)
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="vr-stack" style={{ '--vr-color': moodColor } as CSSProperties}>
      <div className="vr-row">
        {visible.map(reaction => {
          const isPlaying = playingId === reaction.id
          return (
            <button
              key={reaction.id}
              type="button"
              className={`vr-pill ${isPlaying ? 'vr-pill--playing' : ''} ${reaction.yours ? 'vr-pill--yours' : ''} vr-pill--${reaction.kind}`}
              onClick={() => playReaction(reaction)}
              aria-label={isPlaying ? 'stop reaction' : `play ${reaction.durationMs / 1000}s voice reaction from ${reaction.handle}`}
            >
              <span className="vr-pill-bars" aria-hidden="true">
                {reactionBars(reaction.waveformSeed).map((h, i) => (
                  <i key={i} style={{ '--h': `${Math.round(h * 100)}%`, '--d': `${(i % 7) * 0.08}s` } as CSSProperties} />
                ))}
              </span>
              <span className="vr-pill-meta">
                {formatSecs(reaction.durationMs)}
                {reaction.replays > 0 && <em> · {reaction.replays}↺</em>}
              </span>
            </button>
          )
        })}

        {hiddenCount > 0 && !expanded && (
          <button type="button" className="vr-more" onClick={() => setExpanded(true)}>
            +{hiddenCount} echoes
          </button>
        )}

        {phase === 'idle' && (
          <button type="button" className="vr-record" onClick={startRecording} aria-label="leave a voice reaction (max 5 seconds)">
            ◉ react
          </button>
        )}
      </div>

      {expanded && (
        <div className="vr-thread-meta">
          <button type="button" className={sortBy === 'newest' ? 'on' : ''} onClick={() => setSortBy('newest')}>newest</button>
          <button type="button" className={sortBy === 'replayed' ? 'on' : ''} onClick={() => setSortBy('replayed')}>most replayed</button>
          <button type="button" onClick={() => setExpanded(false)}>collapse</button>
        </div>
      )}

      {playingId && (() => {
        const active = reactions.find(r => r.id === playingId)
        if (!active) return null
        return (
          <div className="vr-transcript" key={playingId}>
            <span className="vr-transcript-handle">{active.handle}</span>
            {active.caption ?? (active.distorted ? '(your voice, slowed and lower)' : '(your voice reaction)')}
          </div>
        )
      })()}

      {phase === 'recording' && (
        <div className="vr-recorder vr-recorder--live">
          <span className="vr-rec-dot" aria-hidden="true" />
          <span className="vr-rec-bars" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <span className="vr-rec-time">{formatSecs(elapsed)} / 5s</span>
          <button type="button" className="vr-rec-stop" onClick={stopRecording}>done</button>
        </div>
      )}

      {phase === 'preview' && (
        <div className="vr-recorder vr-recorder--preview">
          <button type="button" className="vr-rec-action" onClick={replayDraft}>▶ replay</button>
          <button type="button" className={`vr-rec-toggle ${anonymous ? 'on' : ''}`} onClick={() => setAnonymous(a => !a)}>
            {anonymous ? '⬡ anon' : '◈ you'}
          </button>
          <button type="button" className={`vr-rec-toggle ${distorted ? 'on' : ''}`} onClick={() => setDistorted(d => !d)}>
            ∿ distort
          </button>
          <button type="button" className="vr-rec-send" onClick={() => { void sendDraft() }}>send</button>
          <button type="button" className="vr-rec-discard" onClick={discardDraft}>✕</button>
        </div>
      )}

      {phase === 'denied' && (
        <div className="vr-recorder vr-recorder--denied">microphone unavailable · reaction not recorded</div>
      )}
    </div>
  )
}
