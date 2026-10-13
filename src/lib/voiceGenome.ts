// Voice-born form: a few seconds of your voice become a one-of-a-kind 3D
// creature. The analysis runs on your device and keeps only a "genome" — about
// thirty numbers describing pitch, brightness, grain, breath, rhythm, the
// shape of your pitch contour and your spectral envelope. The audio itself is
// never stored or sent, and the genome can't be turned back into speech.
//
// Everything here is pure (samples in, numbers out) so it can be tested
// without a browser. Capture lives in voiceCapture.ts.

export const GENOME_BANDS = 12
export const GENOME_CONTOUR = 12

export type VoiceGenome = {
  v: 1
  /** how it was made: your voice, or seeded from your handle until you give it one */
  born: 'voice' | 'seed'
  /** 0 deep → 1 high (log scale, ~70–420 Hz) */
  pitch: number
  /** 0 dark → 1 bright (spectral centroid) */
  bright: number
  /** 0 smooth → 1 gritty (spectral flatness + zero crossings) */
  rough: number
  /** 0 clear → 1 breathy (low pitch clarity, lots of air) */
  breath: number
  /** 0 steady → 1 dynamic (loudness variation) */
  dyn: number
  /** 0 slow → 1 quick (syllables per second) */
  tempo: number
  /** your pitch contour, resampled to 12 points, each 0..1 */
  contour: number[]
  /** your spectral envelope across 12 log-spaced bands, each 0..1 */
  bands: number[]
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0)
const r2 = (x: number) => Math.round(clamp01(x) * 100) / 100

// ─── small FFT ───────────────────────────────────────────────────────────────

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2
        const xr = re[b] * cr - im[b] * ci
        const xi = re[b] * ci + im[b] * cr
        re[b] = re[a] - xr; im[b] = im[a] - xi
        re[a] += xr; im[a] += xi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

// ─── analysis ────────────────────────────────────────────────────────────────

const FRAME = 2048
const HOP = 1024
const MIN_VOICED_FRAMES = 6

/** average-decimate so pitch search stays cheap */
function decimate(samples: Float32Array, factor: number): Float32Array {
  const out = new Float32Array(Math.floor(samples.length / factor))
  for (let i = 0; i < out.length; i++) {
    let s = 0
    for (let k = 0; k < factor; k++) s += samples[i * factor + k]
    out[i] = s / factor
  }
  return out
}

/** autocorrelation pitch on one (decimated) frame → [hz, clarity 0..1] */
function framePitch(frame: Float32Array, rate: number): [number, number] {
  const minLag = Math.max(2, Math.floor(rate / 420))
  const maxLag = Math.min(frame.length - 2, Math.ceil(rate / 70))
  let energy = 0
  for (let i = 0; i < frame.length; i++) energy += frame[i] * frame[i]
  if (energy < 1e-9) return [0, 0]
  let best = 0, bestLag = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i + lag < frame.length; i++) sum += frame[i] * frame[i + lag]
    if (sum > best) { best = sum; bestLag = lag }
  }
  if (!bestLag) return [0, 0]
  return [rate / bestLag, Math.min(1, best / energy)]
}

function resample(values: number[], n: number): number[] {
  if (values.length === 0) return Array(n).fill(0.5)
  if (values.length === 1) return Array(n).fill(values[0])
  return Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * (values.length - 1)
    const a = Math.floor(x), b = Math.min(values.length - 1, a + 1)
    return values[a] + (values[b] - values[a]) * (x - a)
  })
}

