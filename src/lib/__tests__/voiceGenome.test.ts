import { describe, expect, it } from 'vitest'
import { analyzeVoice, genomeFromSeed, sanitizeGenome, describeGenome } from '../voiceGenome'

const RATE = 44100

/** a voice-ish tone: fundamental + harmonics, with a loudness envelope */
function voice(f0: number, opts: { seconds?: number; harmonics?: number; noise?: number; wobble?: number; pulses?: number } = {}) {
  const { seconds = 3, harmonics = 6, noise = 0, wobble = 0, pulses = 3 } = opts
  const n = Math.floor(RATE * seconds)
  const out = new Float32Array(n)
  let seed = 7
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 - 0.5 }
  let phase = 0
  for (let i = 0; i < n; i++) {
    const t = i / RATE
    const f = f0 * (1 + wobble * Math.sin(t * 2.2))
    phase += (2 * Math.PI * f) / RATE
    let s = 0
    for (let h = 1; h <= harmonics; h++) s += Math.sin(phase * h) / h
    const env = 0.35 + 0.65 * Math.pow(Math.sin((Math.PI * pulses * t) / seconds) ** 2, 1)
    out[i] = (s * 0.3 + rand() * noise) * env
  }
  return out
}

describe('analyzeVoice', () => {
  it('finds the pitch of a tone on a low-to-high scale', () => {
    const low = analyzeVoice(voice(110), RATE)!
    const high = analyzeVoice(voice(330), RATE)!
    expect(low.born).toBe('voice')
    expect(high.pitch).toBeGreaterThan(low.pitch + 0.3)
    expect(low.pitch).toBeGreaterThan(0.1)
    expect(low.pitch).toBeLessThan(0.5)
  })

  it('reads a noisy voice as rougher and breathier than a clean one', () => {
    const clean = analyzeVoice(voice(180), RATE)!
    const gritty = analyzeVoice(voice(180, { noise: 0.9 }), RATE)!
    expect(gritty.rough).toBeGreaterThan(clean.rough)
    expect(gritty.breath).toBeGreaterThan(clean.breath)
  })

  it('reads fewer harmonics as darker than many', () => {
    const dark = analyzeVoice(voice(150, { harmonics: 1 }), RATE)!
    const bright = analyzeVoice(voice(150, { harmonics: 20 }), RATE)!
    expect(bright.bright).toBeGreaterThan(dark.bright)
  })

  it('gives different voices different shapes', () => {
    const a = analyzeVoice(voice(140, { wobble: 0.15 }), RATE)!
    const b = analyzeVoice(voice(260, { harmonics: 12, noise: 0.3 }), RATE)!
    expect(JSON.stringify(a.bands)).not.toBe(JSON.stringify(b.bands))
    expect(JSON.stringify(a.contour)).not.toBe(JSON.stringify(b.contour))
  })

  it('counts a faster rhythm as quicker', () => {
    const slow = analyzeVoice(voice(160, { pulses: 2 }), RATE)!
    const quick = analyzeVoice(voice(160, { pulses: 14 }), RATE)!
    expect(quick.tempo).toBeGreaterThan(slow.tempo)
  })

  it('returns null for silence and for takes that are too short', () => {
    expect(analyzeVoice(new Float32Array(RATE * 3), RATE)).toBeNull()
    expect(analyzeVoice(voice(150, { seconds: 0.05 }), RATE)).toBeNull()
  })

  it('keeps every value in range with the right array lengths', () => {
    const g = analyzeVoice(voice(200, { noise: 0.5, wobble: 0.1 }), RATE)!
    for (const k of ['pitch', 'bright', 'rough', 'breath', 'dyn', 'tempo'] as const) {
      expect(g[k]).toBeGreaterThanOrEqual(0); expect(g[k]).toBeLessThanOrEqual(1)
    }
    expect(g.contour).toHaveLength(12); expect(g.bands).toHaveLength(12)
    expect([...g.contour, ...g.bands].every(v => v >= 0 && v <= 1)).toBe(true)
    expect(describeGenome(g)).toMatch(/,/)
  })
})

describe('genome seed and validation', () => {
  it('is deterministic per seed and different across seeds', () => {
    expect(genomeFromSeed('moth')).toEqual(genomeFromSeed('moth'))
    expect(genomeFromSeed('moth')).not.toEqual(genomeFromSeed('lantern'))
    expect(genomeFromSeed('moth').born).toBe('seed')
  })
  it('accepts a good genome and rejects malformed ones', () => {
    const g = genomeFromSeed('x')
    expect(sanitizeGenome(JSON.parse(JSON.stringify(g)))).toEqual(g)
    expect(sanitizeGenome({ ...g, contour: [1, 2] })).toBeNull()
    expect(sanitizeGenome({ ...g, pitch: 'high' })).toBeNull()
    expect(sanitizeGenome({ ...g, v: 2 })).toBeNull()
    expect(sanitizeGenome(null)).toBeNull()
  })
  it('clamps out-of-range numbers instead of trusting them', () => {
    const g = genomeFromSeed('y')
    const out = sanitizeGenome({ ...g, pitch: 9, bands: g.bands.map(() => -4) })!
    expect(out.pitch).toBe(1)
    expect(out.bands.every(v => v === 0)).toBe(true)
  })
})
