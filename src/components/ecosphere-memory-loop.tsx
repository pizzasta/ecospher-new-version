import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, Dispatch, PointerEvent, SetStateAction } from 'react'
import './drift-notes.css'
import './relic-seeds.css'

export type DriftNoteState = 'private' | 'drifting' | 'anchored'
export type DriftRelicStage = 'held' | 'shared' | 'relic-seed'
export type DriftNoteReactionType = 'feltThat' | 'same' | 'here' | 'again'
export type DriftNoteReactions = Record<DriftNoteReactionType, number>

export type DriftNoteData = {
  id: string
  title: string
  body: string
  timestamp: string
  state: DriftNoteState
  relicStage: DriftRelicStage
  ageDays: number
  replayCount: number
  reactions: DriftNoteReactions
  survivalLine: string
  x: number
  y: number
  rotation: number
  tone: 'cream' | 'pink' | 'cyan' | 'amber' | 'graphite'
  tape?: 'top' | 'corner' | 'side'
}

export type TideReport = {
  id: string
  line: string
  createdAt: string
}

export const driftNotesStorageKey = 'ecosphereDriftNotes'

export const driftNotesSeed: DriftNoteData[] = [
  {
    id: 'late-night-signal',
    title: 'almost sent this',
    body: 'i keep editing the same sentence because the real one sounds too honest.',
    timestamp: '2:11am',
    state: 'private',
    relicStage: 'held',
    ageDays: 2,
    replayCount: 12,
    reactions: { feltThat: 3, same: 1, here: 2, again: 1 },
    survivalLine: 'held through one quiet morning',
    x: 8,
    y: 13,
    rotation: -2.4,
    tone: 'cream',
    tape: 'top',
  },
  {
    id: 'static-bloom-memory',
    title: 'parking lot memory',
    body: 'the radio was all static and somehow that made it easier to say nothing.',
    timestamp: '1:38am',
    state: 'drifting',
    relicStage: 'relic-seed',
    ageDays: 18,
    replayCount: 157,
    reactions: { feltThat: 28, same: 19, here: 31, again: 44 },
    survivalLine: 'survived the night and started becoming a relic',
    x: 39,
    y: 20,
    rotation: 1.8,
    tone: 'pink',
    tape: 'corner',
  },
  {
    id: 'quiet-frequency',
    title: 'do not archive yet',
    body: 'some things only feel true before they are named.',
    timestamp: '11:54pm',
    state: 'private',
    relicStage: 'held',
    ageDays: 1,
    replayCount: 0,
    reactions: { feltThat: 0, same: 0, here: 0, again: 0 },
    survivalLine: 'private until it stops shaking',
    x: 64,
    y: 12,
    rotation: -0.8,
    tone: 'cyan',
  },
  {
    id: 'almost-deleted',
    title: 'left open overnight',
    body: 'i wanted someone to find it without knowing it was mine.',
    timestamp: '3:04am',
    state: 'drifting',
    relicStage: 'shared',
    ageDays: 9,
    replayCount: 43,
    reactions: { feltThat: 9, same: 7, here: 4, again: 5 },
    survivalLine: 'kept warm by strangers before dawn',
    x: 18,
    y: 52,
    rotation: 2.6,
    tone: 'amber',
    tape: 'side',
  },
  {
    id: 'graphite-residue',
    title: 'static graveyard',
    body: 'never answered: "i keep almost calling them"',
    timestamp: '4:19am',
    state: 'anchored',
    relicStage: 'held',
    ageDays: 27,
    replayCount: 6,
    reactions: { feltThat: 1, same: 0, here: 1, again: 0 },
    survivalLine: 'faded into the static graveyard',
    x: 57,
    y: 52,
    rotation: -3.2,
    tone: 'graphite',
  },
]

export function createDefaultReactions(): DriftNoteReactions {
  return {
    again: 0,
    feltThat: 0,
    here: 0,
    same: 0,
  }
}

export function getNoteReactionTotal(note: DriftNoteData) {
  return Object.values(note.reactions).reduce((total, value) => total + value, 0)
}

