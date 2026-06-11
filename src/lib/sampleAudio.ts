// Sample audio synthesis — every play button in Ecosphere produces real
// sound. Short clips are rendered offline with Web Audio (seeded per signal,
// so each signal keeps a consistent "voice"), encoded as WAV, and played
// through the global audio engine. Falls back to simulated playback when
// Web Audio is unavailable.

export type SampleKind = 'voice' | 'whisper' | 'laugh' | 'static' | 'zone' | 'tone'

const SAMPLE_RATE = 22050
const MAX_RENDER_MS = 30000

const cache = new Map<string, Blob>()

function seededRand(seed: number) {
  let s = seed || 7
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return Math.abs(s) / 0x7fffffff
  }
}

// ─── WAV encoding (PCM16 mono) ────────────────────────────────────────────────

function bufferToWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0)
  const dataSize = samples.length * 2
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

// ─── Synthesis ────────────────────────────────────────────────────────────────

function makeNoiseBuffer(ctx: OfflineAudioContext, seconds: number, rand: () => number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1
  return buffer
}

/** Murmured wordless speech — pitch contours and syllables, no words. */
function synthVoice(ctx: OfflineAudioContext, master: GainNode, seconds: number, rand: () => number, whisper: boolean) {
  const baseFreq = whisper ? 0 : 105 + rand() * 110

  let t = 0.08
  while (t < seconds - 0.15) {
    // phrase of 2-7 syllables, then a breath pause
    const syllables = 2 + Math.floor(rand() * 6)
    for (let i = 0; i < syllables && t < seconds - 0.15; i++) {
      const dur = 0.09 + rand() * 0.16
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(whisper ? 0.18 + rand() * 0.12 : 0.3 + rand() * 0.2, t + dur * 0.3)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)

      if (whisper) {
        const src = ctx.createBufferSource()
        src.buffer = makeNoiseBuffer(ctx, dur + 0.02, rand)
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1200 + rand() * 1800
        bp.Q.value = 1.6
        src.connect(bp)
        bp.connect(gain)
        src.start(t)
      } else {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        const contour = baseFreq * (0.9 + rand() * 0.35)
        osc.frequency.setValueAtTime(contour, t)
        osc.frequency.linearRampToValueAtTime(contour * (0.85 + rand() * 0.3), t + dur)
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 900 + rand() * 700
        osc.connect(lp)
        lp.connect(gain)
        osc.start(t)
        osc.stop(t + dur + 0.02)
      }

      gain.connect(master)
      t += dur + 0.02 + rand() * 0.07
    }
    t += 0.18 + rand() * 0.45
  }
}

