// Lived-in traces — seeded, slowly-rotating evidence that other people move
// through these pages. Pure presentation; rotates per hour block so repeat
// visits feel different.

const HANDLES = [
  'blurrywafflehouse', 'gasstationoracle', 'sodacanecho', 'porchlightorbit',
  'fridgehumat3am', 'leftoneearbudin', 'dialtoneangel', 'reststopfog',
  'microwavecathedral', 'walmartparkinglotfog', 'lowbatteryphilosophy',
  'cryingincheckoutlane', 'voicemailafter2', 'hoodiebythelake',
  'overcookedhotpocket', 'grandmasashtray', 'peachstreetlight',
  'carradiobaptism', 'sinkfullofdishes', 'mothsinthelamplight',
]

const TRACE_TEMPLATES = [
  '{h} replayed this while driving',
  '{h} stayed here {m} minutes longer than they meant to',
  '{h} heard this during a thunderstorm',
  '{h} said this was too relatable and left',
  '{h} listened at 3:1{d}am for no reason',
  '{h} muted it halfway, then unmuted',
  '{h} said it sounded different after midnight',
  '{h} almost sent this to somebody',
  '{h} was avoiding a text the whole time',
  '{h} replayed the ending {d} times',
]

function hash(str: string): number {
  let h = 19
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}

function seededRand(seed: number) {
  let s = seed || 7
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return Math.abs(s) / 0x7fffffff
  }
}

/** Human presence lines for a page, rotating each hour. */
export function livedInLines(pageKey: string, count = 3): string[] {
  const hourBlock = Math.floor(Date.now() / 3600000)
  const rand = seededRand(hash(pageKey) + hourBlock * 97)
  const lines: string[] = []
  const usedHandles = new Set<number>()
  const usedTemplates = new Set<number>()
  for (let i = 0; i < count; i++) {
    let hi = Math.floor(rand() * HANDLES.length)
    while (usedHandles.has(hi)) hi = (hi + 1) % HANDLES.length
    usedHandles.add(hi)
    let ti = Math.floor(rand() * TRACE_TEMPLATES.length)
    while (usedTemplates.has(ti)) ti = (ti + 1) % TRACE_TEMPLATES.length
    usedTemplates.add(ti)
    lines.push(
      TRACE_TEMPLATES[ti]
        .replace('{h}', HANDLES[hi])
        .replace('{m}', String(2 + Math.floor(rand() * 40)))
        .replace('{d}', String(2 + Math.floor(rand() * 7))),
    )
  }
  return lines
}

/** A gently fluctuating listener count, deterministic per (key, tick). */
export function listenerCount(key: string, tick: number): number {
  const rand = seededRand(hash(key) + tick * 31)
  return 2 + Math.floor(rand() * 7)
}

/** "last examined by …" trace for detail views. */
export function lastExaminedBy(key: string): string {
  const hourBlock = Math.floor(Date.now() / 3600000)
  const rand = seededRand(hash(key) + hourBlock * 53)
  const handle = HANDLES[Math.floor(rand() * HANDLES.length)]
  const minutes = 1 + Math.floor(rand() * 50)
  return `last examined by ${handle} · ${minutes}m ago`
}
