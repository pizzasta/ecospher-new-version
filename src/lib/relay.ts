// Relay — the instant-share, rebuilt for a network with no audiences.
//
// Everywhere else, a repost pins content to your profile and feeds a graph.
// Here nobody has a profile feed to pin to, so relaying does something no
// share button has done: it pushes the voice PHYSICALLY further down the
// band, and it leaves you inside the sound. Every carrier who relays a
// signal adds their Hz tone to its chorus — play a much-relayed signal and
// you hear a chord of everyone who carried it. Spread you can hear, not
// count. Distance instead of virality. Anonymity intact: the chorus knows
// frequencies, never names.
//
// One tap, irreversible the way wind is — a voice you pushed further can't
// be pulled back, but nothing about you travels with it except a tone.
//
// Local-first: other carriers are seeded per signal and the signal keeps
// drifting further between visits (a few km an hour — it's still out there,
// still moving, whether or not you're watching).

export interface RelayState {
  signalId: string
  /** every carrier's Hz in the chorus, oldest first (yours last if relayed) */
  carriers: number[]
  /** how far down the band the signal has travelled */
  distanceKm: number
  relayedByMe: boolean
}

const KEY = 'ecosphere:relays'

/** km the signal keeps drifting per hour, per carrier pushing it */
const DRIFT_KM_PER_CARRIER_HOUR = 1.6

function hashString(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 0x7fffffff
  return h
}

function seededRand(seed: number) {
  let s = seed || 7
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return s / 0x7fffffff
  }
}

type MineStore = Record<string, { hz: number; at: number; gustKm: number }>

function readMine(): MineStore {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as MineStore } catch { return {} }
}

function writeMine(store: MineStore): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* session only */ }
}

/** The carriers already in a signal's chorus — seeded, stable per signal. */
export function ghostCarriers(signalId: string): number[] {
  const rand = seededRand(hashString(signalId) ^ 0x7e1a)
  const count = 1 + Math.floor(rand() * 7) // 1-7 voices already inside
  return Array.from({ length: count }, () => Math.round((30 + rand() * 170) * 10) / 10)
}

/** A fixed anchor so distance only ever grows — the signal never comes back. */
const BAND_EPOCH = Date.UTC(2026, 0, 1)

/** How long this signal has been travelling: seeded hours plus real drift. */
function travelHours(signalId: string, now: number): number {
  const castHoursAgo = 2 + (hashString(signalId) % 70)
  const sinceEpochHours = Math.max(0, (now - BAND_EPOCH) / 3_600_000)
  // gentle, monotonic creep — a few extra km each real hour that passes
  return castHoursAgo + sinceEpochHours * 0.05
}

/** Full relay state for a signal — ghosts plus anything you added. */
export function relayState(signalId: string, now = Date.now()): RelayState {
  const ghosts = ghostCarriers(signalId)
  const mine = readMine()[signalId]
  const carriers = mine ? [...ghosts, mine.hz] : ghosts
  const hours = travelHours(signalId, now)
  const rand = seededRand(hashString(signalId) ^ 0x3d)
  const base = carriers.length * (35 + rand() * 45)
  const drift = carriers.length * DRIFT_KM_PER_CARRIER_HOUR * hours
  const gust = mine?.gustKm ?? 0
  return {
    signalId,
    carriers,
    distanceKm: Math.round(base + drift + gust),
    relayedByMe: Boolean(mine),
  }
}

/**
 * Relay a signal: push it further down the band and fold your Hz into its
 * chorus. Returns the new state. Idempotent — a voice is only pushed once.
 */
export function relaySignal(signalId: string, myHz: number, now = Date.now()): RelayState {
  const store = readMine()
  if (!store[signalId]) {
    const rand = seededRand(hashString(signalId + 'gust') ^ Math.round(myHz * 10))
    store[signalId] = { hz: myHz, at: now, gustKm: Math.round(40 + rand() * 50) }
    writeMine(store)
  }
  return relayState(signalId, now)
}

export function hasRelayed(signalId: string): boolean {
  return signalId in readMine()
}

/** How many signals you've pushed further — quiet fact, not a score. */
export function relayCount(): number {
  return Object.keys(readMine()).length
}

/** A human line for where the signal is now. */
export function distanceLine(state: RelayState): string {
  const voices = state.carriers.length
  const who = voices === 1 ? 'one voice' : `${voices} voices`
  return state.relayedByMe
    ? `carried ${state.distanceKm} km by ${who} — yours is in it now`
    : `carried ${state.distanceKm} km down the band by ${who}`
}
