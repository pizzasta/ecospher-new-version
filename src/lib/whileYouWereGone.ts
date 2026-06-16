// The return system: when you come back after hours away, the band
// quietly mentions one or two things that happened — drawn from your real
// local state, deterministic per day, capped hard so it never becomes
// notification spam (max 2 lines, max once per 6 hours, only after 3h away).

import { currentDrop, dropTimeLeft } from './frequencyDrops'

const LAST_SEEN_KEY = 'ecosphere:lastSeenAt'
const LAST_WELCOME_KEY = 'ecosphere:lastWelcomeAt'

export const AWAY_THRESHOLD_MS = 3 * 60 * 60 * 1000
export const WELCOME_GAP_MS = 6 * 60 * 60 * 1000

export function touchLastSeen(now = Date.now()): void {
  try { window.localStorage.setItem(LAST_SEEN_KEY, String(now)) } catch { /* session only */ }
}

function readNumber(key: string): number {
  try { return Number(window.localStorage.getItem(key) ?? 0) || 0 } catch { return 0 }
}

/** Whole days since the device was last seen (0 if never recorded). Read-only. */
export function daysSinceLastSeen(now = Date.now()): number {
  const lastSeen = readNumber(LAST_SEEN_KEY)
  if (!lastSeen) return 0
  return Math.max(0, Math.floor((now - lastSeen) / 86400000))
}

/** True when the user has been away long enough AND we haven't welcomed recently. */
export function shouldWelcome(now = Date.now()): boolean {
  const lastSeen = readNumber(LAST_SEEN_KEY)
  const lastWelcome = readNumber(LAST_WELCOME_KEY)
  if (!lastSeen) return false
  return now - lastSeen >= AWAY_THRESHOLD_MS && now - lastWelcome >= WELCOME_GAP_MS
}

export function markWelcomed(now = Date.now()): void {
  try { window.localStorage.setItem(LAST_WELCOME_KEY, String(now)) } catch { /* session only */ }
}

/** At most two calm lines, picked from what's actually true on this device. */
export function returnMoments(now = Date.now()): string[] {
  const day = Math.floor(now / 86400000)
  const hour = new Date(now).getHours()
  const moments: string[] = []

  // you have recordings → someone found one (deterministic flavor per day)
  try {
    const layers = JSON.parse(window.localStorage.getItem('ecosphere:chainLayers') ?? '[]') as unknown[]
    const tape = window.localStorage.getItem('ecosphere:tapeIntro')
    const hasVoice = layers.length > 0 || !!tape
    if (hasVoice) {
      moments.push(day % 2 === 0
        ? 'someone replayed your signal again tonight'
        : 'someone stayed through the ending of yours')
    }
  } catch { /* fresh device */ }

  // your handled relics resurface
  try {
    const activity = JSON.parse(window.localStorage.getItem('ecosphere:relicActivity') ?? '{}') as Record<string, { replays?: number }>
    if (Object.values(activity).some(a => (a.replays ?? 0) > 0)) {
      moments.push('a relic you handled resurfaced while you were gone')
    }
  } catch { /* none */ }

  // hidden traces still waiting on the radar
  try {
    const found = JSON.parse(window.localStorage.getItem('ecosphere:driftFound') ?? '[]') as unknown[]
    if (found.length < 3) moments.push('a hidden trace appeared on the radar')
  } catch { /* none */ }

  // a rare drop is live right now
  const drop = currentDrop(now)
  if (drop) moments.push(`a rare frequency is open — gone in ${dropTimeLeft(drop, now)}`)

  // the deep hours
  if (hour >= 0 && hour < 5) moments.push('the band got active after midnight')

  // rotate which two surface, so returns don't repeat themselves
  if (moments.length <= 2) return moments
  const start = day % moments.length
  return [moments[start], moments[(start + 1) % moments.length]]
}