export function getNoteResonance(note: DriftNoteData) {
  return Math.min(100, 34 + Math.round(note.replayCount / 8) + getNoteReactionTotal(note) * 2)
}

export function getNoteMass(note: DriftNoteData) {
  return Math.min(1, getNoteResonance(note) / 100)
}

export function getNoteMaturationLabel(note: DriftNoteData) {
  if (note.relicStage === 'relic-seed') return `almost relic / kept alive ${Math.max(2, Math.min(14, note.ageDays))} nights`
  if (note.relicStage === 'shared') return `drifting / someone returned ${Math.max(1, Math.min(9, Math.round(note.replayCount / 12)))}x`
  if (note.state === 'anchored') return 'kept / still clean'
  if (note.ageDays > 20) return 'fading / residue underneath'
  return 'held / not ready to drift'
}

export function normalizeDriftNote(candidate: unknown): DriftNoteData | null {
  if (!candidate || typeof candidate !== 'object') return null
  const rawNote = candidate as Partial<DriftNoteData>
  const fallback = driftNotesSeed.find((note) => note.id === rawNote.id)
  if (typeof rawNote.id !== 'string' || (!fallback && typeof rawNote.title !== 'string')) {
    return null
  }
  const rawReactions = rawNote.reactions && typeof rawNote.reactions === 'object'
    ? rawNote.reactions as Partial<DriftNoteReactions>
    : {}
  const fallbackReactions = fallback?.reactions ?? createDefaultReactions()
  const state = rawNote.state === 'drifting' || rawNote.state === 'anchored' || rawNote.state === 'private'
    ? rawNote.state
    : fallback?.state ?? 'private'
  const relicStage = rawNote.relicStage === 'shared' || rawNote.relicStage === 'relic-seed' || rawNote.relicStage === 'held'
    ? rawNote.relicStage
    : fallback?.relicStage ?? 'held'
  const tone = rawNote.tone === 'pink' || rawNote.tone === 'cyan' || rawNote.tone === 'amber' || rawNote.tone === 'graphite' || rawNote.tone === 'cream'
    ? rawNote.tone
    : fallback?.tone ?? 'cream'
  const tape = rawNote.tape === 'top' || rawNote.tape === 'corner' || rawNote.tape === 'side'
    ? rawNote.tape
    : fallback?.tape
  return {
    ageDays: typeof rawNote.ageDays === 'number' ? rawNote.ageDays : fallback?.ageDays ?? 0,
    body: typeof rawNote.body === 'string' ? rawNote.body : fallback?.body ?? 'a note without a body yet',
    id: rawNote.id,
    reactions: {
      again: typeof rawReactions.again === 'number' ? rawReactions.again : fallbackReactions.again,
      feltThat: typeof rawReactions.feltThat === 'number' ? rawReactions.feltThat : fallbackReactions.feltThat,
      here: typeof rawReactions.here === 'number' ? rawReactions.here : fallbackReactions.here,
      same: typeof rawReactions.same === 'number' ? rawReactions.same : fallbackReactions.same,
    },
    relicStage,
    replayCount: typeof rawNote.replayCount === 'number' ? rawNote.replayCount : fallback?.replayCount ?? 0,
    rotation: typeof rawNote.rotation === 'number' ? rawNote.rotation : fallback?.rotation ?? 0,
    state,
    survivalLine: typeof rawNote.survivalLine === 'string' ? rawNote.survivalLine : fallback?.survivalLine ?? 'still deciding whether to stay',
    tape,
    timestamp: typeof rawNote.timestamp === 'string' ? rawNote.timestamp : fallback?.timestamp ?? '2:11am',
    title: typeof rawNote.title === 'string' ? rawNote.title : fallback?.title ?? 'untitled fragment',
    tone,
    x: typeof rawNote.x === 'number' ? Math.max(4, Math.min(76, rawNote.x)) : fallback?.x ?? 12,
    y: typeof rawNote.y === 'number' ? Math.max(4, Math.min(70, rawNote.y)) : fallback?.y ?? 12,
  }
}

