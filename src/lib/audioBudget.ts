// Audio budget: keeps voice features inside free-tier reality.
// On-device ledger of upload count/bytes per day and month, a kill-switch
// that flips the app to listen-only for the rest of the day when the
// backend signals quota trouble, and a shared low-bitrate recorder factory
// so every recording is compressed at the source.

export const AUDIO_BUDGET = {
  /** voice notes (unsent room, prompts, echoes) */
  maxNoteSeconds: 15,
  /** voice reactions */
  maxReactionSeconds: 5,
  /** signal chain contributions */
  maxChainSeconds: 10,
  /** uploads per device per day */
  dailyCount: 24,
  /** bytes per device per day */
  dailyBytes: 6 * 1024 * 1024,
  /** bytes per device per month */
  monthlyBytes: 60 * 1024 * 1024,
  /** opus voice at 32kbps ≈ 60KB per 15s — compression at the source */
  bitsPerSecond: 32000,
} as const

export const LISTEN_ONLY_MESSAGE =
  'Voice uploads are paused for now. You can still listen, save, and explore.'

type Ledger = { day: string; month: string; count: number; bytes: number; monthBytes: number; pausedUntil?: number }

const KEY = 'ecosphere:audioUsage'

function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

function monthKey(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}`
}

export function readLedger(now = new Date()): Ledger {
  const fresh: Ledger = { day: todayKey(now), month: monthKey(now), count: 0, bytes: 0, monthBytes: 0 }
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Ledger | null
    if (!raw) return fresh
    const sameMonth = raw.month === fresh.month
    const sameDay = raw.day === fresh.day
    return {
      day: fresh.day,
      month: fresh.month,
      count: sameDay ? raw.count : 0,
      bytes: sameDay ? raw.bytes : 0,
      monthBytes: sameMonth ? raw.monthBytes : 0,
      pausedUntil: raw.pausedUntil && raw.pausedUntil > now.getTime() ? raw.pausedUntil : undefined,
    }
  } catch {
    return fresh
  }
}

function writeLedger(ledger: Ledger): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(ledger)) } catch { /* session only */ }
}

export type BudgetCheck = { ok: boolean; reason?: string; warning?: string }

/** Can this device upload `bytes` more right now? */
export function canUpload(bytes: number, now = new Date()): BudgetCheck {
  const ledger = readLedger(now)
  if (ledger.pausedUntil) return { ok: false, reason: LISTEN_ONLY_MESSAGE }
  if (ledger.count + 1 > AUDIO_BUDGET.dailyCount) {
    return { ok: false, reason: `${LISTEN_ONLY_MESSAGE} (today's voice budget is spent — it resets at midnight)` }
  }
  if (ledger.bytes + bytes > AUDIO_BUDGET.dailyBytes || ledger.monthBytes + bytes > AUDIO_BUDGET.monthlyBytes) {
    return { ok: false, reason: `${LISTEN_ONLY_MESSAGE} (storage budget reached — recordings stay safe on this device)` }
  }
  const warning =
    ledger.count + 1 > AUDIO_BUDGET.dailyCount * 0.8 || ledger.bytes + bytes > AUDIO_BUDGET.dailyBytes * 0.8
      ? 'voice budget is running low for today — recordings will keep saving locally'
      : undefined
  return { ok: true, warning }
}

/** Record a successful upload against today's budget. */
export function recordUploadUsage(bytes: number, now = new Date()): void {
  const ledger = readLedger(now)
  writeLedger({ ...ledger, count: ledger.count + 1, bytes: ledger.bytes + bytes, monthBytes: ledger.monthBytes + bytes })
}

/** Backend said no (quota/storage): pause uploads until midnight. */
export function pauseUploadsForToday(now = new Date()): void {
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  writeLedger({ ...readLedger(now), pausedUntil: midnight.getTime() })
}

export function uploadsPaused(now = new Date()): boolean {
  return !!readLedger(now).pausedUntil
}

/** Does this error message smell like a storage/quota problem? */
export function isQuotaError(message: string | null | undefined): boolean {
  const m = (message ?? '').toLowerCase()
  return /quota|exceeded|too large|payload|413|storage.*(full|limit)|insufficient/.test(m)
}

/**
 * Every recorder in the app goes through here: compressed opus at voice
 * bitrate when the browser allows options, plain recorder otherwise.
 */
export function createVoiceRecorder(stream: MediaStream): MediaRecorder {
  try {
    return new MediaRecorder(stream, { audioBitsPerSecond: AUDIO_BUDGET.bitsPerSecond })
  } catch {
    return new MediaRecorder(stream)
  }
}
