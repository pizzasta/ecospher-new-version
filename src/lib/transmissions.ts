// Transmissions: messaging with no addressing. You speak into a frequency band
// (a feeling), not at a person. The transmission drifts, and after a delay a
// carrier whose signal resonates with that band echoes back — you never chose
// them. Replies are echoes, not threads. Local-first; the reply carrier is a
// real (curated) handle you can open. When a backend is on, the same shape
// fans out to real listeners.

import { GHOST_ARCHIVE } from './ghostArchive'

export type Band = { id: string; label: string; mood: string; line: string }

// each band maps to a signal mood, so replies come from carriers on that wave
export const BANDS: Band[] = [
  { id: 'tender', label: 'tender', mood: 'bloom', line: 'soft, hopeful, a little open' },
  { id: 'sleepless', label: 'sleepless', mood: 'nocturne', line: 'still awake, the deep hours' },
  { id: 'drifting', label: 'drifting', mood: 'drift', line: 'unmoored, thinking sideways' },
  { id: 'restless', label: 'restless', mood: 'static', line: 'wired, noise under everything' },
  { id: 'aching', label: 'aching', mood: 'lost', line: 'missing someone, or something' },
]

export type Reply = { handle: string; text: string; seed: number; mood: string }
export type Transmission = {
  id: string
  bandId: string
  text: string
  voiceId?: string
  at: number
  replyAt: number
  reply?: Reply
  heard?: boolean
}

const KEY = 'ecosphere:transmissions'
// compressed "drift latency" so it's felt but demoable in a session
export const REPLY_DELAY_MS = 45_000

function read(): Transmission[] {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as Transmission[] } catch { return [] }
}
function write(list: Transmission[]) {
  try { window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40))) } catch { /* session only */ }
}
function hash(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 0x7fffffff
  return h
}

// resonance match: a carrier on the same wave echoes back (deterministic per
// transmission, so it's stable across reloads)
function matchReply(t: Transmission): Reply {
  const band = BANDS.find(b => b.id === t.bandId)
  const pool = GHOST_ARCHIVE.filter(g => g.mood === band?.mood)
  const arr = pool.length > 0 ? pool : GHOST_ARCHIVE
  const g = arr[hash(t.id) % arr.length]
  return { handle: g.handle, text: g.content, seed: g.waveformSeed, mood: g.mood }
}

export function sendTransmission(bandId: string, text: string, voiceId?: string): Transmission {
  const now = Date.now()
  const t: Transmission = {
    id: crypto.randomUUID?.() ?? `tx-${now}`,
    bandId,
    text: text.trim().replace(/\s+/g, ' ').slice(0, 200),
    voiceId,
    at: now,
    replyAt: now + REPLY_DELAY_MS,
  }
  write([t, ...read()])
  return t
}

/** All transmissions, materializing any reply whose drift delay has elapsed. */
export function listTransmissions(now = Date.now()): Transmission[] {
  let changed = false
  const list = read().map(t => {
    if (!t.reply && now >= t.replyAt) { changed = true; return { ...t, reply: matchReply(t) } }
    return t
  })
  if (changed) write(list)
  return list
}

export function markHeard(id: string): void {
  write(read().map(t => (t.id === id ? { ...t, heard: true } : t)))
}

/** Seconds until a transmission's reply drifts in (0 once due). */
export function replyDueIn(t: Transmission, now = Date.now()): number {
  return Math.max(0, Math.ceil((t.replyAt - now) / 1000))
}