export function readDriftNotes() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(driftNotesStorageKey) ?? '[]')
    if (!Array.isArray(parsed)) return driftNotesSeed
    const repairedNotes = parsed
      .map((note) => normalizeDriftNote(note))
      .filter((note): note is DriftNoteData => Boolean(note))
    const repairedIds = new Set(repairedNotes.map((note) => note.id))
    const missingSeedNotes = driftNotesSeed.filter((note) => !repairedIds.has(note.id))
    return [...repairedNotes, ...missingSeedNotes]
  } catch {
    window.localStorage.removeItem(driftNotesStorageKey)
    return driftNotesSeed
  }
}

export function writeDriftNotes(notes: DriftNoteData[]) {
  try {
    window.localStorage.setItem(driftNotesStorageKey, JSON.stringify(notes))
  } catch {
    // Notes are local-first; storage failures should not block the session.
  }
}

export function getDriftNoteTideLine(notes: DriftNoteData[]) {
  const relicSeed = notes.find((note) => note.relicStage === 'relic-seed')
  if (relicSeed) return `one note became almost relic: ${relicSeed.survivalLine}.`
  const heldNote = notes.find((note) => getNoteReactionTotal(note) >= 8 || note.reactions.here > 0)
  if (heldNote) return `your note was held after ${heldNote.timestamp}.`
  const privateNote = notes.find((note) => note.state === 'private')
  if (privateNote) return 'a private note stayed clean inside your pod.'
  const driftingNote = notes.find((note) => note.state === 'drifting')
  if (driftingNote) return 'one note drifted further tonight.'
  return 'no notes asked to be remembered tonight.'
}

export function usePersistedDriftNotes() {
  const [notes, setNotes] = useState<DriftNoteData[]>(() => readDriftNotes())
  useEffect(() => {
    writeDriftNotes(notes)
  }, [notes])
  return [notes, setNotes] as const
}

function isPointerInsideElement(event: PointerEvent<HTMLElement>, target: HTMLElement | null) {
  if (!target) return false
  const bounds = target.getBoundingClientRect()
  return (
    event.clientX >= bounds.left &&
    event.clientX <= bounds.right &&
    event.clientY >= bounds.top &&
    event.clientY <= bounds.bottom
  )
}