/** Turn a mono recording into a genome; null when there's no voice in it. */
export function analyzeVoice(samples: Float32Array, sampleRate: number): VoiceGenome | null {
  if (samples.length < FRAME * 2 || !(sampleRate > 8000)) return null

  const frames = Math.floor((samples.length - FRAME) / HOP) + 1
  const rms = new Float64Array(frames)
  for (let f = 0; f < frames; f++) {
    let e = 0
    for (let i = 0; i < FRAME; i++) { const s = samples[f * HOP + i]; e += s * s }
    rms[f] = Math.sqrt(e / FRAME)
  }
  const maxRms = rms.reduce((m, v) => Math.max(m, v), 0)
  const gate = Math.max(0.008, maxRms * 0.18)
  const voiced: number[] = []
  for (let f = 0; f < frames; f++) if (rms[f] >= gate) voiced.push(f)
  if (voiced.length < MIN_VOICED_FRAMES) return null

  const factor = Math.max(1, Math.round(sampleRate / 11025))
  const dec = decimate(samples, factor)
  const decRate = sampleRate / factor
  const decFrame = Math.floor(FRAME / factor)
  const decHop = Math.floor(HOP / factor)

  const win = new Float64Array(FRAME)
  for (let i = 0; i < FRAME; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1))
  const binHz = sampleRate / FRAME
  const edges = Array.from({ length: GENOME_BANDS + 1 }, (_, i) => 100 * Math.pow(7000 / 100, i / GENOME_BANDS))

  const bandSum = new Float64Array(GENOME_BANDS)
  let centroidSum = 0, flatSum = 0, airSum = 0, zcrSum = 0, clarSum = 0, clarN = 0
  const pitches: number[] = []
  const re = new Float64Array(FRAME), im = new Float64Array(FRAME)

  for (const f of voiced) {
    for (let i = 0; i < FRAME; i++) { re[i] = samples[f * HOP + i] * win[i]; im[i] = 0 }
    fft(re, im)
    let num = 0, den = 0, logSum = 0, linSum = 0, nFlat = 0, low = 0, high = 0
    for (let k = Math.ceil(80 / binHz); k < Math.min(FRAME / 2, Math.floor(7000 / binHz)); k++) {
      const mag = Math.hypot(re[k], im[k])
      const hz = k * binHz
      num += hz * mag; den += mag
      if (hz >= 200 && hz <= 4000) { logSum += Math.log(mag + 1e-9); linSum += mag; nFlat++ }
      if (hz < 3000) low += mag * mag; else high += mag * mag
      for (let b = 0; b < GENOME_BANDS; b++) if (hz >= edges[b] && hz < edges[b + 1]) { bandSum[b] += mag; break }
    }
    centroidSum += den > 0 ? num / den : 0
    flatSum += nFlat > 0 && linSum > 0 ? Math.exp(logSum / nFlat) / (linSum / nFlat) : 0
    airSum += low + high > 0 ? high / (low + high) : 0
    let zc = 0
    for (let i = 1; i < FRAME; i++) if ((samples[f * HOP + i - 1] >= 0) !== (samples[f * HOP + i] >= 0)) zc++
    zcrSum += zc / FRAME

    const start = Math.floor((f * HOP) / factor)
    if (start + decFrame <= dec.length) {
      const [hz, clarity] = framePitch(dec.subarray(start, start + decFrame), decRate)
      clarSum += clarity; clarN++
      if (hz > 0 && clarity > 0.45) pitches.push(hz)
    }
  }
  void decHop

  const n = voiced.length
  const centroid = centroidSum / n
  const flat = flatSum / n
  const air = airSum / n
  const zcr = zcrSum / n
  const clarity = clarN ? clarSum / clarN : 0.5

  // pitch: median voiced pitch on a log scale
  const sorted = [...pitches].sort((a, b) => a - b)
  const medianHz = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
  const pitch = medianHz ? (Math.log(medianHz) - Math.log(70)) / (Math.log(420) - Math.log(70)) : 0.5

  // contour: log-pitch over time, stretched to its own range so every voice has a shape
  const logs = pitches.map(p => Math.log(p))
  const lo = Math.min(...logs), hi = Math.max(...logs)
  const span = hi - lo
  const contour = pitches.length >= 2
    ? resample(logs.map(l => (span > 0.04 ? (l - lo) / span : 0.5)), GENOME_CONTOUR)
    : Array(GENOME_CONTOUR).fill(0.5)

  // envelope: normalise to the loudest band, then lift quiet ones so shape reads
  const bandMax = bandSum.reduce((m, v) => Math.max(m, v), 0) || 1
  const bands = Array.from(bandSum, v => Math.sqrt(v / bandMax))

  // rhythm: count loudness peaks per second across the whole take
  const mean = rms.reduce((s, v) => s + v, 0) / frames
  let peaks = 0, lastPeak = -10
  for (let f = 1; f < frames - 1; f++) {
    if (rms[f] > mean * 1.15 && rms[f] >= rms[f - 1] && rms[f] > rms[f + 1] && f - lastPeak >= 4) { peaks++; lastPeak = f }
  }
  const seconds = samples.length / sampleRate
  const perSecond = peaks / Math.max(1, seconds)
  let varSum = 0
  for (let f = 0; f < frames; f++) varSum += (rms[f] - mean) * (rms[f] - mean)
  const dynRaw = mean > 0 ? Math.sqrt(varSum / frames) / mean : 0

  return {
    v: 1,
    born: 'voice',
    pitch: r2(pitch),
    bright: r2((centroid - 450) / 2600),
    rough: r2(flat * 1.8 + zcr * 2.2),
    breath: r2((1 - clarity) * 1.3 + air * 1.5),
    dyn: r2(dynRaw / 1.4),
    tempo: r2(perSecond / 6),
    contour: contour.map(r2),
    bands: bands.map(r2),
  }
}

