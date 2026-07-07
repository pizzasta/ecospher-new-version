// Carrier Room: one frequency, one carrier at a time. The whole anti-chaos
// model is physics — only one signal holds the frequency cleanly, so speaking
// is turn-taking by nature, not by rule. This is the local/simulated slice:
// deterministic carriers rotate on a fixed cadence so you can feel the full
// flow (queue, hand-off, mute, drift) before real-time audio is wired.

export const HOLD_MS = 24000        // a simulated carrier holds the frequency ~24s
export const YOUR_CAP_MS = 90000    // your turn caps at 90s
export const DEAD_AIR_MS = 10000    // silence this long and the carrier drifts off

export type FlowMode = 'queue' | 'auto-priority' | 'round-robin' | 'keeper-led' | 'open-drift' | 'listen-only'

export const FLOW_MODES: { value: FlowMode; label: string; hint: string }[] = [
  { value: 'queue', label: 'queue', hint: 'request the carrier, take turns in line' },
  { value: 'auto-priority', label: 'auto priority', hint: 'the band lifts whoever has waited longest unheard' },
  { value: 'round-robin', label: 'round-robin', hint: 'the carrier comes to everyone in turn' },
  { value: 'keeper-led', label: 'keeper-led', hint: 'the keeper hands out the carrier' },
  { value: 'open-drift', label: 'open drift', hint: 'up to two carriers at once' },
  { value: 'listen-only', label: 'listen only', hint: 'no carriers — just the ambient band' },
]

/** The carrier ring in round-robin: participants plus one "you" slot at the end. */
export function ringIndex(now: number, count: number, holdMs = HOLD_MS): number {
  return Math.floor(now / holdMs) % (count + 1)
}

export function roundRobinIsYou(now: number, count: number, holdMs = HOLD_MS): boolean {
  return ringIndex(now, count, holdMs) === count
}

export interface Participant { id: string; sigil: string; color: string }

const SIGILS = ['∿', '⬡', '◐', '⌖', '✦', '▦', '◌', '◈', '◑', '◬']
const COLORS = ['#ff2d78', '#00d4ff', '#9b5de9', '#5fe0a0', '#ffd166', '#ff6b35']

/** Deterministic, anonymous participants — sigils + colors only, never names. */
export function makeParticipants(seed: number, n: number): Participant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${seed}-${i}`,
    sigil: SIGILS[(seed + i) % SIGILS.length],
    color: COLORS[(seed + i * 3) % COLORS.length],
  }))
}

/** Which participant holds the carrier right now (deterministic rotation). */
export function simCarrierIndex(now: number, count: number, holdMs = HOLD_MS): number {
  if (count <= 0) return 0
  return Math.floor(now / holdMs) % count
}

/** The rotation "turn number" — increments each time the carrier passes. */
export function carrierTurn(now: number, holdMs = HOLD_MS): number {
  return Math.floor(now / holdMs)
}

/** Milliseconds left in the current sim carrier's turn. */
export function carrierRemaining(now: number, holdMs = HOLD_MS): number {
  return holdMs - (now % holdMs)
}

/** mm:ss for a duration. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ─── auto priority: the band decides who speaks ───────────────────────────────
// Nobody requests, nobody is skipped. Every listener carries a visible score:
// turns waited since they last held the carrier (dominant — waiting always
// wins eventually, so no one starves) plus a small resonance affinity with
// the room (seeded per participant — it varies the order and breaks ties).
// The highest score is lifted onto the carrier automatically.

export interface PriorityEntry {
  id: string
  isYou: boolean
  sigil: string
  color: string
  /** whole turns since this listener last held the carrier */
  waited: number
  /** 0-9 seeded affinity with this room's frequency */
  resonance: number
  score: number
}

/** Seeded, stable resonance affinity between a listener and a room. */
export function resonanceFor(id: string, roomSeed: number): number {
  let h = roomSeed || 7
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 0x7fffffff
  return h % 10
}

export const YOU_ID = 'you'

/**
 * Rank everyone (participants + you) by speaking priority for the given turn.
 * `lastHeld` maps listener id → the turn they last held the carrier; absent
 * means never, which counts from the room's first turn so newcomers rise fast.
 */
export function priorityOrder(
  participants: Participant[],
  turn: number,
  firstTurn: number,
  lastHeld: Record<string, number>,
  roomSeed: number,
  you: { sigil: string; color: string },
): PriorityEntry[] {
  const entries: PriorityEntry[] = [
    ...participants.map(p => ({ id: p.id, isYou: false, sigil: p.sigil, color: p.color })),
    { id: YOU_ID, isYou: true, sigil: you.sigil, color: you.color },
  ].map(base => {
    const held = lastHeld[base.id]
    const waited = Math.max(0, turn - (held ?? firstTurn - 1))
    const resonance = resonanceFor(base.id, roomSeed)
    return { ...base, waited, resonance, score: waited * 10 + resonance }
  })
  // highest score first; stable id tiebreak keeps the order deterministic
  return entries.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
}

/** The listener the band lifts for this turn. */
export function priorityCarrier(
  participants: Participant[],
  turn: number,
  firstTurn: number,
  lastHeld: Record<string, number>,
  roomSeed: number,
  you: { sigil: string; color: string },
): PriorityEntry {
  return priorityOrder(participants, turn, firstTurn, lastHeld, roomSeed, you)[0]
}
