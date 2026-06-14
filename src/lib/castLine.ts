// Cast a Line reliability. Lines are tiny (5–7 words), so payload is never the
// problem — the work is making rapid casts feel instant and fair: an optimistic
// per-line status for the drift, and a rate limiter that lets a few casts
// through in a row but keeps one person from flooding the sea.

export type CastStatus = 'casting' | 'drifting' | 'failed'

export const CAST_RATE = {
  perWindow: 8,       // up to 8 casts…
  windowMs: 60_000,   // …per rolling minute
  minGapMs: 2500,     // …and no faster than one every ~2.5s
}

const LEDGER_KEY = 'ecosphere:castLedger'

function readLedger(): number[] {
  try { return JSON.parse(window.localStorage.getItem(LEDGER_KEY) ?? '[]') } catch { return [] }
}
function writeLedger(times: number[]): void {
  try { window.localStorage.setItem(LEDGER_KEY, JSON.stringify(times.slice(-CAST_RATE.perWindow * 2))) } catch { /* session only */ }
}

export interface CastGate { allowed: boolean; waitMs: number; reason: string | null }

/** Fair check: a short gap between casts, and a soft ceiling per minute. */
export function castRateCheck(now = Date.now()): CastGate {
  const times = readLedger().filter(t => now - t < CAST_RATE.windowMs)
  const last = times[times.length - 1] ?? 0
  if (last && now - last < CAST_RATE.minGapMs) {
    return { allowed: false, waitMs: CAST_RATE.minGapMs - (now - last), reason: 'one breath between casts — let the last line drift' }
  }
  if (times.length >= CAST_RATE.perWindow) {
    return { allowed: false, waitMs: CAST_RATE.windowMs - (now - times[0]), reason: 'the sea’s full of your voice for now — give it a minute' }
  }
  return { allowed: true, waitMs: 0, reason: null }
}

export function recordCast(now = Date.now()): void {
  const times = readLedger().filter(t => now - t < CAST_RATE.windowMs)
  writeLedger([...times, now])
}

export function castWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
