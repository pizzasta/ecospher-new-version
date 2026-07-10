// Presence: who's drifting through your frequency. Instead of a visitor
// count, everyone who passes through — a listen, a reaction, a tune-in, the
// phantom — becomes an anonymous soul rendered as a drifting orb of THEIR
// OWN emotional color. Someone here right now pulses live and bright; someone
// who left an hour ago fades to afterglow; older passes decay out of the room
// (and live on as the gradient's grain). No names. No counts. Just presence
// you can feel — the thing you open your profile at 3am to watch.
//
// Grounded in real events (the local notification store, and remote traces
// when a backend is wired), with a faint ambient layer so an empty room still
// feels occupied by the wider band — never a dead page.

// mirrors the start-tint of each mood in profileMood.ts, so a visitor's
// "feeling" here reads in the same palette their own page gives off
const FEELINGS: Array<{ key: string; color: string }> = [
  { key: 'tender', color: '#b9889b' },
  { key: 'restless', color: '#a87f93' },
  { key: 'numb', color: '#828c9b' },
  { key: 'hopeful', color: '#7fa6b4' },
  { key: 'heavy', color: '#6a6f93' },
]

// the phantom always drifts through as the same void-colored null
const PHANTOM = { key: 'null', color: '#8a6fc6' }

export type PresenceTier = 'live' | 'recent' | 'fading'

export interface Presence {
  id: string
  feeling: string
  color: string
  /** 20–200, seeds the orb's size */
  hz: number
  /** rendered diameter in px */
  size: number
  tier: PresenceTier
  ageMs: number
  /** what they did as they passed: listened / resonated / tuned in / drifted through */
  verb: string
  /** 0–100 placement in the room */
  x: number
  y: number
  /** drift travel (px) + timing, seeded so nothing lines up */
  driftX: number
  driftY: number
  driftDur: number
  delay: number
  /** ambient souls are the wider band at this hour, not visitors of yours */
  ambient: boolean
}

export const LIVE_MS = 2 * 60 * 1000
const RECENT_MS = 60 * 60 * 1000
export const WINDOW_MS = 12 * 60 * 60 * 1000
export const MAX_PRESENCES = 9

// only interactions from OTHER souls become presences — system/self events
// (return moments, recaps) never drift through your room
const VISITOR_TYPES = new Set(['new_reaction', 'new_listener', 'new_listener_follow', 'phantom_interaction'])

const VERBS: Record<string, string> = {
  new_reaction: 'resonated',
  new_listener: 'listened',
  new_listener_follow: 'tuned in',
  phantom_interaction: 'drifted through',
}

function hash(str: string): number {
  let h = 17
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}

function tierFor(ageMs: number): PresenceTier {
  if (ageMs < LIVE_MS) return 'live'
  if (ageMs < RECENT_MS) return 'recent'
  return 'fading'
}

/** Build one presence from a real pass-through event. Deterministic per id. */
export function presenceFromEvent(
  id: string,
  type: string,
  createdAt: number,
  now: number = Date.now(),
): Presence {
  const seed = hash(id)
  const phantom = type === 'phantom_interaction'
  const face = phantom ? PHANTOM : FEELINGS[seed % FEELINGS.length]
  const hz = Math.round((20 + (seed % 1800) / 10) * 10) / 10
  const ageMs = Math.max(0, now - createdAt)
  // deeper frequencies read as larger, heavier presences
  const size = Math.round(30 + (200 - hz) / 200 * 26)
  return {
    id,
    feeling: face.key,
    color: face.color,
    hz,
    size,
    tier: tierFor(ageMs),
    ageMs,
    verb: VERBS[type] ?? 'passed through',
    x: 8 + (seed % 84),
    y: 12 + ((seed >> 3) % 68),
    driftX: 8 + ((seed >> 5) % 22),
    driftY: 6 + ((seed >> 7) % 16),
    driftDur: 26 + ((seed >> 4) % 28),
    delay: -((seed >> 6) % 24),
    ambient: false,
  }
}

type LocalNote = { id?: string; type?: string; createdAt?: number }

function readLocalEvents(): LocalNote[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem('ecosphere:localNotifications') ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

/**
 * The souls drifting through your frequency right now — real passes-through in
 * the last {@link WINDOW_MS}, freshest first, capped for a calm room.
 */
export function readPresences(now: number = Date.now()): Presence[] {
  return readLocalEvents()
    .filter((n): n is LocalNote & { createdAt: number } =>
      typeof n.createdAt === 'number' && VISITOR_TYPES.has(String(n.type)) && now - n.createdAt < WINDOW_MS)
    .map(n => presenceFromEvent(String(n.id ?? n.createdAt), String(n.type), n.createdAt, now))
    .sort((a, b) => a.ageMs - b.ageMs)
    .slice(0, MAX_PRESENCES)
}

/**
 * Faint far-off souls for a quiet room — the wider band at this hour, not
 * visitors of yours. Deterministic per seed so the room is steady, not random.
 */
export function ambientPresences(seed: number, count = 3): Presence[] {
  const out: Presence[] = []
  for (let i = 0; i < count; i += 1) {
    const s = hash(`ambient-${seed}-${i}`)
    const face = FEELINGS[s % FEELINGS.length]
    const hz = Math.round((20 + (s % 1800) / 10) * 10) / 10
    out.push({
      id: `ambient-${seed}-${i}`,
      feeling: face.key,
      color: face.color,
      hz,
      size: 18 + (s % 12),
      tier: 'fading',
      ageMs: WINDOW_MS,
      verb: 'somewhere on the band',
      x: 10 + (s % 80),
      y: 14 + ((s >> 3) % 64),
      driftX: 10 + ((s >> 5) % 20),
      driftY: 8 + ((s >> 7) % 14),
      driftDur: 34 + ((s >> 4) % 30),
      delay: -((s >> 6) % 30),
      ambient: true,
    })
  }
  return out
}

/** A soft, non-numeric read of the room's state for the caption. */
export function roomMood(presences: Presence[]): string {
  const real = presences.filter(p => !p.ambient)
  if (real.length === 0) return 'quiet tonight · faint signals drifting far off'
  const live = real.filter(p => p.tier === 'live')
  if (live.length > 0) {
    return live.length === 1 ? 'someone is here now' : 'a few are here now'
  }
  return real.length === 1 ? 'someone lingered a while ago' : 'souls have drifted through tonight'
}

/** The line a single presence whispers. Emotional, never a tally. */
export function presenceLine(p: Presence, relative: string): string {
  if (p.ambient) return `someone ${p.feeling}, far off on the band`
  if (p.feeling === 'null') return p.tier === 'live' ? 'carrier_null is here now' : `carrier_null drifted through · ${relative}`
  if (p.tier === 'live') return `someone ${p.feeling} is here now`
  return `someone ${p.feeling} ${p.verb} · ${relative}`
}
