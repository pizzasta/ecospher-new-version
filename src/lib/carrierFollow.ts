// Tune to a carrier (a lightweight follow), kept on-device. With a backend the
// listens table + notify_on_listen trigger already handle real cross-user
// follows; this local set keeps the action working offline and for the
// deterministic ghost/feed carriers that have no backend profile.

const KEY = 'ecosphere:tunedCarriers'

function readSet(): string[] {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as string[] } catch { return [] }
}
function writeSet(list: string[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200))) } catch { /* session only */ }
}

export function isTuned(handle: string): boolean {
  return readSet().includes(handle)
}

/** Toggle tuned state; returns the new state. */
export function toggleTune(handle: string): boolean {
  const set = readSet()
  if (set.includes(handle)) { writeSet(set.filter(h => h !== handle)); return false }
  writeSet([handle, ...set]); return true
}

export function tunedCount(): number {
  return readSet().length
}

/** A calm "others tuned in" figure: a deterministic baseline + you. */
export function carrierTunedCount(handle: string): number {
  let h = 7
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) % 9973
  return 3 + (h % 40) + (isTuned(handle) ? 1 : 0)
}
