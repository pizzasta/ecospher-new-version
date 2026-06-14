// audioMoments.ts — Cinematic audio feedback for Ecosphere
//
// Sound direction: soft analog, faint radio, distant resonance, warm hum,
// degraded cassette, subtle static atmosphere, quiet emotional tone.
// All sounds are procedurally synthesised with Web Audio API — no files.
// Everything is gated behind the shared AudioContext gesture-unlock and the
// user's "Interface Sounds" preference, so it is silent until the first tap.
//
// Moments:
//   appOpen          — warm hum that swells and dissolves on first load
//   screenTransition — brief radio-dial sweep between pages
//   onboardStep      — soft cassette-click when advancing an onboarding step
//   identitySelect   — resonant tone that fades in when choosing sigil/frequency
//   ecosystemEnter   — deep distant chord as the ecosystem becomes real
//   signalReplay     — faint tape-start crinkle before a signal plays
//   recordStart      — analog compression thud + soft hiss open
//   recordEnd        — tape-stop: hiss close + mechanical thunk

import { getSharedAudioContext } from './sampleAudio'
import { readPref } from '../hooks/useEcoPrefs'

// ─── Guard ────────────────────────────────────────────────────────────────────

function ctx(): AudioContext | null {
  if (!readPref('uiSounds', true)) return null
  const c = getSharedAudioContext()
  return c?.state === 'running' ? c : null
}

// ─── Low-level helpers ────────────────────────────────────────────────────────

/** White noise buffer, loopable, mono. */
function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate)
  const d = buf.getChannelData(0)
  let v = Math.random() * 2 - 1
  for (let i = 0; i < d.length; i++) {
    // pink-ish: low-pass the white noise to warm it
    v = v * 0.985 + (Math.random() * 2 - 1) * 0.015
    d[i] = v
  }
  return buf
}

/** Connect a chain of nodes and return the last one. */
function chain(c: AudioContext, ...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1])
  return nodes[nodes.length - 1]
}

/** Schedule a gain envelope: attack → hold → release. */
function envelope(
  gain: GainNode,
  { peak = 1, attackAt = 0, attackDur = 0.04, holdDur = 0, releaseDur = 0.3 }: {
    peak?: number; attackAt?: number; attackDur?: number; holdDur?: number; releaseDur?: number
  },
  c: AudioContext,
) {
  const t = c.currentTime + attackAt
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(peak, t + attackDur)
  gain.gain.setValueAtTime(peak, t + attackDur + holdDur)
  gain.gain.linearRampToValueAtTime(0.0001, t + attackDur + holdDur + releaseDur)
}

// ─── Tape crackle texture ─────────────────────────────────────────────────────

/** Sparse vinyl/cassette crackle over `seconds`. Master gain goes to dest. */
function tapeCrackle(c: AudioContext, dest: AudioNode, seconds: number, gain: number) {
  const buf = noiseBuffer(c, seconds)
  const src = c.createBufferSource()
  src.buffer = buf

  const hpf = c.createBiquadFilter()
  hpf.type = 'highpass'
  hpf.frequency.value = 3200
  hpf.Q.value = 0.5

  const g = c.createGain()
  g.gain.value = gain

  chain(c, src, hpf, g, dest)
  src.start(c.currentTime)
  src.stop(c.currentTime + seconds)
}

// ─── Radio noise band ─────────────────────────────────────────────────────────

/** A narrow band-pass noise burst — AM radio static. */
function radioNoise(c: AudioContext, dest: AudioNode, {
  freq = 1200, Q = 2, gainPeak = 0.04, attackDur = 0.08, releaseDur = 0.4, startAt = 0
}: {
  freq?: number; Q?: number; gainPeak?: number; attackDur?: number; releaseDur?: number; startAt?: number
} = {}) {
  const dur = attackDur + releaseDur + 0.1
  const buf = noiseBuffer(c, dur + 0.05)
  const src = c.createBufferSource()
  src.buffer = buf

  const bpf = c.createBiquadFilter()
  bpf.type = 'bandpass'
  bpf.frequency.value = freq
  bpf.Q.value = Q

  const g = c.createGain()
  envelope(g, { peak: gainPeak, attackAt: startAt, attackDur, releaseDur }, c)

  chain(c, src, bpf, g, dest)
  src.start(c.currentTime)
  src.stop(c.currentTime + startAt + dur + 0.1)
}

