// Leave a trace: a short line a visitor drops on a carrier's frequency (a
// guestbook). Local-first — your traces are kept on-device per handle; with a
// backend they'd fan out (see the profile_traces migration). Screened before
// it's kept.

const KEY = 'ecosphere:profileTraces'

export type Trace = { id: string; text: string; at: number }

type Store = Record<string, Trace[]>

function readStore(): Store {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Store } catch { return {} }
}
function writeStore(store: Store) {
  try { window.localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* session only */ }
}

export function readTraces(handle: string): Trace[] {
  return (readStore()[handle] ?? []).slice(0, 20)
}

/** Add a trace for a handle (newest first, capped). Returns the new list. */
export function addTrace(handle: string, text: string): Trace[] {
  const clean = text.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!clean) return readTraces(handle)
  const store = readStore()
  const trace: Trace = { id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: clean, at: Date.now() }
  store[handle] = [trace, ...(store[handle] ?? [])].slice(0, 20)
  writeStore(store)
  return store[handle]
}