export function DriftNotesBoard({
  notes,
  onNotesChange,
  onReactionSound,
}: {
  notes: DriftNoteData[]
  onNotesChange: Dispatch<SetStateAction<DriftNoteData[]>>
  onReactionSound?: (reaction: DriftNoteReactionType) => void
}) {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const driftTargetRef = useRef<HTMLButtonElement | null>(null)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const pinTargetRef = useRef<HTMLButtonElement | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const sharedNotes = notes.filter((note) => note.state === 'drifting' || note.relicStage !== 'held')
  const relicSeedCount = notes.filter((note) => note.relicStage === 'relic-seed').length

  const updateNotePosition = useCallback((id: string, x: number, y: number) => {
    onNotesChange((currentNotes) => {
      const movedNote = currentNotes.find((note) => note.id === id)
      if (!movedNote) return currentNotes
      const snappedX = Math.round(Math.max(4, Math.min(76, x)) / 2) * 2
      const snappedY = Math.round(Math.max(4, Math.min(70, y)) / 2) * 2
      return currentNotes.map((note) => {
        if (note.id === id) return { ...note, x: snappedX, y: snappedY }
        const distance = Math.hypot(note.x - snappedX, note.y - snappedY)
        if (distance > 0 && distance < 16) {
          const directionX = note.x >= snappedX ? 1 : -1
          const directionY = note.y >= snappedY ? 1 : -1
          return {
            ...note,
            x: Math.max(4, Math.min(76, note.x + directionX * 2)),
            y: Math.max(4, Math.min(70, note.y + directionY * 2)),
          }
        }
        return note
      })
    })
  }, [onNotesChange])

  const setNoteState = useCallback((id: string, state: DriftNoteState) => {
    onNotesChange((currentNotes) => currentNotes.map((note) => (
      note.id === id ? { ...note, state } : note
    )))
  }, [onNotesChange])

  const reactToNote = useCallback((id: string, reaction: DriftNoteReactionType) => {
    onNotesChange((currentNotes) => currentNotes.map((note) => {
      if (note.id !== id) return note
      const nextReactions = {
        ...note.reactions,
        [reaction]: note.reactions[reaction] + 1,
      }
      return {
        ...note,
        reactions: nextReactions,
        replayCount: reaction === 'again' ? note.replayCount + 1 : note.replayCount,
        relicStage: getNoteReactionTotal({ ...note, reactions: nextReactions }) >= 30 ? 'relic-seed' : note.relicStage,
        state: note.state === 'private' ? 'drifting' : note.state,
        survivalLine: reaction === 'here'
          ? 'someone stayed with it silently'
          : reaction === 'same'
            ? 'a stranger found the same feeling'
            : reaction === 'again'
              ? 'replayed to keep it warm'
              : 'held without needing a reply',
      }
    }))
    onReactionSound?.(reaction)
  }, [onNotesChange, onReactionSound])

  const beginDrag = useCallback((event: PointerEvent<HTMLElement>, note: DriftNoteData) => {
    const board = boardRef.current
    if (!board) return
    const bounds = board.getBoundingClientRect()
    const noteLeft = (note.x / 100) * bounds.width
    const noteTop = (note.y / 100) * bounds.height
    dragRef.current = {
      id: note.id,
      offsetX: event.clientX - bounds.left - noteLeft,
      offsetY: event.clientY - bounds.top - noteTop,
    }
    setDraggingId(note.id)
    navigator.vibrate?.(12)
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const moveDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    const board = boardRef.current
    const dragState = dragRef.current
    if (!board || !dragState) return
    const bounds = board.getBoundingClientRect()
    const x = ((event.clientX - bounds.left - dragState.offsetX) / bounds.width) * 100
    const y = ((event.clientY - bounds.top - dragState.offsetY) / bounds.height) * 100
    updateNotePosition(dragState.id, x, y)
  }, [updateNotePosition])

  const endDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    const dragState = dragRef.current
    if (dragState) {
      if (isPointerInsideElement(event, driftTargetRef.current)) {
        setNoteState(dragState.id, 'drifting')
      } else if (isPointerInsideElement(event, pinTargetRef.current)) {
        setNoteState(dragState.id, 'anchored')
      }
      navigator.vibrate?.(8)
    }
    dragRef.current = null
    setDraggingId(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [setNoteState])

  return (
    <section className="drift-notes-system" aria-label="Your Notes drift board">
      <header className="drift-notes-header">
        <span>your notes</span>
        <h2>Thoughts left behind at 2am.</h2>
        <p>Drag a fragment toward a tray. Nothing becomes public unless you let it drift.</p>
      </header>
      <div className="drift-notes-board" ref={boardRef}>
        <div className="drift-board-dust" aria-hidden="true" />
        {notes.map((note) => (
          <article
            className={`drift-note note-${note.tone} state-${note.state} relic-${note.relicStage} ${draggingId === note.id ? 'is-dragging' : ''} tape-${note.tape ?? 'none'}`}
            key={note.id}
            onPointerCancel={endDrag}
            onPointerDown={(event) => beginDrag(event, note)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            style={{
              '--note-age': Math.min(note.ageDays / 32, 1),
              '--note-mass': getNoteMass(note),
              '--note-resonance': `${getNoteResonance(note)}%`,
              '--note-rotation': `${note.rotation}deg`,
              '--note-wear': Math.min((note.ageDays + note.replayCount / 24) / 42, 1),
              left: `clamp(4%, ${note.x}%, calc(100% - var(--note-width) - 10px))`,
              top: `clamp(4%, ${note.y}%, calc(100% - var(--note-height) - 10px))`,
            } as CSSProperties}
          >
            <span className="note-state-label">{note.state}</span>
            <h3>{note.title}</h3>
            <p>{note.body}</p>
            <footer>
              <small>{note.timestamp}</small>
              <b>{getNoteMaturationLabel(note)}</b>
            </footer>
            <p className="note-survival-line">{note.survivalLine}</p>
            {note.state !== 'anchored' ? (
              <div className="note-reaction-dock" aria-label={`Reactions for ${note.title}`}>
                <button onClick={() => reactToNote(note.id, 'feltThat')} onPointerDown={(event) => event.stopPropagation()} type="button">⌁ {note.reactions.feltThat}</button>
                <button onClick={() => reactToNote(note.id, 'same')} onPointerDown={(event) => event.stopPropagation()} type="button">〰 {note.reactions.same}</button>
                <button onClick={() => reactToNote(note.id, 'here')} onPointerDown={(event) => event.stopPropagation()} type="button">◌ {note.reactions.here}</button>
                <button onClick={() => reactToNote(note.id, 'again')} onPointerDown={(event) => event.stopPropagation()} type="button">↺ {note.reactions.again}</button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <div className="desk-drop-targets" aria-label="Note drop targets">
        <button ref={driftTargetRef} type="button" onClick={() => draggingId ? setNoteState(draggingId, 'drifting') : undefined}>
          ◌ let it drift
        </button>
        <button ref={pinTargetRef} type="button" onClick={() => draggingId ? setNoteState(draggingId, 'anchored') : undefined}>
          ◈ pin to board
        </button>
      </div>
      <aside className="drift-relic-hierarchy" aria-label="Notes to relic hierarchy">
        <span>sharing hierarchy</span>
        <div>
          <strong>{sharedNotes.length}</strong>
          <p>notes allowed to drift anonymously into rooms, dead zones, recap feeds, and signal encounters.</p>
        </div>
        <div>
          <strong>{relicSeedCount}</strong>
          <p>note becoming a relic seed because strangers kept replaying it.</p>
        </div>
      </aside>
    </section>
  )
}

export function TideReportPanel({ notes, reports }: { notes: DriftNoteData[]; reports: TideReport[] }) {
  const report = reports[0]
  const noteLine = getDriftNoteTideLine(notes)
  return (
    <section className="tide-report-panel" aria-label="Tide Report">
      <header>
        <div>
          <span>tide report / morning fade</span>
          <h2>what came back from the sea</h2>
        </div>
        <p>By 6:00 AM, cast lines dissolve. What remains is only the trail they left behind.</p>
      </header>
      <p className="tide-report-line">{report?.line ?? 'quiet traffic last night. nothing asked to be kept.'}</p>
      <p className="tide-report-note-line">{noteLine}</p>
    </section>
  )
}

export function RelicSeedPanel({ notes }: { notes: DriftNoteData[] }) {
  const noteRelicSeeds = notes.filter((note) => note.relicStage === 'relic-seed' || note.state === 'drifting')
  return (
    <section className="note-seed-panel" aria-label="Notes becoming relics">
      <span>from your notes</span>
      {noteRelicSeeds.map((note) => (
        <article className={note.relicStage === 'relic-seed' ? 'forming' : 'drifting'} key={note.id}>
          <strong>{note.title}</strong>
          <p>{note.relicStage === 'relic-seed' ? 'forming artifact' : 'drifting anonymously'}</p>
          <em>{note.survivalLine}</em>
          <small>
            {getNoteResonance(note)}% resonance / {note.relicStage === 'relic-seed'
              ? 'kept alive by strangers'
              : `${getNoteReactionTotal(note)} quiet traces`}
          </small>
        </article>
      ))}
      {noteRelicSeeds.length === 0 ? (
        <p className="empty-note-seeds">No note has drifted far enough to form an artifact yet.</p>
      ) : null}
    </section>
  )
}

export function DriftNotesMemoryLoopDemo() {
  const [notes, setNotes] = usePersistedDriftNotes()
  const reports = [{
    id: 'local-tide-report',
    line: 'your 2:14am signal drifted into the unresolved band before dawn.',
    createdAt: new Date().toISOString(),
  }]
  return (
    <main className="memory-loop-demo">
      <TideReportPanel notes={notes} reports={reports} />
      <DriftNotesBoard notes={notes} onNotesChange={setNotes} />
      <RelicSeedPanel notes={notes} />
    </main>
  )
}