/** A short, human-ish laugh: descending pulses that trail off. */
function synthLaugh(ctx: OfflineAudioContext, master: GainNode, seconds: number, rand: () => number) {
  const bursts = 4 + Math.floor(rand() * 4)
  const base = 160 + rand() * 120
  let t = 0.1
  for (let i = 0; i < bursts && t < seconds - 0.1; i++) {
    const dur = 0.1 + rand() * 0.06
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    const f = base * (1 - i * 0.06)
    osc.frequency.setValueAtTime(f * 1.15, t)
    osc.frequency.exponentialRampToValueAtTime(f * 0.9, t + dur)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1100
    const gain = ctx.createGain()
    const level = 0.32 * (1 - i / (bursts + 2))
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(level, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(lp)
    lp.connect(gain)
    gain.connect(master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
    t += dur + 0.05 + i * 0.015
  }
}

/** Static with crackle bursts and dropouts. */
function synthStatic(ctx: OfflineAudioContext, master: GainNode, seconds: number, rand: () => number) {
  const src = ctx.createBufferSource()
  src.buffer = makeNoiseBuffer(ctx, seconds, rand)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2400
  bp.Q.value = 0.4
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.12, 0)
  // dropouts and surges
  let t = 0.3
  while (t < seconds - 0.2) {
    const level = rand() > 0.6 ? 0.02 : 0.1 + rand() * 0.12
    gain.gain.linearRampToValueAtTime(level, t)
    t += 0.2 + rand() * 0.5
  }
  src.connect(bp)
  bp.connect(gain)
  gain.connect(master)
  src.start(0)
}

/** Dead-zone ambience: dark rumble + sparse clicks. */
function synthZone(ctx: OfflineAudioContext, master: GainNode, seconds: number, rand: () => number) {
  const drone = ctx.createOscillator()
  drone.type = 'sine'
  drone.frequency.value = 52 + rand() * 14
  const drone2 = ctx.createOscillator()
  drone2.type = 'sine'
  drone2.frequency.value = drone.frequency.value * 1.01
  const dg = ctx.createGain()
  dg.gain.value = 0.16
  drone.connect(dg)
  drone2.connect(dg)
  dg.connect(master)
  drone.start(0)
  drone2.start(0)

  const noise = ctx.createBufferSource()
  noise.buffer = makeNoiseBuffer(ctx, seconds, rand)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 420
  const ng = ctx.createGain()
  ng.gain.value = 0.05
  noise.connect(lp)
  lp.connect(ng)
  ng.connect(master)
  noise.start(0)

  let t = 0.4
  while (t < seconds - 0.2) {
    if (rand() > 0.55) {
      const click = ctx.createOscillator()
      click.type = 'square'
      click.frequency.value = 900 + rand() * 1400
      const cg = ctx.createGain()
      cg.gain.setValueAtTime(0.05, t)
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
      click.connect(cg)
      cg.connect(master)
      click.start(t)
      click.stop(t + 0.04)
    }
    t += 0.3 + rand() * 0.8
  }
}

/** Relic tone: a soft detuned chord with slow tremolo. */
function synthTone(ctx: OfflineAudioContext, master: GainNode, seconds: number, rand: () => number) {
  const root = 140 + rand() * 90
  const ratios = [1, 1.5, 2, 2.997]
  ratios.forEach((ratio, i) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = root * ratio * (1 + (rand() - 0.5) * 0.004)
    const gain = ctx.createGain()
    const level = 0.12 / (i + 1)
    gain.gain.setValueAtTime(0.0001, 0)
    gain.gain.linearRampToValueAtTime(level, 0.4)
    gain.gain.setValueAtTime(level, Math.max(0.4, seconds - 0.6))
    gain.gain.linearRampToValueAtTime(0.0001, seconds)
    const trem = ctx.createOscillator()
    trem.frequency.value = 2.2 + rand() * 2
    const tremGain = ctx.createGain()
    tremGain.gain.value = level * 0.35
    trem.connect(tremGain)
    tremGain.connect(gain.gain)
    osc.connect(gain)
    gain.connect(master)
    osc.start(0)
    trem.start(0)
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function renderSampleAudio(kind: SampleKind, seed: number, durationMs: number): Promise<Blob | null> {
  if (typeof OfflineAudioContext === 'undefined') return null

  const ms = Math.min(Math.max(1200, durationMs), MAX_RENDER_MS)
  const key = `${kind}-${seed}-${ms}`
  const cached = cache.get(key)
  if (cached) return cached

  try {
    const seconds = ms / 1000
    const ctx = new OfflineAudioContext(1, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE)
    const rand = seededRand(seed)

    const master = ctx.createGain()
    master.gain.value = 0.9
    // gentle fade in/out so clips never click
    master.gain.setValueAtTime(0.0001, 0)
    master.gain.linearRampToValueAtTime(0.9, 0.06)
    master.gain.setValueAtTime(0.9, Math.max(0.06, seconds - 0.12))
    master.gain.linearRampToValueAtTime(0.0001, seconds)
    master.connect(ctx.destination)

    switch (kind) {
      case 'voice': synthVoice(ctx, master, seconds, rand, false); break
      case 'whisper': synthVoice(ctx, master, seconds, rand, true); break
      case 'laugh': synthLaugh(ctx, master, seconds, rand); break
      case 'static': synthStatic(ctx, master, seconds, rand); break
      case 'zone': synthZone(ctx, master, seconds, rand); break
      case 'tone': synthTone(ctx, master, seconds, rand); break
    }

    const rendered = await ctx.startRendering()
    const blob = bufferToWav(rendered)
    if (cache.size > 40) cache.clear()
    cache.set(key, blob)
    return blob
  } catch {
    return null
  }
}

type EngineLike<M> = {
  playBlob: (blob: Blob, meta: M) => Promise<boolean>
  playSimulated: (meta: M, durationMs?: number) => void
}

/** Render (cached) and play a sample through the global engine; falls back to simulated playback. */
export async function playSample<M>(engine: EngineLike<M>, meta: M, kind: SampleKind, seed: number, durationMs: number) {
  const blob = await renderSampleAudio(kind, seed, durationMs)
  if (blob) {
    await engine.playBlob(blob, meta)
  } else {
    engine.playSimulated(meta, Math.min(durationMs, MAX_RENDER_MS))
  }
}
