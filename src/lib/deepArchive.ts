// The Deep Archive — the relics page's gravity, built from emotion, not
// reward. No points, no streaks, no rarity math. The pull is simpler and
// older than any of that:
//
//   one artifact resolves per night — the archive scans one layer down and
//     a single emotional recording surfaces, chosen by the night, not by you
//   it reseals at dawn — whatever surfaced tonight is only audible tonight;
//     at 6am the sediment closes over it again. missing it costs nothing
//     and loses something, which is how nights work
//   you can carry three things — carrying a fourth means setting one down.
//     what you keep says who you are, precisely because you can't keep it all
//
// The chrome is far-future archaeology: depth readouts, sediment eras, a
// descent that resolves signal out of static. Deterministic per night —
// reloading never changes what surfaced. Local-first like everything else.

import { nightKey } from './echolocation'

export interface Artifact {
  id: string
  name: string
  line: string
  /** sediment era the scan attributes it to — flavor, not fact */
  era: string
  glyph: string
  /** seeds its tone + voice */
  seed: number
}

export const ARTIFACTS: Artifact[] = [
  { id: 'da-held-breath', name: 'a held breath, archived', line: 'the pause before someone almost said it. the archive kept the pause.', era: 'sediment · late 2019', glyph: '◐', seed: 311 },
  { id: 'da-one-ring', name: 'the one-ring call', line: 'they let it ring once and hung up. the ring is all that survives.', era: 'sediment · winter 2016', glyph: '◉', seed: 727 },
  { id: 'da-sealed-yes', name: 'a sealed yes', line: 'an answer recorded and never delivered. the question is long gone.', era: 'sediment · unknown', glyph: '✦', seed: 947 },
  { id: 'da-tape-hiss', name: 'the hiss that stayed', line: 'a blank tape that was never blank. turn it up and something breathes.', era: 'sediment · analog stratum', glyph: '◈', seed: 133 },
  { id: 'da-first-rain', name: 'first rain on the carport', line: 'the first thirty seconds of a storm, before anyone thought to record it.', era: 'sediment · a summer', glyph: '☄', seed: 419 },
  { id: 'da-snow-monitor', name: 'snow on the baby monitor', line: 'snowfall picked up by a nursery microphone. softer than silence.', era: 'sediment · february', glyph: '❋', seed: 563 },
  { id: 'da-server-breath', name: 'the server room breath', line: 'for six minutes a night every fan syncs. the technicians never fixed it.', era: 'sediment · near future', glyph: '⟁', seed: 673 },
  { id: 'da-elevator', name: 'elevator to nowhere', line: 'a service elevator that dings on floors the building does not have.', era: 'sediment · sublevel', glyph: '⬡', seed: 809 },
  { id: 'da-dialup', name: 'dial-up aria', line: 'the handshake tone, slowed eight times. it sounds like something arriving.', era: 'sediment · 1997', glyph: '⌁', seed: 269 },
  { id: 'da-voicemail-name', name: 'the name, three times', line: 'a voicemail that says one name, three times, from a number never registered.', era: 'sediment · deleted twice', glyph: '◌', seed: 881 },
  { id: 'da-last-laugh', name: 'the last laugh on the tape', line: 'a laugh at the very end of a recording, after everyone thought it was off.', era: 'sediment · a kitchen', glyph: '∿', seed: 359 },
  { id: 'da-hold-music', name: 'the hold music nobody hated', line: 'forty seconds of hold music someone taped because it felt like waiting for good news.', era: 'sediment · office block', glyph: '▦', seed: 491 },
  { id: 'da-night-bus', name: 'heartbeat on the night bus', line: 'a heartbeat taped through a coat pocket. it still keeps time.', era: 'sediment · route 9', glyph: '⌖', seed: 613 },
  { id: 'da-doorway', name: 'the doorway pause', line: 'someone stopped in a doorway and almost turned around. the floor remembers.', era: 'sediment · a hallway', glyph: '⬢', seed: 239 },
  { id: 'da-window-left', name: 'a window left open', line: 'the night a window stayed open on purpose, and everything that came in.', era: 'sediment · spring', glyph: '≋', seed: 787 },
  { id: 'da-goodnight', name: 'the goodnight that stayed', line: 'someone said goodnight and stayed another hour. both things are true here.', era: 'sediment · 3:12am', glyph: '☾', seed: 149 },
]

