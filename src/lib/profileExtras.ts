// Profile extras that make a signal worth checking out — kept on-device.
//   · status: a short "now broadcasting…" line you set.
//   · featured: one signal you pin as your frequency anthem (plays on your profile).

const STATUS_KEY = 'ecosphere:signalStatus'
const FEATURED_KEY = 'ecosphere:featuredSignal'

export function readStatus(): string {
  try { return window.localStorage.getItem(STATUS_KEY) ?? '' } catch { return '' }
}
export function writeStatus(text: string): void {
  try {
    const clean = text.trim().replace(/\s+/g, ' ').slice(0, 80)
    if (clean) window.localStorage.setItem(STATUS_KEY, clean)
    else window.localStorage.removeItem(STATUS_KEY)
  } catch { /* session only */ }
}

export type FeaturedSignal = { id: string; label: string; durationMs: number }

export function readFeatured(): FeaturedSignal | null {
  try {
    const raw = window.localStorage.getItem(FEATURED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FeaturedSignal>
    return parsed && typeof parsed.id === 'string'
      ? { id: parsed.id, label: typeof parsed.label === 'string' ? parsed.label : 'your signal', durationMs: typeof parsed.durationMs === 'number' ? parsed.durationMs : 0 }
      : null
  } catch { return null }
}
export function writeFeatured(featured: FeaturedSignal | null): void {
  try {
    if (featured) window.localStorage.setItem(FEATURED_KEY, JSON.stringify(featured))
    else window.localStorage.removeItem(FEATURED_KEY)
  } catch { /* session only */ }
}
