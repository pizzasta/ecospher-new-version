// Sound-responsive UI: tiny synthesized feedback on interaction.
// - tapping a button → a soft radio-tuning click
// - sending a signal → a low pop
// - scrolling → a faint static hiss that follows scroll speed
// Everything runs through the shared (gesture-unlocked) AudioContext at very
// low gain, and is gated by the "Interface Sounds" setting.

import { getSharedAudioContext } from './sampleAudio'
import { readPref } from '../hooks/useEcoPrefs'

let hissSource: AudioBufferSourceNode | null = null
let hissGain: GainNode | null = null

function enabled() {
  return readPref('uiSounds', true)
}

/** Soft click, like a radio detent. */
export function uiClick() {
  if (!enabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx || ctx.state !== 'running') return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = 1800 + Math.random() * 700
  gain.gain.setValueAtTime(0.018, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.04)
}

/** Low pop + body, for releasing a signal. */
export function uiPop() {
  if (!enabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx || ctx.state !== 'running') return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(340, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.14)
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.18)
}

function ensureHiss(ctx: AudioContext) {
  if (hissSource && hissGain) return
  const seconds = 1.2
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.5

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 4200
  filter.Q.value = 0.6
  const gain = ctx.createGain()
  gain.gain.value = 0

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.start()
  hissSource = source
  hissGain = gain
}

/** Feed scroll speed (px per frame-ish); the hiss follows and then decays. */
export function uiScrollHiss(speed: number) {
  if (!enabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx || ctx.state !== 'running') return
  ensureHiss(ctx)
  if (!hissGain) return

  const target = Math.min(0.012, speed / 30000)
  hissGain.gain.setTargetAtTime(target, ctx.currentTime, 0.06)
  hissGain.gain.setTargetAtTime(0, ctx.currentTime + 0.12, 0.18)
}

// ─── Re-export cinematic moments ─────────────────────────────────────────────
// All moment functions live in audioMoments.ts. Re-exported here so components
// that already import from uiSound can add moment calls without a new import.
export {
  momentAppOpen,
  momentScreenTransition,
  momentOnboardStep,
  momentIdentitySelect,
  momentEcosystemEnter,
  momentSignalReplay,
  momentRecordStart,
  momentRecordEnd,
  fireMoment,
} from './audioMoments'
