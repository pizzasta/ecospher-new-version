// Signal life: every public signal is slightly alive.
// HEAT  — activity makes it glow, storm, and carry live lines.
// DECAY — neglect makes it fade, fragment, and corrupt — until someone
//         replays, saves, or preserves it. Fully-corrupted signals that
//         get pulled back become relic material.
// WHY   — when something surfaces, a minimal human reason rides along.
// WHO   — passive social presence: ambient humans, never followers.

const PRESERVED_KEY = 'ecosphere:preservedSignals'

function hash(key: string): number {
  let h = 7
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 0x7fffffff
  return h
}

function day(now = Date.now()): number {
  return Math.floor(now / 86400000)
}

// ─── decay ────────────────────────────────────────────────────────────────────

export function listPreserved(): string[] {
  try { return JSON.parse(window.localStorage.getItem(PRESERVED_KEY) ?? '[]') } catch { return [] }
}

export function preserveSignal(id: string): void {
  const next = [...new Set([id, ...listPreserved()])].slice(0, 80)
  try { window.localStorage.setItem(PRESERVED_KEY, JSON.stringify(next)) } catch { /* session only */ }
}

/** 0 intact · 1 fading · 2 fragmenting · 3 corrupted. Preserved = intact. */
export function decayLevel(id: string, now = Date.now()): 0 | 1 | 2 | 3 {
  if (listPreserved().includes(id)) return 0
  const seed = hash(id) + day(now)
  const roll = seed % 10
  if (roll < 5) return 0
  if (roll < 8) return 1
  if (roll < 9) return 2
  return 3
}

/** Words go missing as a signal fragments — '░░' where speech used to be. */
export function decayText(content: string, level: number, id: string): string {
  if (level < 2) return content
  const words = content.split(' ')
  if (words.length < 4) return content
  const seed = hash(id)
  const dropEvery = level >= 3 ? 3 : 5
  return words
    .map((word, i) => ((seed + i * 13) % dropEvery === 0 && word.length > 2 ? '░░' + '░'.repeat(Math.min(4, word.length - 2)) : word))
    .join(' ')
}

export const DECAY_LABELS: Record<number, string | null> = {
  0: null,
  1: 'fading — replay it to keep it warm',
  2: 'fragmenting — words are going missing',
  3: 'mostly static — preserve it before it goes',
}

// ─── replay heat ──────────────────────────────────────────────────────────────

export type SignalHeat = { level: 0 | 1 | 2 | 3; line: string | null }

const HEAT_LINES = [
  null,
  (n: number) => `${n} replays in the last hour`,
  () => 'people keep replaying the ending',
  () => 'replay chain detected — it keeps spreading',
] as const

/** Deterministic per signal per day; real live events can bump it client-side. */
export function heatFor(id: string, now = Date.now()): SignalHeat {
  const seed = hash(id) + day(now) * 3
  const roll = seed % 12
  const hour = new Date(now).getHours()
  const level: 0 | 1 | 2 | 3 = roll < 6 ? 0 : roll < 9 ? 1 : roll < 11 ? 2 : 3
  if (level === 0) return { level, line: null }
  if (level === 1 && (hour >= 0 && hour < 5)) return { level, line: 'active after midnight' }
  const maker = HEAT_LINES[level]
  return { level, line: maker ? maker(8 + (seed % 31)) : null }
}

// ─── why this found you ───────────────────────────────────────────────────────

/**
 * Minimal, human, believable — derived from this device's real behavior
 * where possible. Never recommendation-speak.
 */
export function whyFoundYou(id: string, now = Date.now()): string {
  const seed = hash(id)
  const hour = new Date(now).getHours()
  const reasons: string[] = []

  try {
    const activity = JSON.parse(window.localStorage.getItem('ecosphere:relicActivity') ?? '{}') as Record<string, { replays?: number }>
    if (Object.values(activity).some(a => (a.replays ?? 0) >= 2)) reasons.push('you replay similar endings')
  } catch { /* fresh device */ }
  try {
    const found = JSON.parse(window.localStorage.getItem('ecosphere:driftFound') ?? '[]') as unknown[]
    if (found.length > 0) reasons.push('you lingered here before')
  } catch { /* none */ }
  try {
    const lastVoice = Number(window.localStorage.getItem('ecosphere:lastVoiceAt') ?? 0)
    if (lastVoice && now - lastVoice < 24 * 3600 * 1000) reasons.push('this resurfaced after your last signal')
  } catch { /* none */ }
  if (hour >= 22 || hour < 5) reasons.push('you stayed in quiet rooms tonight')
  reasons.push('listeners nearby replayed this too')

  return reasons[seed % reasons.length]
}

// ─── passive social presence ──────────────────────────────────────────────────

const PRESENCE_LINES = [
  (n: number) => `${n} people stayed here silently`,
  () => 'someone nearby replayed this',
  () => 'a listener drifted after hearing this',
  () => 'another signal crossed paths with yours',
  (n: number) => `${n} users replayed the same section tonight`,
  () => 'somebody saved this without a word',
] as const

/** Ambient human presence, deterministic per item per day. */
export function presenceLine(id: string, now = Date.now()): string {
  const seed = hash(id) + day(now)
  const maker = PRESENCE_LINES[seed % PRESENCE_LINES.length]
  return maker(2 + (seed % 4))
}
