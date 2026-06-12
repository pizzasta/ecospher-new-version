// Page traces: when you do something somewhere, a trace of it can drift
// onto the next page you visit — the connective tissue of the ecosystem.
// One trace at a time, expires in five minutes, shown once then gone.

export type PageTrace = { text: string; page: string; at: number }

const KEY = 'ecosphere:pageTrace'
const TTL = 5 * 60 * 1000

export function leaveTrace(text: string, page: string): void {
  try { window.localStorage.setItem(KEY, JSON.stringify({ text: text.slice(0, 80), page, at: Date.now() })) } catch { /* session only */ }
}

/** Trace worth showing on `currentPage` — consumed on read. */
export function takeTrace(currentPage: string, now = Date.now()): PageTrace | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as PageTrace | null
    if (!raw || raw.page === currentPage || now - raw.at > TTL) return null
    window.localStorage.removeItem(KEY)
    return raw
  } catch {
    return null
  }
}
