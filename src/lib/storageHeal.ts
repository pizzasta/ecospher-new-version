// Boot-time storage self-heal. Returning users can carry localStorage written
// by much older builds: valid JSON, but an outdated *shape*. Readers across the
// app parse it and then access fields / call string methods, throwing during
// render (the "frequency dropped" crash). This runs once, before React mounts,
// repairs the known structured keys, drops anything unparseable, and stamps a
// schema version so healthy users never pay for it again.

import { isRecord, validEntries } from './shapeGuards'

export const STORAGE_SCHEMA_VERSION = 1
const SCHEMA_KEY = 'ecosphere:schemaVersion'
const ECOSYSTEM_STATE_KEY = 'ecosphere:EcosystemState'

function read(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full / unavailable */ }
}
function drop(key: string): void {
  try { window.localStorage.removeItem(key) } catch { /* ignore */ }
}

/** Replace a key's value with `fallback` unless it parses to the expected kind. */
function ensureKind(key: string, expect: 'object' | 'array'): void {
  const raw = read(key)
  if (raw == null) return
  try {
    const parsed = JSON.parse(raw)
    const ok = expect === 'array' ? Array.isArray(parsed) : isRecord(parsed)
    if (!ok) drop(key)
  } catch {
    drop(key)
  }
}

/** Sanitize the big EcosystemState blob in place and write it back, so the bad
 *  data is gone for good (the React layer only re-persisted on change). */
function healEcosystemState(): void {
  const raw = read(ECOSYSTEM_STATE_KEY)
  if (raw == null) return
  try {
    const s = JSON.parse(raw)
    if (!isRecord(s)) { drop(ECOSYSTEM_STATE_KEY); return }
    s.library = validEntries(s.library, ['id', 'itemType', 'label', 'savedAt'])
    s.archiveHistory = validEntries(s.archiveHistory, ['id', 'itemType', 'label', 'archivedAt'])
    s.listeningHistory = validEntries(s.listeningHistory, ['id', 'label', 'playedAt'])
    s.recentInteractions = validEntries(s.recentInteractions, ['id', 'type', 'label', 'createdAt'])
    write(ECOSYSTEM_STATE_KEY, s)
  } catch {
    drop(ECOSYSTEM_STATE_KEY)
  }
}

/** chainLayers must be an array of objects with a string `id`. */
function healChainLayers(): void {
  const raw = read('ecosphere:chainLayers')
  if (raw == null) return
  try {
    const parsed = JSON.parse(raw)
    write('ecosphere:chainLayers', validEntries(parsed, ['id']))
  } catch {
    drop('ecosphere:chainLayers')
  }
}

/** settings must be a plain object; `language`, if present, must be a string. */
function healSettings(): void {
  const raw = read('ecosphere:settings')
  if (raw == null) return
  try {
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed)) { drop('ecosphere:settings'); return }
    if ('language' in parsed && typeof parsed.language !== 'string') {
      delete parsed.language
      write('ecosphere:settings', parsed)
    }
  } catch {
    drop('ecosphere:settings')
  }
}

/** Drop any ecosphere: key whose value was *meant* to be JSON (an object,
 *  array, or quoted string) but no longer parses — those corrupt structured
 *  blobs are what poison a render. Bare scalar flags written as raw strings
 *  (e.g. 'yes', a passcode hash, a date key like '2026-06-17') are legitimate
 *  non-JSON values their readers fetch with getItem, not JSON.parse, so they
 *  are left untouched — sweeping them would silently wipe age/tour/sound/etc. */
function sweepUnparseable(): void {
  let keys: string[] = []
  try { keys = Object.keys(window.localStorage) } catch { return }
  for (const key of keys) {
    if (!key.startsWith('ecosphere:') || key === SCHEMA_KEY) continue
    const raw = read(key)
    if (raw == null) continue
    if (!/^[[{"]/.test(raw.trimStart())) continue // bare scalar flag, not corruption
    try { JSON.parse(raw) } catch { drop(key) }
  }
}

/**
 * Run once per schema version. No-op (single read) for healthy/new users.
 * Wrapped defensively by the caller; never throws.
 */
export function healLocalStorage(): void {
  if (typeof window === 'undefined') return
  let stored: number | null = null
  try { stored = Number(window.localStorage.getItem(SCHEMA_KEY)) } catch { return }
  if (stored === STORAGE_SCHEMA_VERSION) return // fast path

  sweepUnparseable()
  healEcosystemState()
  healChainLayers()
  healSettings()
  // these must be plain objects; reset to default-able shape if not
  ensureKind('ecosphere:chainReactions', 'object')
  ensureKind('ecosphere:relicActivity', 'object')
  ensureKind('ecosphere:castMetrics', 'object')
  // these must be arrays; reset if not
  ensureKind('ecosphere:driftFound', 'array')
  ensureKind('ecosphere:seaLines', 'array')

  try { window.localStorage.setItem(SCHEMA_KEY, String(STORAGE_SCHEMA_VERSION)) } catch { /* ignore */ }
}

/**
 * Force healLocalStorage to run again on the next boot by clearing the schema
 * stamp. Safe and non-destructive — the heal only repairs or drops malformed
 * data. Crash recovery calls this so a plain reload can re-sanitize persisted
 * state that the one-time heal had already fast-pathed past.
 */
export function rearmStorageHeal(): void {
  try { window.localStorage.removeItem(SCHEMA_KEY) } catch { /* ignore */ }
}