export const CARRY_LIMIT = 3

interface ArchiveState {
  /** night → artifact id that surfaced (history of every descent) */
  surfaced: Record<string, string>
  /** ids you carry with you — at most CARRY_LIMIT */
  carried: string[]
}

const KEY = 'ecosphere:deepArchive'

function read(): ArchiveState {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return { surfaced: {}, carried: [] }
    const parsed = JSON.parse(raw) as Partial<ArchiveState>
    return {
      surfaced: parsed.surfaced && typeof parsed.surfaced === 'object' ? parsed.surfaced : {},
      carried: Array.isArray(parsed.carried) ? parsed.carried.slice(0, CARRY_LIMIT) : [],
    }
  } catch {
    return { surfaced: {}, carried: [] }
  }
}

function write(state: ArchiveState): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* session only */ }
}

function hashString(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 0x7fffffff
  return h
}

/**
 * The artifact the night chose — deterministic per night, biased toward what
 * you haven't heard surface before, so the archive keeps feeling bottomless.
 */
export function tonightsArtifact(now = Date.now()): Artifact {
  const night = nightKey(now)
  const state = read()
  const heardIds = new Set(Object.values(state.surfaced))
  const fresh = ARTIFACTS.filter(a => !heardIds.has(a.id))
  const pool = fresh.length > 0 ? fresh : ARTIFACTS
  return pool[hashString(night) % pool.length]
}

/** Has tonight's descent already happened? */
export function descendedTonight(now = Date.now()): boolean {
  return nightKey(now) in read().surfaced
}

/** Record tonight's descent; returns the artifact that surfaced. */
export function descend(now = Date.now()): Artifact {
  const night = nightKey(now)
  const state = read()
  const existing = state.surfaced[night]
  if (existing) return ARTIFACTS.find(a => a.id === existing) ?? ARTIFACTS[0]
  const artifact = tonightsArtifact(now)
  write({ ...state, surfaced: { ...state.surfaced, [night]: artifact.id } })
  return artifact
}

/** What surfaced tonight, if the descent already happened. */
export function surfacedTonight(now = Date.now()): Artifact | null {
  const id = read().surfaced[nightKey(now)]
  return id ? ARTIFACTS.find(a => a.id === id) ?? null : null
}

/** ms until dawn (6am), when tonight's artifact reseals. */
export function msUntilDawn(now = Date.now()): number {
  const d = new Date(now)
  const dawn = new Date(now)
  dawn.setHours(6, 0, 0, 0)
  if (d.getHours() >= 6) dawn.setDate(dawn.getDate() + 1)
  return Math.max(0, dawn.getTime() - now)
}

/** Seeded scan depth for the night — pure flavor, felt not scored. */
export function scanDepth(now = Date.now()): number {
  return 180 + (hashString(nightKey(now)) % 640)
}

// ─── carrying: three pockets, no trophies ─────────────────────────────────────

export function carriedArtifacts(): Artifact[] {
  const carried = read().carried
  return carried
    .map(id => ARTIFACTS.find(a => a.id === id))
    .filter((a): a is Artifact => Boolean(a))
}

export function isCarried(id: string): boolean {
  return read().carried.includes(id)
}

export function carryingRoom(): boolean {
  return read().carried.length < CARRY_LIMIT
}

/** Carry an artifact. False when your hands are full — set something down. */
export function carry(id: string): boolean {
  const state = read()
  if (state.carried.includes(id)) return true
  if (state.carried.length >= CARRY_LIMIT) return false
  write({ ...state, carried: [...state.carried, id] })
  return true
}

/** Set an artifact down. It isn't lost — it returns to the sediment. */
export function setDown(id: string): void {
  const state = read()
  write({ ...state, carried: state.carried.filter(c => c !== id) })
}