// ─── Warm sine tone ───────────────────────────────────────────────────────────

/** Low warm sine with subtle vibrato — analog oscillator feel. */
function warmTone(c: AudioContext, dest: AudioNode, {
  freq = 82, gainPeak = 0.06, attackDur = 0.5, holdDur = 0.3, releaseDur = 1.2, startAt = 0,
  vibrato = 0.6, vibratoRate = 3.8
}: {
  freq?: number; gainPeak?: number; attackDur?: number; holdDur?: number; releaseDur?: number
  startAt?: number; vibrato?: number; vibratoRate?: number
} = {}) {
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq

  // subtle vibrato via LFO
  const lfo = c.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = vibratoRate
  const lfoGain = c.createGain()
  lfoGain.gain.value = vibrato
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)

  const g = c.createGain()
  envelope(g, { peak: gainPeak, attackAt: startAt, attackDur, holdDur, releaseDur }, c)

  osc.connect(g)
  g.connect(dest)

  const t = c.currentTime + startAt
  lfo.start(t)
  osc.start(t)
  const end = t + attackDur + holdDur + releaseDur + 0.05
  osc.stop(end)
  lfo.stop(end)
}

// ─── Distant resonance chord ──────────────────────────────────────────────────

/** Stacked detuned sine partials — cathedral/distance effect. */
function resonanceChord(c: AudioContext, dest: AudioNode, {
  root = 55, gainPeak = 0.05, attackDur = 1.4, holdDur = 0.8, releaseDur = 2.8, startAt = 0
}: {
  root?: number; gainPeak?: number; attackDur?: number; holdDur?: number; releaseDur?: number; startAt?: number
} = {}) {
  // fifth + octave + minor-third partial, each slightly detuned for natural beating
  const partials: [number, number][] = [
    [root, gainPeak],
    [root * 1.5 + 0.4, gainPeak * 0.62],
    [root * 2 - 0.7, gainPeak * 0.44],
    [root * 2.38 + 0.2, gainPeak * 0.28],   // minor third above octave
  ]
  for (const [freq, g] of partials) {
    warmTone(c, dest, { freq, gainPeak: g, attackDur, holdDur, releaseDur, startAt })
  }
}

// ─── Tape flutter ─────────────────────────────────────────────────────────────

/** Pitch modulation mimicking a slightly tired cassette motor. */
function tapeFlutter(c: AudioContext, dest: AudioNode, {
  freq = 280, gainPeak = 0.04, attackDur = 0.06, holdDur = 0.8, releaseDur = 0.4, startAt = 0
}: {
  freq?: number; gainPeak?: number; attackDur?: number; holdDur?: number; releaseDur?: number; startAt?: number
} = {}) {
  const osc = c.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = freq

  // flutter LFO — slow irregular wobble
  const flutter = c.createOscillator()
  flutter.type = 'sine'
  flutter.frequency.value = 2.3 + Math.random() * 0.9
  const flutterGain = c.createGain()
  flutterGain.gain.value = freq * 0.009
  flutter.connect(flutterGain)
  flutterGain.connect(osc.frequency)

  const lpf = c.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = 600
  lpf.Q.value = 0.5

  const g = c.createGain()
  envelope(g, { peak: gainPeak, attackAt: startAt, attackDur, holdDur, releaseDur }, c)

  osc.connect(lpf)
  lpf.connect(g)
  g.connect(dest)

  const t = c.currentTime + startAt
  osc.start(t); flutter.start(t)
  const end = t + attackDur + holdDur + releaseDur + 0.1
  osc.stop(end); flutter.stop(end)
}

// ─── Reverb-like diffusion ────────────────────────────────────────────────────

/** Very short convolution reverb from noise — adds space without IR files. */
function makeReverb(c: AudioContext, decaySeconds = 1.2, wet = 0.35): ConvolverNode {
  const len = Math.floor(c.sampleRate * decaySeconds)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.5)
    }
  }
  const rev = c.createConvolver()
  rev.buffer = buf
  const wetGain = c.createGain()
  wetGain.gain.value = wet
  rev.connect(wetGain)
  return rev   // caller: signal → rev → wetGain → dest;  signal → dryGain → dest
}

// ─── Moments ──────────────────────────────────────────────────────────────────

