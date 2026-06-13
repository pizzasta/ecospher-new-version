// Cast-volume metrics, anonymity-safe: a local daily tally only — counts, never
// content, never identity. Feeds the Observatory's sense of how full the sea is
// tonight. A backend would mirror this as an aggregate `metrics` row.

const KEY = 'ecosphere:castMetrics'

function day(now: number): number { return Math.floor(now / 86400000) }

export function bumpCastToday(now = Date.now()): void {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as { day: number; count: number } | null
    const d = day(now)
    const count = raw && raw.day === d ? raw.count + 1 : 1
    window.localStorage.setItem(KEY, JSON.stringify({ day: d, count }))
  } catch { /* session only */ }
}

export function castsToday(now = Date.now()): number {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as { day: number; count: number } | null
    return raw && raw.day === day(now) ? raw.count : 0
  } catch { return 0 }
}
