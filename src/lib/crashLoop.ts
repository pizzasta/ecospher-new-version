// Crash-loop detection for the SignalErrorBoundary. A single render crash is
// recoverable with a plain reload; a *loop* means the cause survives reloads
// (usually poisoned persisted state or a deterministic bug), so the boundary
// must escalate to a real reset instead of leaving the user stuck re-tuning the
// "signal interrupted" screen forever. We track recent crash timestamps in
// localStorage so the count persists across the reloads the user triggers.

const CRASH_LOG_KEY = 'ecosphere:crashLog'
const LOOP_WINDOW_MS = 60_000
const LOOP_THRESHOLD = 3
const MAX_ENTRIES = 10

/** How many crashes within the window count as a loop (exported for the UI). */
export const CRASH_LOOP_THRESHOLD = LOOP_THRESHOLD

function readLog(): number[] {
  try {
    const raw = window.localStorage.getItem(CRASH_LOG_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

function writeLog(entries: number[]): void {
  try {
    window.localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch { /* storage unavailable — loop detection simply degrades to off */ }
}

/**
 * Record a crash happening now and return how many crashes occurred within the
 * recent window (including this one). Never throws.
 */
export function recordCrash(now = Date.now()): number {
  const recent = readLog().filter((t) => now - t < LOOP_WINDOW_MS)
  recent.push(now)
  writeLog(recent)
  return recent.length
}

/** True once crashes have repeated past the threshold inside the window. */
export function isCrashLooping(now = Date.now()): boolean {
  return readLog().filter((t) => now - t < LOOP_WINDOW_MS).length >= LOOP_THRESHOLD
}

/** Forget recorded crashes — call after a confirmed-healthy boot. */
export function clearCrashLog(): void {
  try { window.localStorage.removeItem(CRASH_LOG_KEY) } catch { /* ignore */ }
}