/**
 * appOpen — plays once on first load after a gesture.
 * A deep warm hum rises slowly then dissolves, with faint radio texture.
 * Conveys: the room is dark, something is awakening, stay quiet.
 */
export function momentAppOpen() {
  const c = ctx(); if (!c) return
  const rev = makeReverb(c, 2.2, 0.28)
  const master = c.createGain()
  master.gain.value = 1
  rev.connect(master)
  master.connect(c.destination)

  // main warm hum
  warmTone(c, master, { freq: 68, gainPeak: 0.038, attackDur: 1.8, holdDur: 0.6, releaseDur: 2.4, startAt: 0.2 })
  warmTone(c, master, { freq: 136.2, gainPeak: 0.018, attackDur: 2.1, holdDur: 0.4, releaseDur: 2.0, startAt: 0.6 })
  // distant radio noise layer
  radioNoise(c, master, { freq: 900, Q: 1.4, gainPeak: 0.008, attackDur: 1.2, releaseDur: 3.0, startAt: 0.4 })
  tapeCrackle(c, master, 1.2, 0.004)
}

/**
 * screenTransition — a fast radio-dial sweep.
 * The needle moves: brief static burst, a fleeting pitch sweep, then silence.
 * Very short — must not overlap the incoming screen content.
 */
export function momentScreenTransition() {
  const c = ctx(); if (!c) return
  const master = c.createGain()
  master.gain.value = 0.7
  master.connect(c.destination)

  // radio static burst
  radioNoise(c, master, { freq: 2200, Q: 3.5, gainPeak: 0.022, attackDur: 0.03, releaseDur: 0.14 })
  // pitch sweep — like tuning through stations
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(480, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1800, c.currentTime + 0.09)
  osc.frequency.exponentialRampToValueAtTime(280, c.currentTime + 0.18)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, c.currentTime)
  g.gain.linearRampToValueAtTime(0.016, c.currentTime + 0.05)
  g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.2)
  osc.connect(g); g.connect(master)
  osc.start(); osc.stop(c.currentTime + 0.25)
}

/**
 * onboardStep — soft cassette-mechanism click as each step advances.
 * Feels like advancing the tape rather than pressing a digital button.
 */
export function momentOnboardStep() {
  const c = ctx(); if (!c) return
  const master = c.createGain()
  master.gain.value = 0.9
  master.connect(c.destination)

  // mechanical thud from noise burst
  const buf = noiseBuffer(c, 0.08)
  const src = c.createBufferSource()
  src.buffer = buf
  const lpf = c.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = 340
  lpf.Q.value = 1.2
  const g = c.createGain()
  envelope(g, { peak: 0.06, attackDur: 0.004, releaseDur: 0.07 }, c)
  chain(c, src, lpf, g, master)
  src.start(); src.stop(c.currentTime + 0.12)

  // brief tape hiss open/close
  radioNoise(c, master, { freq: 5800, Q: 0.7, gainPeak: 0.009, attackDur: 0.01, releaseDur: 0.09, startAt: 0.01 })
}

/**
 * identitySelect — resonant tone swell when a sigil or frequency is chosen.
 * The new identity "recognises" itself: warm, slightly trembling, personal.
 * param `hz` — the user's frequency number, used to tune the tonal root.
 */
export function momentIdentitySelect(hz: number = 72) {
  const c = ctx(); if (!c) return
  const rev = makeReverb(c, 1.8, 0.42)
  const master = c.createGain()
  master.gain.value = 0.85
  rev.connect(master)
  master.connect(c.destination)

  // root frequency anchored to the user's hz (mapped to bass register)
  const root = 55 + ((hz % 100) / 100) * 38
  warmTone(c, master, { freq: root, gainPeak: 0.05, attackDur: 0.4, holdDur: 0.3, releaseDur: 1.6, vibrato: 0.8 })
  warmTone(c, master, { freq: root * 1.502, gainPeak: 0.028, attackDur: 0.6, holdDur: 0.2, releaseDur: 1.3, startAt: 0.1, vibrato: 0.5 })
  tapeCrackle(c, master, 0.6, 0.006)
}

/**
 * ecosystemEnter — the deepest moment; signals the transition from profile
 * identity to "inside" the ecosystem. A slow chord unfolds, distant and warm,
 * like a room becoming real from a memory.
 */
