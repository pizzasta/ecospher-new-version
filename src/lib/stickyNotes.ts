// Personal post-it notes: a user's own reactions, reflections, and annotations,
// pinned on their Soul Pod. Private by default; a note can be released to drift
// publicly (screened first), and the well-travelled public ones bubble up to the
// Relics page (see relicNotes.ts). Local-first, anonymous — no names, ever.

import { moderatePublicSignalText } from './signalModeration'

export interface StickyNote {
  id: string
  text: string
  color: string
  public: boolean
  // anchored — emotionally pinned. stays cleaner, ages slower, holds its place.
  anchored?: boolean
  createdAt: number
}

export const NOTE_MAX = 120

// muted, faded post-it tints — dusty, late-night, not neon
export const NOTE_COLORS = ['#caa57f', '#a8889b', '#7f9bb0', '#8fae8f', '#b0937f', '#9b8fb0']

const KEY = 'ecosphere:stickyNotes'
const SEED_KEY = 'ecosphere:stickyNotes:seeded'

// real, plain starter notes — pinned once so the board isn't an empty box. they
// are ordinary notes: editable, draggable, deletable. one quietly explains the
// drag/swap affordance; the rest just sound like someone awake at 3am.
const STARTER_NOTES: ReadonlyArray<{ text: string; color: string }> = [
  { text: "3am and wide awake. somehow the quiet hum on here is the only thing tonight that doesn't feel like too much.", color: NOTE_COLORS[0] },
  { text: "a voice drifted past that sounded exactly like how i've been feeling. didn't reply. just sat with it for a while.", color: NOTE_COLORS[2] },
  { text: "↜ drag these around. swap them for your own when you've got a thought worth keeping.", color: NOTE_COLORS[1] },
]

export function loadNotes(): StickyNote[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as StickyNote[]
    return Array.isArray(raw) ? raw.filter(n => n && typeof n.id === 'string') : []
  } catch { return [] }
}

function persist(notes: StickyNote[]): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(notes.slice(0, 60))) } catch { /* session only */ }
}

/**
 * Notes for display, seeding the starter set exactly once on a never-used board.
 * The seed flag means we never re-add them after the user clears their wall —
 * an empty board after that is a real choice, not a fresh start.
 */
export function loadOrSeed(): StickyNote[] {
  const existing = loadNotes()
  if (existing.length > 0) return existing
  try { if (window.localStorage.getItem(SEED_KEY)) return existing } catch { return existing }
  const now = Date.now()
  const seeded: StickyNote[] = STARTER_NOTES.map((s, i) => ({
    id: `seed_${i}_${now.toString(36)}`,
    text: s.text,
    color: s.color,
    public: false,
    createdAt: now - i * 1000,
  }))
  persist(seeded)
  try { window.localStorage.setItem(SEED_KEY, '1') } catch { /* session only */ }
  return seeded
}

export function canGoPublic(text: string): boolean {
  return moderatePublicSignalText(text).status !== 'flagged'
}

/** Pin a new note. Public notes are screened before they can drift. */
export function addNote(text: string, color: string, isPublic: boolean): { note: StickyNote } | { error: string } {
  const t = text.trim().slice(0, NOTE_MAX)
  if (t.length < 2) return { error: 'a note needs a few more words' }
  if (isPublic && !canGoPublic(t)) return { error: "this one stays private — it can't drift public here" }
  const note: StickyNote = {
    id: `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    text: t,
    color,
    public: isPublic,
    createdAt: Date.now(),
  }
  persist([note, ...loadNotes()])
  return { note }
}

export function updateNote(id: string, patch: Partial<Pick<StickyNote, 'text' | 'color' | 'public' | 'anchored'>>): StickyNote[] {
  const notes = loadNotes().map(n => {
    if (n.id !== id) return n
    const next = { ...n, ...patch }
    if (patch.text != null) next.text = patch.text.trim().slice(0, NOTE_MAX)
    // can't make a flagged note public
    if (patch.public && !canGoPublic(next.text)) next.public = false
    return next
  })
  persist(notes)
  return notes
}

export function deleteNote(id: string): StickyNote[] {
  const notes = loadNotes().filter(n => n.id !== id)
  persist(notes)
  return notes
}

/** Pure: move note `fromId` to the slot of `toId` (drag-and-drop reorder). */
export function reorderNotes(notes: StickyNote[], fromId: string, toId: string): StickyNote[] {
  if (fromId === toId) return notes
  const from = notes.findIndex(n => n.id === fromId)
  const to = notes.findIndex(n => n.id === toId)
  if (from < 0 || to < 0) return notes
  const copy = notes.slice()
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}

/** Persist a reordered list (called after a drop). */
export function saveOrder(notes: StickyNote[]): void { persist(notes) }
