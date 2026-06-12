// Limited-edition frequency drops: every nine days a rare capsule forms,
// stays open for exactly 24 hours, then is gone forever. The schedule is
// deterministic (epoch-based), so every client agrees on what's live —
// no backend needed, no way to see what you missed.

import type { SampleKind } from './sampleAudio'

const EPOCH = Date.UTC(2026, 0, 2) // first drop window
const PERIOD_MS = 9 * 24 * 60 * 60 * 1000
const WINDOW_MS = 24 * 60 * 60 * 1000

type DropDef = {
  title: string
  line: string
  kind: SampleKind
}

const DROPS: DropDef[] = [
  { title: '88.1 — the parking lot frequency', line: 'recorded once, in a car that never moved. never rebroadcast.', kind: 'static' },
  { title: 'last call, line two', line: 'the hold music kept playing after everyone hung up.', kind: 'tone' },
  { title: 'laundromat, 1:40am', line: 'forty seconds of machines and one person humming.', kind: 'whisper' },
  { title: 'the message before the message', line: 'the breath someone took before saying the hard part.', kind: 'voice' },
  { title: 'storm over the east band', line: 'the night the interference sounded almost like words.', kind: 'zone' },
  { title: 'closing time, third shift', line: 'keys, a door, and the quiet that follows a long day.', kind: 'static' },
  { title: 'dial tone study', line: 'an entire sound whose only job was to wait with you.', kind: 'tone' },
  { title: 'the hallway recording', line: 'someone walked past a life happening behind a door.', kind: 'whisper' },
]

export type ActiveDrop = {
  id: string
  title: string
  line: string
  kind: SampleKind
  seed: number
  startedAt: number
  endsAt: number
}

/** The drop that is live right now, or null between windows. */
export function currentDrop(now = Date.now()): ActiveDrop | null {
  if (now < EPOCH) return null
  const cycle = Math.floor((now - EPOCH) / PERIOD_MS)
  const start = EPOCH + cycle * PERIOD_MS
  if (now - start >= WINDOW_MS) return null
  const def = DROPS[cycle % DROPS.length]
  return {
    id: `drop-${cycle}`,
    ...def,
    seed: 881 + cycle * 53,
    startedAt: start,
    endsAt: start + WINDOW_MS,
  }
}

/** When the next window opens (for the quiet teaser line). */
export function nextDropAt(now = Date.now()): number {
  if (now < EPOCH) return EPOCH
  const cycle = Math.floor((now - EPOCH) / PERIOD_MS)
  const start = EPOCH + cycle * PERIOD_MS
  return now - start < WINDOW_MS ? start + PERIOD_MS : start + PERIOD_MS
}

export function dropTimeLeft(drop: ActiveDrop, now = Date.now()): string {
  const ms = Math.max(0, drop.endsAt - now)
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

// once opened, the drop stays readable until its window closes
const OPENED_KEY = 'ecosphere:openedDrops'
const SEEN_KEY = 'ecosphere:seenDrops'

export function isDropOpened(id: string): boolean {
  try { return (JSON.parse(window.localStorage.getItem(OPENED_KEY) ?? '[]') as string[]).includes(id) } catch { return false }
}

export function markDropOpened(id: string) {
  try {
    const opened = JSON.parse(window.localStorage.getItem(OPENED_KEY) ?? '[]') as string[]
    if (!opened.includes(id)) window.localStorage.setItem(OPENED_KEY, JSON.stringify([...opened, id].slice(-20)))
  } catch { /* session only */ }
}

/** True the first time this client notices the drop (for the notification). */
export function markDropSeen(id: string): boolean {
  try {
    const seen = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '[]') as string[]
    if (seen.includes(id)) return false
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id].slice(-20)))
    return true
  } catch {
    return false
  }
}