// ─── seeded fallback, validation, storage ────────────────────────────────────

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Until you give it your voice, your handle seeds a form that's still yours alone. */
export function genomeFromSeed(seed: string): VoiceGenome {
  const rand = rng(hashString(`echo:${seed}`))
  const smooth = (n: number) => {
    const knots = Array.from({ length: 4 }, () => rand())
    return resample(knots, n).map(r2)
  }
  return {
    v: 1, born: 'seed',
    pitch: r2(rand()), bright: r2(rand()), rough: r2(rand() * 0.8), breath: r2(rand() * 0.8),
    dyn: r2(rand()), tempo: r2(rand()),
    contour: smooth(GENOME_CONTOUR), bands: smooth(GENOME_BANDS),
  }
}

const numArray = (raw: unknown, len: number): number[] | null =>
  Array.isArray(raw) && raw.length === len && raw.every(x => typeof x === 'number' && Number.isFinite(x))
    ? (raw as number[]).map(r2) : null

/** Accept only a well-formed genome; clamp everything. */
export function sanitizeGenome(raw: unknown): VoiceGenome | null {
  const g = raw as Partial<Record<keyof VoiceGenome, unknown>> | null
  if (!g || typeof g !== 'object' || g.v !== 1) return null
  const scalars = ['pitch', 'bright', 'rough', 'breath', 'dyn', 'tempo'] as const
  if (!scalars.every(k => typeof g[k] === 'number' && Number.isFinite(g[k] as number))) return null
  const contour = numArray(g.contour, GENOME_CONTOUR)
  const bands = numArray(g.bands, GENOME_BANDS)
  if (!contour || !bands) return null
  return {
    v: 1,
    born: g.born === 'voice' ? 'voice' : 'seed',
    pitch: r2(g.pitch as number), bright: r2(g.bright as number), rough: r2(g.rough as number),
    breath: r2(g.breath as number), dyn: r2(g.dyn as number), tempo: r2(g.tempo as number),
    contour, bands,
  }
}

const GENOME_KEY = 'ecosphere:voiceGenome'

export function readGenome(seed: string): VoiceGenome {
  try {
    const raw = window.localStorage.getItem(GENOME_KEY)
    const parsed = raw ? sanitizeGenome(JSON.parse(raw)) : null
    if (parsed) return parsed
  } catch { /* fall through to the seeded form */ }
  return genomeFromSeed(seed)
}

export function hasVoiceGenome(): boolean {
  try {
    const raw = window.localStorage.getItem(GENOME_KEY)
    return sanitizeGenome(raw ? JSON.parse(raw) : null)?.born === 'voice'
  } catch { return false }
}

export function saveGenome(g: VoiceGenome): void {
  const clean = sanitizeGenome(g)
  if (!clean) return
  try { window.localStorage.setItem(GENOME_KEY, JSON.stringify(clean)) } catch { /* session only */ }
}

/** short phrase for how this voice came out — shown after the birth */
export function describeGenome(g: VoiceGenome): string {
  const depth = g.pitch < 0.33 ? 'deep' : g.pitch > 0.66 ? 'high' : 'mid'
  const tone = g.bright > 0.6 ? 'bright' : g.bright < 0.3 ? 'dark' : 'warm'
  const grain = g.rough > 0.6 ? 'gritty' : g.breath > 0.6 ? 'breathy' : 'smooth'
  const move = g.tempo > 0.6 ? 'quick' : g.tempo < 0.3 ? 'slow-burning' : 'steady'
  return `${depth}, ${tone}, ${grain}, ${move}`
}
