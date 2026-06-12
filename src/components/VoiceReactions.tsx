import { createVoiceRecorder } from '../lib/audioBudget'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useEcosystemState } from '../hooks/useEcosystemState'
import { useGlobalAudio } from '../hooks/useGlobalAudio'
import { deleteReactionAudio, listReactionAudio, saveReactionAudio } from '../lib/localAudioStore'
import { anonymousMode } from '../lib/anonymity'
import { sendLive } from '../lib/liveBus'
import { playImprintSound, renderSampleAudio } from '../lib/sampleAudio'
import type { ImprintKind } from '../lib/sampleAudio'
import './VoiceReactions.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReactionKind = 'voice' | 'laugh' | 'static' | 'whisper'
type ReactionFilter = 'none' | 'slowed' | 'sped'

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
  /** legacy small recordings stored inline */
  dataUrl?: string
  filter?: ReactionFilter
  /** legacy flag, mapped to filter: 'slowed' */
  distorted?: boolean
  yours?: boolean
}

type RecorderPhase = 'idle' | 'recording' | 'preview' | 'denied'

const MAX_REACTION_MS = 5000

const FILTER_RATES: Record<ReactionFilter, number> = { none: 1, slowed: 0.82, sped: 1.32 }
const FILTER_LABELS: Record<ReactionFilter, string> = { none: 'raw', slowed: 'slowed', sped: 'sped' }
const FILTER_ORDER: ReactionFilter[] = ['none', 'slowed', 'sped']

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

// ─── Metadata persistence (audio lives in IndexedDB) ─────────────────────────

function storageKey(signalId: string) {
  return `ecosphere:voiceReactions:${signalId}`
}

