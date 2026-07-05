// Echolocation — finding each other by harmony, not by search.
//
// Everyone here already *is* a frequency (the Hz signature). So discovery
// doesn't need names, bios, or browse lists: you cast your frequency into
// the dark, and the only carriers who can find their way back are the ones
// whose Hz forms a musical consonance with yours — an octave, a fifth, a
// fourth. Compatibility isn't a score on a card, it's something you can
// literally hear: the two tones either sit well together or they don't.
//
// Local-first like everything else: tonight's band presence is seeded per
// night, matches are pure math over the ghost archive, and locked harmonies
// feed the existing familiar-frequency system so repeated finds deepen into
// quiet recognition. When a backend is configured the same shapes can fan
// out over live presence instead of the archive.

import { GHOST_ARCHIVE } from './ghostArchive'
import type { GhostSignal } from './ghostArchive'
import { hzForHandle } from './hzSignature'
import { recordCrossing } from './familiarFrequency'
import { getSharedAudioContext } from './sampleAudio'

// ─── harmonic math ────────────────────────────────────────────────────────────

export type Consonance = { name: string; ratio: number }

/** The intervals the band recognises, strongest consonance first. */
export const CONSONANCES: Consonance[] = [
  { name: 'in unison', ratio: 1 },
  { name: 'an octave apart', ratio: 2 },
  { name: 'a perfect fifth apart', ratio: 3 / 2 },
  { name: 'a perfect fourth apart', ratio: 4 / 3 },
  { name: 'a major sixth apart', ratio: 5 / 3 },
  { name: 'a major third apart', ratio: 5 / 4 },
  { name: 'a minor third apart', ratio: 6 / 5 },
]

/** Cents window inside which two frequencies still count as harmonic. */
export const PURITY_WINDOW_CENTS = 45

export type HarmonicMatch = {
  interval: string
  /** 0..1 — how close to the pure interval the pair actually is */
  purity: number
  /** signed cents off the pure interval (for the tuning-needle UI) */
  centsOff: number
}

/**
 * Fold the ratio between two frequencies into one octave and test it against
 * the consonances. Returns null when the pair is dissonant — dissonant pairs
 * simply never hear each other's pings.
 */
export function harmonicMatch(aHz: number, bHz: number): HarmonicMatch | null {
  if (!(aHz > 0) || !(bHz > 0)) return null
  let r = Math.max(aHz, bHz) / Math.min(aHz, bHz)
  while (r >= 2) r /= 2
  let best: HarmonicMatch | null = null
  for (const c of CONSONANCES) {
    // compare in cents against the interval folded into [1, 2)
    const target = c.ratio >= 2 ? c.ratio / 2 : c.ratio
    const cents = 1200 * Math.log2(r / target)
    // unison and octave are the same pitch-class fold — label by raw ratio
    if (c.ratio === 1 && Math.max(aHz, bHz) / Math.min(aHz, bHz) >= 1.5) continue
    if (c.ratio === 2 && Math.max(aHz, bHz) / Math.min(aHz, bHz) < 1.5) continue
    if (Math.abs(cents) > PURITY_WINDOW_CENTS) continue
    const purity = 1 - Math.abs(cents) / PURITY_WINDOW_CENTS
    if (!best || purity > best.purity) {
      best = { interval: c.name, purity: Math.round(purity * 100) / 100, centsOff: Math.round(cents) }
    }
  }
  return best
}

// ─── tonight's band ───────────────────────────────────────────────────────────

export type EchoReturn = {
  handle: string
  hz: number
  color: string
  interval: string
  purity: number
  centsOff: number
  mood: GhostSignal['mood']
  line: string
  seed: number
}

function seededRand(seed: number) {
  let s = seed || 7
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    return s / 0x7fffffff
  }
}

