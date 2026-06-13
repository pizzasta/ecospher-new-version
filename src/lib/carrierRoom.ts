// Carrier Room: one frequency, one carrier at a time. The whole anti-chaos
// model is physics — only one signal holds the frequency cleanly, so speaking
// is turn-taking by nature, not by rule. This is the local/simulated slice:
// deterministic carriers rotate on a fixed cadence so you can feel the full
// flow (queue, hand-off, mute, drift) before real-time audio is wired.

export const HOLD_MS = 24000        // a simulated carrier holds the frequency ~24s
export const YOUR_CAP_MS = 90000    // your turn caps at 90s
export const DEAD_AIR_MS = 10000    // silence this long and the carrier drifts off

export type FlowMode = 'queue' | 'round-robin' | 'keeper-led' | 'open-drift' | 'listen-only'

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