function loadStoredMeta(signalId: string): VoiceReaction[] {
  try {
    const raw = window.localStorage.getItem(storageKey(signalId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((r: VoiceReaction) => ({
      ...r,
      filter: r.filter ?? (r.distorted ? 'slowed' : 'none'),
    }))
  } catch {
    return []
  }
}

function storeMeta(signalId: string, reactions: VoiceReaction[]) {
  try {
    const yours = reactions.filter(r => r.yours).map(({ ...r }) => {
      // dataUrl is legacy-only; never re-store large payloads
      if (r.dataUrl && r.dataUrl.length > 80_000) delete r.dataUrl
      return r
    })
    window.localStorage.setItem(storageKey(signalId), JSON.stringify(yours))
  } catch { /* storage unavailable — session-only reactions */ }
}

// ─── Imprints: one-tap reactions that are sounds, not icons ──────────────────
const IMPRINTS: Array<{ kind: ImprintKind; glyph: string; label: string; title: string }> = [
  { kind: 'felt', glyph: '⌁', label: 'felt that', title: 'a heartbeat — this landed' },
  { kind: 'same', glyph: '〰', label: 'same', title: 'two knocks — me too' },
  { kind: 'here', glyph: '◌', label: 'here', title: 'a hum — you are not alone' },
  { kind: 'again', glyph: '↺', label: 'again', title: 'a rewind — made me replay it' },
  { kind: 'loud', glyph: '※', label: 'loud', title: 'a laugh — this got me' },
]

function loadImprints(signalId: string): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(`ecosphere:imprints:${signalId}`)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function storeImprints(signalId: string, counts: Record<string, number>) {
  try {
    window.localStorage.setItem(`ecosphere:imprints:${signalId}`, JSON.stringify(counts))
  } catch { /* session only */ }
}

function seedImprints(signalId: string): Record<string, number> {
  const seed = seedFromId(signalId)
  const rand = seededRand(seed + 3)
  const counts: Record<string, number> = {}
  IMPRINTS.forEach(im => {
    const n = Math.floor(rand() * 9)
    if (n > 1) counts[im.kind] = n
  })
  return counts
}

// Only one reaction audible anywhere in the app
let stopActiveReaction: (() => void) | null = null

function applyFilter(audio: HTMLAudioElement, filter: ReactionFilter | undefined) {
  const rate = FILTER_RATES[filter ?? 'none']
  if (rate !== 1) {
    audio.playbackRate = rate
    try {
      ;(audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false
    } catch { /* not supported */ }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VoiceReactionStack({ signalId, moodColor }: { signalId: string; moodColor: string }) {
  const { reactToSignal, saveToLibrary } = useEcosystemState()
  const globalAudio = useGlobalAudio()

  const [reactions, setReactions] = useState<VoiceReaction[]>(() => [
    ...loadStoredMeta(signalId),
    ...buildMockReactions(signalId),
  ])
  const [expanded, setExpanded] = useState(false)
  const [sortBy, setSortBy] = useState<'newest' | 'replayed'>('newest')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  // global anonymous mode (Settings) seeds the per-reaction choice
  const [anonymous, setAnonymous] = useState(() => anonymousMode())
  const [filter, setFilter] = useState<ReactionFilter>('none')
  const [notice, setNotice] = useState<string | null>(null)
  const [imprints, setImprints] = useState<Record<string, number>>(() => {
    const seeded = seedImprints(signalId)
    const mine = loadImprints(signalId)
    const merged: Record<string, number> = { ...seeded }
    Object.entries(mine).forEach(([k, v]) => { merged[k] = (merged[k] ?? 0) + v })
    return merged
  })
  const [imprintPop, setImprintPop] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const draftRef = useRef<{ blob: Blob; durationMs: number } | null>(null)
  const timersRef = useRef<number[]>([])
  const playbackRef = useRef<HTMLAudioElement | null>(null)
  const blobCacheRef = useRef<Map<string, Blob>>(new Map())
  const objectUrlRef = useRef<string | null>(null)

  // restore reaction audio blobs from IndexedDB
  useEffect(() => {
    let cancelled = false
    void listReactionAudio(signalId).then(stored => {
      if (cancelled || stored.length === 0) return
      stored.forEach(r => blobCacheRef.current.set(r.id, r.blob))
      setReactions(prev => {
        const known = new Set(prev.map(p => p.id))
        const restored: VoiceReaction[] = stored
          .filter(r => !known.has(r.id))
          .map(r => ({
            id: r.id,
            kind: 'voice' as const,
            caption: null,
            handle: r.anonymous ? 'anonymous' : 'you',
            durationMs: r.durationMs,
            waveformSeed: r.createdAt % 9973,
            replays: 0,
            createdAt: r.createdAt,
            filter: r.filter,
            yours: true,
          }))
        return restored.length ? [...restored, ...prev] : prev
      })
    })
    return () => { cancelled = true }
  }, [signalId])

  // persist replay counts / list changes for your reactions
  useEffect(() => {
    storeMeta(signalId, reactions)
  }, [signalId, reactions])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(t => { window.clearTimeout(t); window.clearInterval(t) })
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (playbackRef.current) {
        playbackRef.current.pause()
        playbackRef.current = null
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
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
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    timersRef.current.forEach(t => { window.clearTimeout(t); window.clearInterval(t) })
    setPlayingId(null)
    setProgress(0)
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
    setProgress(0)

    void (async () => {
    let blob = blobCacheRef.current.get(reaction.id)
    if (!blob && !reaction.dataUrl) {
      // mock reactions speak too: render a seeded sample on first play
      const sampleKind = reaction.kind === 'voice' ? 'voice' : reaction.kind
      const rendered = await renderSampleAudio(sampleKind, reaction.waveformSeed, reaction.durationMs)
      if (rendered) {
        blob = rendered
        blobCacheRef.current.set(reaction.id, rendered)
      }
    }
    const src = blob ? URL.createObjectURL(blob) : reaction.dataUrl

    if (src) {
      if (blob) objectUrlRef.current = src
      const audio = new Audio(src)
      playbackRef.current = audio
      applyFilter(audio, reaction.filter)
      audio.ontimeupdate = () => {
        if (audio.duration > 0 && Number.isFinite(audio.duration)) {
          setProgress(audio.currentTime / audio.duration)
        }
      }
      const finish = () => {
        setPlayingId(p => (p === reaction.id ? null : p))
        setProgress(0)
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current)
          objectUrlRef.current = null
        }
      }
      audio.onended = finish
      audio.onerror = finish
      audio.play().catch(finish)
    } else {
      // mock reactions: simulated playback with transcript shimmer + progress
      const started = Date.now()
      const interval = window.setInterval(() => {
        setProgress(Math.min(1, (Date.now() - started) / reaction.durationMs))
      }, 100)
      timersRef.current.push(interval as unknown as number)
      timersRef.current.push(window.setTimeout(() => {
        window.clearInterval(interval)
        setPlayingId(p => (p === reaction.id ? null : p))
        setProgress(0)
      }, reaction.durationMs))
    }
    })()
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
      const recorder = createVoiceRecorder(stream)
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
    setFilter('none')
  }

  const replayDraft = () => {
    const draft = draftRef.current
    if (!draft) return
    stopActiveReaction?.()
    const url = URL.createObjectURL(draft.blob)
    const audio = new Audio(url)
    playbackRef.current = audio
    applyFilter(audio, filter)
    audio.onended = () => URL.revokeObjectURL(url)
    audio.play().catch(() => URL.revokeObjectURL(url))
  }

  const cycleFilter = () => {
    setFilter(f => FILTER_ORDER[(FILTER_ORDER.indexOf(f) + 1) % FILTER_ORDER.length])
  }

  const finalizeDraft = async (target: 'signal' | 'drift') => {
    const draft = draftRef.current
    if (!draft) return

    const id = `you-${Date.now()}`
    const stored = await saveReactionAudio({
      id,
      target: target === 'drift' ? 'drift' : signalId,
      durationMs: draft.durationMs,
      createdAt: Date.now(),
      anonymous,
      filter,
      blob: draft.blob,
    })

    sendLive({ type: 'reaction', id: signalId })
    if (target === 'drift') {
      reactToSignal(signalId, 'sent a voice reaction into the drift')
      setNotice(stored ? 'released into the drift · someone may find it' : 'the drift kept it for this session only')
      timersRef.current.push(window.setTimeout(() => setNotice(null), 5000))
    } else {
      blobCacheRef.current.set(id, draft.blob)
      const reaction: VoiceReaction = {
        id,
        kind: 'voice',
        caption: null,
        handle: anonymous ? 'anonymous' : 'you',
        durationMs: draft.durationMs,
        waveformSeed: Date.now() % 9973,
        replays: 0,
        createdAt: Date.now(),
        filter,
        yours: true,
      }
      setReactions(prev => [reaction, ...prev])
      reactToSignal(signalId, anonymous ? 'left an anonymous voice reaction' : 'left a voice reaction')
      setExpanded(true)
    }

    draftRef.current = null
    setPhase('idle')
    setFilter('none')
  }

  const deleteOwnReaction = (reaction: VoiceReaction) => {
    if (playingId === reaction.id) stopReaction()
    blobCacheRef.current.delete(reaction.id)
    setReactions(prev => prev.filter(r => r.id !== reaction.id))
    void deleteReactionAudio(reaction.id)
  }

  const leaveImprint = (kind: ImprintKind) => {
    playImprintSound(kind)
    setImprints(prev => {
      const next = { ...prev, [kind]: (prev[kind] ?? 0) + 1 }
      const mine = loadImprints(signalId)
      storeImprints(signalId, { ...mine, [kind]: (mine[kind] ?? 0) + 1 })
      return next
    })
    setImprintPop(kind)
    timersRef.current.push(window.setTimeout(() => setImprintPop(p => (p === kind ? null : p)), 500))
    reactToSignal(signalId, `left a ${kind} imprint`)
  }

  const favoriteReaction = (reaction: VoiceReaction) => {
    saveToLibrary('audio', `reaction-${reaction.id}`, `voice reaction · ${reaction.handle} · ${formatSecs(reaction.durationMs)}`)
    setNotice('kept in your pod library')
    timersRef.current.push(window.setTimeout(() => setNotice(null), 3500))
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="vr-stack" style={{ '--vr-color': moodColor } as CSSProperties}>
      <div className="vr-row">
        {visible.map(reaction => {
          const isPlaying = playingId === reaction.id
          return (
            <span key={reaction.id} className="vr-pill-wrap">
              <button
                type="button"
                className={`vr-pill ${isPlaying ? 'vr-pill--playing' : ''} ${reaction.yours ? 'vr-pill--yours' : ''} vr-pill--${reaction.kind}`}
                style={isPlaying ? ({ '--vp': `${Math.round(progress * 100)}%` } as CSSProperties) : undefined}
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
                {isPlaying && <span className="vr-pill-progress" aria-hidden="true" />}
              </button>
              {expanded && (
                <span className="vr-pill-tools">
                  <button type="button" onClick={() => favoriteReaction(reaction)} aria-label="keep this reaction">✶</button>
                  {reaction.yours && (
                    <button type="button" onClick={() => deleteOwnReaction(reaction)} aria-label="delete your reaction">✕</button>
                  )}
                </span>
              )}
            </span>
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

      <div className="vr-imprints" aria-label="sound imprints">
        {IMPRINTS.map(im => (
          <button
            key={im.kind}
            type="button"
            title={im.title}
            className={`vr-imprint${imprintPop === im.kind ? ' pop' : ''}${(imprints[im.kind] ?? 0) > 0 ? ' has' : ''}`}
            onClick={() => leaveImprint(im.kind)}
          >
            <span aria-hidden="true">{im.glyph}</span>
            {im.label}
            {(imprints[im.kind] ?? 0) > 0 && <em>{imprints[im.kind]}</em>}
          </button>
        ))}
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
        const filterNote = active.filter && active.filter !== 'none' ? ` · ${FILTER_LABELS[active.filter]}` : ''
        return (
          <div className="vr-transcript" key={playingId}>
            <span className="vr-transcript-handle">{active.handle}</span>
            {active.caption ?? `(your voice reaction${filterNote})`}
          </div>
        )
      })()}

      {notice && <div className="vr-notice" key={notice}>{notice}</div>}

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
          <button type="button" className={`vr-rec-toggle ${filter !== 'none' ? 'on' : ''}`} onClick={cycleFilter}>
            ∿ {FILTER_LABELS[filter]}
          </button>
          <button type="button" className="vr-rec-send" onClick={() => { void finalizeDraft('signal') }}>send</button>
          <button type="button" className="vr-rec-drift" onClick={() => { void finalizeDraft('drift') }}>→ drift</button>
          <button type="button" className="vr-rec-discard" onClick={discardDraft}>✕</button>
        </div>
      )}

      {phase === 'denied' && (
        <div className="vr-recorder vr-recorder--denied">microphone unavailable · reaction not recorded</div>
      )}
    </div>
  )
}