/** One key per night — the band's population shifts when the date does. */
export function nightKey(now = Date.now()): string {
  const d = new Date(now)
  // a "night" runs until 6am, so 1am belongs to yesterday's night
  if (d.getHours() < 6) d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function hashString(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 0x7fffffff
  return h
}

/**
 * Cast a ping: every carrier drifting tonight whose frequency harmonises
 * with yours returns, purest harmony first. Deterministic for a given
 * (night, hz) so the same cast re-finds the same people — recognition,
 * not a slot machine.
 */
export function castPing(myHz: number, now = Date.now(), pool: GhostSignal[] = GHOST_ARCHIVE): EchoReturn[] {
  const rand = seededRand(hashString(nightKey(now)) ^ Math.round(myHz * 10))
  const returns: EchoReturn[] = []
  for (const g of pool) {
    if (rand() < 0.35) continue // not everyone is out tonight
    const theirs = hzForHandle(g.handle)
    const match = harmonicMatch(myHz, theirs.hz)
    if (!match) continue
    returns.push({
      handle: g.handle,
      hz: theirs.hz,
      color: theirs.color,
      interval: match.interval,
      purity: match.purity,
      centsOff: match.centsOff,
      mood: g.mood,
      line: g.content,
      seed: g.waveformSeed,
    })
  }
  return returns.sort((a, b) => b.purity - a.purity).slice(0, 4)
}

// ─── persistence: locked harmonies + cast pacing ─────────────────────────────

const KEY = 'ecosphere:echolocation'

/** The band needs a moment to settle between casts. */
export const CAST_COOLDOWN_MS = 90_000

export type LockedHarmony = {
  handle: string
  interval: string
  purity: number
  hz: number
  color: string
  lockedAt: number
}

type Store = { lastCastAt: number; harmonies: LockedHarmony[] }

function read(): Store {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return { lastCastAt: 0, harmonies: [] }
    const parsed = JSON.parse(raw) as Partial<Store>
    return { lastCastAt: parsed.lastCastAt ?? 0, harmonies: parsed.harmonies ?? [] }
  } catch {
    return { lastCastAt: 0, harmonies: [] }
  }
}

function write(store: Store) {
  try { window.localStorage.setItem(KEY, JSON.stringify({ ...store, harmonies: store.harmonies.slice(0, 12) })) } catch { /* session only */ }
}

export function markCast(now = Date.now()): void {
  write({ ...read(), lastCastAt: now })
}

/** ms until the next cast is allowed; 0 when ready. */
export function castCooldownRemaining(now = Date.now()): number {
  return Math.max(0, read().lastCastAt + CAST_COOLDOWN_MS - now)
}

export function listHarmonies(): LockedHarmony[] {
  return read().harmonies
}

export function isLocked(handle: string): boolean {
  return read().harmonies.some(h => h.handle === handle)
}

/**
 * Lock a harmony: keep the pair, and let the familiar-frequency system know
 * your paths crossed — find each other enough nights and the ecosystem
 * starts recognising them for you.
 */
export function lockHarmony(ret: EchoReturn, now = Date.now()): void {
  const store = read()
  if (store.harmonies.some(h => h.handle === ret.handle)) return
  store.harmonies = [
    { handle: ret.handle, interval: ret.interval, purity: ret.purity, hz: ret.hz, color: ret.color, lockedAt: now },
    ...store.harmonies,
  ]
  write(store)
  try { recordCrossing(ret.handle, `echo-${nightKey(now)}`, ret.mood, ret.line.slice(0, 80)) } catch { /* recognition is best-effort */ }
}

// ─── the sound of it ──────────────────────────────────────────────────────────

/** Hz signatures live at 20-200; lift them into a clearly audible register. */
export function audibleHz(signatureHz: number): number {
  return signatureHz * 4
}

/** A soft sine ping at a signature's (lifted) frequency. */
export function playPingTone(signatureHz: number, delaySeconds = 0, seconds = 1.6, level = 0.22): boolean {
  const ctx = getSharedAudioContext()
  if (!ctx || ctx.state !== 'running') return false
  const t = ctx.currentTime + delaySeconds
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = audibleHz(signatureHz)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(level, t + 0.06)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + seconds + 0.05)
  return true
}

/** Your tone, then theirs, then both — the harmony heard, not explained. */
export function playHarmony(myHz: number, theirHz: number): boolean {
  const a = playPingTone(myHz, 0, 1.1, 0.2)
  const b = playPingTone(theirHz, 0.7, 1.1, 0.2)
  const c1 = playPingTone(myHz, 1.7, 2.2, 0.16)
  const c2 = playPingTone(theirHz, 1.7, 2.2, 0.16)
  return a || b || c1 || c2
}
