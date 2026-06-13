// "Resonate" — how you react to a post-it note. Not likes: a small set of
// sigils, each an emotional frequency, plus an optional 5–8s voice echo. Quick
// but expressive (sigils), meaningful and rare (voice). Local-first; a backend
// would aggregate across everyone and the deterministic base below is replaced
// by real counts.

export interface ResonanceSigil { id: string; glyph: string; label: string; meaning: string }

export const RESONANCE_SIGILS: ResonanceSigil[] = [
  { id: 'drifted', glyph: '◌', label: 'drifted back', meaning: 'i kept coming back to this' },
  { id: 'felt', glyph: '∿', label: 'felt that', meaning: 'it landed somewhere' },
  { id: 'stayed', glyph: '◐', label: 'stayed up with this', meaning: 'it kept me company tonight' },
  { id: 'static', glyph: '▒', label: 'static in my chest', meaning: 'it ached, in a good way' },
  { id: 'light', glyph: '✦', label: 'small light', meaning: 'it helped, a little' },
  { id: 'close', glyph: '⟁', label: 'cut close', meaning: 'too true to scroll past' },
  { id: 'kept', glyph: '◈', label: 'kept it', meaning: 'i saved this one' },
]

const MINE_KEY = 'ecosphere:myResonance'

function hash(key: string): number {
  let h = 7
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 0x7fffffff
  return h
}

function readMine(): Record<string, string> {
  try { return JSON.parse(window.localStorage.getItem(MINE_KEY) ?? '{}') } catch { return {} }
}
function writeMine(m: Record<string, string>): void {
  try { window.localStorage.setItem(MINE_KEY, JSON.stringify(m)) } catch { /* session only */ }
}

/** The sigil you gave this note, or null. */
export function myResonance(noteId: string): string | null {
  return readMine()[noteId] ?? null
}

/** Tap a sigil: give it, change it, or take it back (toggle). Returns yours now. */
export function toggleResonance(noteId: string, sigilId: string): string | null {
  const mine = readMine()
  if (mine[noteId] === sigilId) delete mine[noteId]
  else mine[noteId] = sigilId
  writeMine(mine)
  return mine[noteId] ?? null
}

/** Deterministic base counts per note (stands in for the rest of the band). */
export function baseTally(noteId: string): Record<string, number> {
  const seed = hash(noteId)
  const tally: Record<string, number> = {}
  RESONANCE_SIGILS.forEach((s, i) => {
    const n = (seed >> (i % 12)) % 11
    if (n > 4) tally[s.id] = n - 4 // a few sigils carry a small count
  })
  return tally
}

/** Full tally = base + your own contribution. */
export function tallyFor(noteId: string): Record<string, number> {
  const tally = { ...baseTally(noteId) }
  const mine = myResonance(noteId)
  if (mine) tally[mine] = (tally[mine] ?? 0) + 1
  return tally
}

/** A single impact number: sigils count once, a voice echo counts for three. */
export function resonanceScore(noteId: string, voiceCount = 0): number {
  const sigils = Object.values(tallyFor(noteId)).reduce((a, b) => a + b, 0)
  return sigils + voiceCount * 3
}

/** The top sigils on a note, for the compact display (most-given first). */
export function topSigils(noteId: string, limit = 3): Array<{ sigil: ResonanceSigil; count: number }> {
  const tally = tallyFor(noteId)
  return RESONANCE_SIGILS
    .map(sigil => ({ sigil, count: tally[sigil.id] ?? 0 }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
