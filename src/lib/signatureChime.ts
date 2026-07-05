// Signature chime — how you sound on the band. Profiles here already have a
// look (gradient, scene, sigil) and a place (the Hz signature); the chime is
// the voice of that signature: the timbre your frequency carries when it goes
// out as an echolocation ping or answers someone back. Picked once in the
// background settings, heard everywhere your signature travels.

import { getSharedAudioContext } from './sampleAudio'

export type ChimeStyle = 'pure' | 'warm' | 'crystal' | 'deep'

export const CHIME_STYLES: Array<{ value: ChimeStyle; label: string; hint: string }> = [
  { value: 'pure', label: 'pure', hint: 'a single clean tone' },
  { value: 'warm', label: 'warm', hint: 'soft, slightly detuned, close' },
  { value: 'crystal', label: 'crystal', hint: 'bright with a shimmer above' },
  { value: 'deep', label: 'deep', hint: 'an octave of low weight underneath' },
]

const KEY = 'ecosphere:signatureChime'

/** A stable chime for any carrier — their signature has a voice too. */
export function chimeForHandle(handle: string): ChimeStyle {
  let h = 7
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) % 99991
  return CHIME_STYLES[h % CHIME_STYLES.length].value
}

export function readChime(): ChimeStyle {
  try {
    const raw = window.localStorage.getItem(KEY)
    return CHIME_STYLES.some(c => c.value === raw) ? (raw as ChimeStyle) : 'pure'
  } catch {
    return 'pure'
  }
}

export function saveChime(style: ChimeStyle): void {
  try { window.localStorage.setItem(KEY, style) } catch { /* session only */ }
}

/** Hz signatures live at 20-200; lift into a clearly audible register. */
function lift(hz: number): number {
  return hz * 4
}

type Voice = { freq: number; type: OscillatorType; level: number }

function voicesFor(style: ChimeStyle, hz: number): Voice[] {
  const f = lift(hz)
  switch (style) {
    case 'warm':
      return [
        { freq: f, type: 'triangle', level: 0.2 },
        { freq: f * 1.004, type: 'sine', level: 0.12 },
      ]
    case 'crystal':
      return [
        { freq: f, type: 'sine', level: 0.18 },
        { freq: f * 2, type: 'sine', level: 0.07 },
        { freq: f * 3, type: 'sine', level: 0.035 },
      ]
    case 'deep':
      return [
        { freq: f, type: 'sine', level: 0.16 },
        { freq: f / 2, type: 'sine', level: 0.14 },
      ]
    default:
      return [{ freq: f, type: 'sine', level: 0.22 }]
  }
}

/**
 * Play a signature at its chime timbre. Returns false when audio isn't
 * available (locked context, no Web Audio) so callers can fall back.
 */
export function playSignatureChime(
  hz: number,
  style: ChimeStyle = readChime(),
  delaySeconds = 0,
  seconds = 1.6,
  gainScale = 1,
): boolean {
  const ctx = getSharedAudioContext()
  if (!ctx || ctx.state !== 'running') return false
  const t = ctx.currentTime + delaySeconds
  for (const v of voicesFor(style, hz)) {
    const osc = ctx.createOscillator()
    osc.type = v.type
    osc.frequency.value = v.freq
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, v.level * gainScale), t + 0.06)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + seconds + 0.05)
  }
  return true
}
