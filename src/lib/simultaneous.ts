// The Simultaneous — the one thing no feed can give you.
//
// TikTok and Facebook are you, alone, in a stream tuned to keep you there.
// The Simultaneous is the opposite: a moment where everyone on the band is
// genuinely here at the same second. Because it opens on a deterministic
// wall-clock schedule, every person — on whatever page — arrives at the exact
// same real-world instant. Real synchronicity, no server, no algorithm.
//
// A moment is a soft invitation, never a takeover: join it, or let it pass.
// While it's open the whole band shares one prompt and one held tone. It's
// rare (a couple of times a night), skippable, and remembered so it never
// nags. Local-first and deterministic: same minute, same moment, everywhere.

const KEY = 'ecosphere:simultaneous'

/** How long a shared moment stays open once it begins. */
export const MOMENT_DURATION_MS = 45_000

// the shared invitations — everyone in a given moment sees the same one
const PROMPTS: Array<{ line: string; glyph: string }> = [
  { line: 'everyone on the band right now: breathe out, together.', glyph: '◯' },
  { line: 'for this minute, we are all still. nothing to scroll to.', glyph: '◌' },
  { line: 'say one word out loud. everyone here is saying one too.', glyph: '∿' },
  { line: 'the whole band is holding this tone with you.', glyph: '◉' },
  { line: 'wherever you are in here — so is everyone else, right now.', glyph: '✦' },
  { line: 'close your eyes for ten seconds. you are not doing it alone.', glyph: '☾' },
]

function hashString(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 0x7fffffff
  return h
}

/** The hour bucket that owns a moment, e.g. "2026-7-8-3". */
function hourKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`
}

/**
 * Only some hours host a moment — a couple of times a night, not every hour,
 * so it stays rare and meaningful. Deterministic per hour bucket.
 */
export function hourHostsMoment(d: Date): boolean {
  // ~1 in 4 hours hosts one → roughly a handful across a night
  return hashString(hourKey(d)) % 4 === 0
}

/** The minute within a hosting hour that the moment opens on (2–56). */
export function momentMinute(d: Date): number {
  return 2 + (hashString('m' + hourKey(d)) % 55)
}

export interface Moment {
  id: string
  line: string
  glyph: string
  /** the shared tone everyone holds, in the audible register */
  toneHz: number
  endsAt: number
}

function buildMoment(d: Date, startMs: number): Moment {
  const id = hourKey(d)
  const h = hashString(id)
  const prompt = PROMPTS[h % PROMPTS.length]
  return {
    id,
    line: prompt.line,
    glyph: prompt.glyph,
    toneHz: 174 + (h % 12) * 6, // a low, calm shared pitch (~174–240 Hz)
    endsAt: startMs + MOMENT_DURATION_MS,
  }
}

/**
 * The moment open right now, if any. Deterministic per wall-clock minute so
 * every client agrees. A preview override (localStorage
 * ecosphere:simultaneousOverride='open') forces one open for testing.
 */
export function currentMoment(now = Date.now()): Moment | null {
  try {
    if (window.localStorage.getItem('ecosphere:simultaneousOverride') === 'open') {
      return buildMoment(new Date(now), now)
    }
  } catch { /* no override */ }

  const d = new Date(now)
  if (!hourHostsMoment(d)) return null
  const start = new Date(d)
  start.setMinutes(momentMinute(d), 0, 0)
  const startMs = start.getTime()
  if (now >= startMs && now < startMs + MOMENT_DURATION_MS) {
    return buildMoment(d, startMs)
  }
  return null
}

/** Seconds left in a moment (0 once past). */
export function secondsLeft(moment: Moment, now = Date.now()): number {
  return Math.max(0, Math.ceil((moment.endsAt - now) / 1000))
}

/**
 * A calm count of others sharing the moment with you — seeded per moment so
 * everyone sees a consistent, believable number that drifts up slightly as
 * the window runs.
 */
export function othersInMoment(moment: Moment, now = Date.now()): number {
  const base = 6 + (hashString(moment.id) % 44)
  const elapsed = Math.max(0, MOMENT_DURATION_MS - (moment.endsAt - now))
  const arrived = Math.floor((elapsed / MOMENT_DURATION_MS) * 12)
  return base + arrived
}

// ─── remembering: joined / let pass, per moment ──────────────────────────────

interface Store { joined: string[]; dismissed: string[] }

function read(): Store {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return { joined: [], dismissed: [] }
    const p = JSON.parse(raw) as Partial<Store>
    return { joined: p.joined ?? [], dismissed: p.dismissed ?? [] }
  } catch {
    return { joined: [], dismissed: [] }
  }
}

function write(store: Store): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      joined: store.joined.slice(-40),
      dismissed: store.dismissed.slice(-40),
    }))
  } catch { /* session only */ }
}

export function hasJoined(id: string): boolean {
  return read().joined.includes(id)
}

export function isDismissed(id: string): boolean {
  return read().dismissed.includes(id)
}

/** True when the invitation should surface — open, and not already answered. */
export function shouldSurface(now = Date.now()): Moment | null {
  const m = currentMoment(now)
  if (!m) return null
  return isDismissed(m.id) || hasJoined(m.id) ? null : m
}

export function joinMoment(id: string): void {
  const s = read()
  if (!s.joined.includes(id)) { s.joined.push(id); write(s) }
}

export function dismissMoment(id: string): void {
  const s = read()
  if (!s.dismissed.includes(id)) { s.dismissed.push(id); write(s) }
}

/** How many shared moments you've stepped into — quiet history, never a score. */
export function momentsJoined(): number {
  return read().joined.length
}
