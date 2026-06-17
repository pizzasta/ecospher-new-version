// Shared shape guards for reading persisted (localStorage) data. Old builds can
// leave behind valid JSON of an outdated shape; reading it with only a
// try/catch around JSON.parse isn't enough — the throw happens later, when code
// accesses a missing field or calls a string method on the wrong type. These
// helpers let readers (and the boot-time storage heal) fail safe instead.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Keep only array items that are objects carrying the required string-typed
 *  keys. Malformed entries (missing `label`, wrong shape) are dropped. */
export function validEntries<T>(value: unknown, requiredStringKeys: string[]): T[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (v): v is T => isRecord(v) && requiredStringKeys.every((k) => typeof v[k] === 'string'),
  )
}

/** Keep only the string members of an array; anything else is dropped. */
export function stringArrayOnly(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}
