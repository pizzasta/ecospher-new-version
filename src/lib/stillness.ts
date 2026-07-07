// Stillness — the emotional inverse of a like.
//
// Some voices don't want a reaction. They want company. Press and hold a
// signal to sit with it: no words, no glyph, no counter racing up — just a
// recorded fact that you stayed. The card remembers ("you sat with this ·
// 4 others have"), and that's the entire mechanic. Presence as the message.
//
// Local-first; the others who sat are seeded per signal so the quiet is
// already shared before you arrive.

const KEY = 'ecosphere:stillness'

function hashString(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 0x7fffffff
  return h
}

function readMine(): Record<string, number> {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Record<string, number> } catch { return {} }
}

function writeMine(store: Record<string, number>): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* session only */ }
}

/** How many others have sat with this signal — seeded, stable, quiet numbers. */
export function othersWhoSat(signalId: string): number {
  return 1 + (hashString(signalId + 'still') % 9)
}

export function hasSatWith(signalId: string): boolean {
  return signalId in readMine()
}

/** Record your stillness. Idempotent — sitting twice is still sitting. */
export function sitWith(signalId: string, now = Date.now()): void {
  const store = readMine()
  if (!store[signalId]) {
    store[signalId] = now
    writeMine(store)
  }
}

/** Signals you've sat with — a quiet fact, never a score. */
export function stillnessCount(): number {
  return Object.keys(readMine()).length
}

/** The card's line after the hold. */
export function stillnessLine(signalId: string): string {
  const others = othersWhoSat(signalId)
  return hasSatWith(signalId)
    ? `you sat with this · ${others} other${others === 1 ? '' : 's'} have too`
    : `${others} ${others === 1 ? 'person has' : 'people have'} sat with this`
}

/** How long the hold takes — long enough to mean it. */
export const HOLD_MS = 2400
