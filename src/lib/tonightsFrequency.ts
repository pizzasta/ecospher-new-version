// Tonight's Frequency: each night the whole band settles on one shared station
// — a feeling, not a question. You leave a ten-second signal on it, and the
// NEXT night you hear the band's woven echo of what was left there (including
// your own voice from last night). One clean nightly loop: come back to hear
// what the band made of last night, and to add to tonight's.
//
// Deterministic + local-first: the station and the woven layers are seeded by
// the day, so every device agrees without a backend, and your own contribution
// is replayed from local storage.

import type { ChainLayerSource } from './sampleAudio'

export interface Frequency { id: string; label: string; hz: string; line: string }

// the stations rotate by day; each line doubles as a gentle recording prompt
export const FREQUENCIES: Frequency[] = [
  { id: 'still-awake', label: 'still awake', hz: '88.1', line: "for everyone who couldn't put the night down" },
  { id: 'almost-said', label: 'the thing you almost said', hz: '92.7', line: 'leave it here instead' },
  { id: 'miss-at-3', label: 'who you miss at 3am', hz: '103.5', line: 'say their initial, nothing more' },
  { id: 'stuck-song', label: 'the song stuck in you', hz: '96.3', line: 'hum eight seconds of it' },
  { id: 'today-felt', label: 'what today actually felt like', hz: '101.1', line: 'uncut, no filter' },
  { id: 'didnt-send', label: "the text you didn't send", hz: '89.9', line: 'read it out loud, once' },
  { id: 'rather-be', label: "somewhere you'd rather be", hz: '107.7', line: 'describe the light there' },
  { id: 'year-ago', label: 'the you from a year ago', hz: '94.5', line: 'tell them one thing' },
  { id: 'kept-you-up', label: 'what kept you up', hz: '99.1', line: 'name it and let it drift' },
  { id: 'small-good', label: 'a small good thing', hz: '105.3', line: 'ten seconds, low bar, say it anyway' },
  { id: 'made-you-laugh', label: 'the last thing that made you laugh', hz: '91.3', line: 'do the laugh' },
  { id: 'not-telling', label: "what you're not telling anyone", hz: '102.9', line: "you don't have to finish the sentence" },
  { id: 'your-room', label: 'the sound of your room right now', hz: '87.5', line: 'just hold the phone up' },
  { id: 'would-call', label: "who you'd call if it were earlier", hz: '100.7', line: "say what you'd open with" },
]

function hash(key: string): number {
  let h = 5
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 0x7fffffff
  return h
}

function dayOf(now: number): number { return Math.floor(now / 86400000) }

export function tonightsFrequency(now = Date.now()): Frequency {
  return FREQUENCIES[dayOf(now) % FREQUENCIES.length]
}

export function lastNightsFrequency(now = Date.now()): Frequency {
  const idx = (dayOf(now) - 1) % FREQUENCIES.length
  return FREQUENCIES[(idx + FREQUENCIES.length) % FREQUENCIES.length]
}

// ─── your contribution (local) ────────────────────────────────────────────────

const KEY = 'ecosphere:tonightsFreq'

export interface Contribution { day: number; uploadId?: string }

export function myContribution(): Contribution | null {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? 'null') } catch { return null }
}

export function contributedTonight(now = Date.now()): boolean {
  return myContribution()?.day === dayOf(now)
}

export function recordContribution(uploadId: string, now = Date.now()): void {
  try { window.localStorage.setItem(KEY, JSON.stringify({ day: dayOf(now), uploadId })) } catch { /* session only */ }
}

/** The upload id of last night's contribution, if you left one. */
export function lastNightUploadId(now = Date.now()): string | null {
  const c = myContribution()
  return c && c.day === dayOf(now) - 1 ? (c.uploadId ?? null) : null
}

// ─── last night's woven echo ──────────────────────────────────────────────────

/** Layers for last night's weave: deterministic sim voices + your own clip. */
export function weaveSources(now = Date.now(), myBlob?: Blob | null): ChainLayerSource[] {
  const f = lastNightsFrequency(now)
  const base = hash(f.id) + (dayOf(now) - 1)
  const kinds: Array<'voice' | 'whisper' | 'tone'> = ['voice', 'whisper', 'tone', 'voice', 'whisper']
  const layers: ChainLayerSource[] = kinds.map((kind, i) => ({
    kind,
    seed: base + i * 97,
    durationMs: 6000,
    volume: 0.1 + (i % 3) * 0.04,
    delayMs: i * 850,
  }))
  if (myBlob) layers.push({ blob: myBlob, volume: 0.42, delayMs: 600 })
  return layers
}