export function momentEcosystemEnter() {
  const c = ctx(); if (!c) return
  const rev = makeReverb(c, 3.2, 0.5)
  const master = c.createGain()
  master.gain.value = 0.75
  rev.connect(master)
  master.connect(c.destination)

  resonanceChord(c, master, { root: 41, gainPeak: 0.044, attackDur: 2.0, holdDur: 1.0, releaseDur: 3.2 })
  radioNoise(c, master, { freq: 680, Q: 1.2, gainPeak: 0.007, attackDur: 0.8, releaseDur: 4.5, startAt: 0.5 })
  tapeCrackle(c, master, 2.4, 0.003)
}

/**
 * signalReplay — the brief moment before a signal starts playing.
 * Cassette tape engaging: a faint crinkle, then the hiss channel opens.
 * Plays under the signal audio — very low gain.
 */
export function momentSignalReplay() {
  const c = ctx(); if (!c) return
  const master = c.createGain()
  master.gain.value = 0.6
  master.connect(c.destination)

  tapeCrackle(c, master, 0.3, 0.018)
  tapeFlutter(c, master, { freq: 220, gainPeak: 0.012, attackDur: 0.05, holdDur: 0.25, releaseDur: 0.2, startAt: 0.04 })
  radioNoise(c, master, { freq: 4400, Q: 0.8, gainPeak: 0.007, attackDur: 0.06, releaseDur: 0.22, startAt: 0.02 })
}

/**
 * recordStart — the microphone opens. Analog compression thud + hiss in.
 * The thud is physical; the hiss is the channel opening.
 */
export function momentRecordStart() {
  const c = ctx(); if (!c) return
  const master = c.createGain()
  master.gain.value = 0.8
  master.connect(c.destination)

  // thud
  const buf = noiseBuffer(c, 0.12)
  const src = c.createBufferSource()
  src.buffer = buf
  const lpf = c.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = 200
  const g = c.createGain()
  envelope(g, { peak: 0.09, attackDur: 0.006, releaseDur: 0.11 }, c)
  chain(c, src, lpf, g, master)
  src.start(); src.stop(c.currentTime + 0.15)

  // hiss opens
  radioNoise(c, master, { freq: 5200, Q: 0.6, gainPeak: 0.012, attackDur: 0.08, releaseDur: 0.35, startAt: 0.04 })

  // faint low hum — channel is live
  warmTone(c, master, { freq: 58, gainPeak: 0.015, attackDur: 0.3, holdDur: 0.8, releaseDur: 0.4, startAt: 0.1, vibrato: 0.2 })
}

/**
 * recordEnd — the microphone closes. Hiss out, then a mechanical thunk.
 * The reverse of recordStart: channel shuts first, then the mechanism settles.
 */
export function momentRecordEnd() {
  const c = ctx(); if (!c) return
  const master = c.createGain()
  master.gain.value = 0.8
  master.connect(c.destination)

  // hiss closes
  radioNoise(c, master, { freq: 5200, Q: 0.6, gainPeak: 0.012, attackDur: 0.04, releaseDur: 0.28 })

  // warm hum fades — the channel is no longer live
  warmTone(c, master, { freq: 58, gainPeak: 0.014, attackDur: 0.04, holdDur: 0.1, releaseDur: 0.5, startAt: 0.02, vibrato: 0.15 })

  // mechanical thunk
  const buf = noiseBuffer(c, 0.1)
  const src = c.createBufferSource()
  src.buffer = buf
  const lpf = c.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = 240
  lpf.Q.value = 1.8
  const g = c.createGain()
  envelope(g, { peak: 0.07, attackAt: 0.28, attackDur: 0.008, releaseDur: 0.09 }, c)
  chain(c, src, lpf, g, master)
  src.start(c.currentTime + 0.28); src.stop(c.currentTime + 0.5)
}

// ─── Debounced wrapper ────────────────────────────────────────────────────────
// Prevents the same moment from stacking if called multiple times quickly.

const _lastFired: Partial<Record<string, number>> = {}
const _DEBOUNCE_MS = 300

export function fireMoment(name: string, fn: () => void) {
  const now = Date.now()
  if (_lastFired[name] && now - _lastFired[name]! < _DEBOUNCE_MS) return
  _lastFired[name] = now
  fn()
}
