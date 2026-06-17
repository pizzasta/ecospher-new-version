// Cast lines that travelled. A short text signal people keep drifting back to
// graduates to relic material — the sea remembers what got passed through.
// Deterministic per day from your own cast lines (local-first; a backend would
// substitute real pass-through counts here).

const SEA_LINES_KEY = 'ecosphere:seaLines'

export interface DriftedRelic { id: string; text: string; passes: number; note: string }

const NOTES = [
  'people kept drifting back to this one',
  'it got passed through more than most',
  'someone saved it without a word',
  'it stayed on the current all night',
]

function hash(key: string): number {
  let h = 7
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 0x7fffffff
  return h
}
function day(now: number): number { return Math.floor(now / 86400000) }

/** Your cast lines that travelled far enough to become relics (top 2). */
export function driftedTextRelics(now = Date.now()): DriftedRelic[] {
  let lines: string[] = []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEA_LINES_KEY) ?? '[]')
    lines = Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch { lines = [] }
  return lines
    .map(text => {
      const seed = hash(text) + day(now)
      return { id: `dt-${hash(text)}`, text, passes: seed % 40, note: NOTES[seed % NOTES.length] }
    })
    .filter(r => r.passes >= 22) // only the well-travelled graduate
    .sort((a, b) => b.passes - a.passes)
    .slice(0, 2)
}
