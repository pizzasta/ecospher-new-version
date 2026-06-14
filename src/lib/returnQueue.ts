// The return queue: signals you mark to come back to, with a feeling
// attached. 'return after midnight' stays asleep until 12am; everything
// else surfaces whenever the palette opens. Local-first, like everything.

export const RETURN_TAGS = [
  'return after midnight',
  'save for driving',
  'late-night replay',
  'comfort signal',
] as const

export type ReturnTag = (typeof RETURN_TAGS)[number]

export type ReturnMark = {
  id: string
  label: string
  page: string
  tag: ReturnTag
  savedAt: number
}

const KEY = 'ecosphere:returnQueue'
const MAX_MARKS = 24

export function listReturns(): ReturnMark[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as ReturnMark[]
    return Array.isArray(raw) ? raw.filter(m => m && typeof m.id === 'string') : []
  } catch {
    return []
  }
}

export function addReturn(mark: Omit<ReturnMark, 'savedAt'>): ReturnMark[] {
  const next = [
    { ...mark, savedAt: Date.now() },
    ...listReturns().filter(m => m.id !== mark.id),
  ].slice(0, MAX_MARKS)
  try { window.localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* session only */ }
  return next
}

export function removeReturn(id: string): ReturnMark[] {
  const next = listReturns().filter(m => m.id !== id)
  try { window.localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* session only */ }
  return next
}

/** Marks that should surface right now. Midnight marks wait for midnight. */
export function dueReturns(now = new Date()): ReturnMark[] {
  const hour = now.getHours()
  const afterMidnight = hour >= 0 && hour < 6
  return listReturns().filter(m => (m.tag === 'return after midnight' ? afterMidnight : true))
}

/** The line shown while a midnight mark is still waiting. */
export function waitingReturns(now = new Date()): ReturnMark[] {
  const hour = now.getHours()
  const afterMidnight = hour >= 0 && hour < 6
  return afterMidnight ? [] : listReturns().filter(m => m.tag === 'return after midnight')
}
