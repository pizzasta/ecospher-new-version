// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { castFrequency, frequencyFlavor } from '../frequencyOracle'
import { AVATAR_SIGILS } from '../avatar'
import { PROFILE_PALETTES, SCENE_STYLES } from '../frequencyGradient'
import { MOOD_FIELDS } from '../profileMood'
import { noteSyncEnabled, publishNote, fetchTopNotes } from '../noteSync'

describe('frequency oracle (let the frequency choose)', () => {
  it('casts a complete, valid identity from a seed, deterministically', () => {
    const a = castFrequency(12345)
    const b = castFrequency(12345)
    expect(a).toEqual(b)
    expect(AVATAR_SIGILS.some(s => s.id === a.sigil)).toBe(true)
    expect(PROFILE_PALETTES.some(p => p.id === a.paletteId)).toBe(true)
    expect(SCENE_STYLES).toContain(a.style)
    expect(Number(a.hz)).toBeGreaterThanOrEqual(40)
    for (const f of MOOD_FIELDS) {
      expect(f.options.some(o => o.value === a.mood[f.id])).toBe(true)
    }
    expect(a.flavor.length).toBeGreaterThan(0)
  })

  it('different seeds can land differently', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map(s => castFrequency(s).sigil)
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })

  it('gives flavor across the band', () => {
    expect(frequencyFlavor(50)).not.toBe(frequencyFlavor(180))
  })

  it('survives timestamp-scale seeds that overflow signed 32-bit', () => {
    // Date.now() values above 2^31 (mod 2^32) used to shift negative and
    // index the option lists out of range, crashing the oracle button
    const base = 415 * 2 ** 32 + 3_000_000_000 // ToInt32(base) < 0
    for (let i = 0; i < 64; i++) {
      const cast = castFrequency(base + i * 12_345)
      expect(PROFILE_PALETTES.some(p => p.id === cast.paletteId)).toBe(true)
      expect(SCENE_STYLES).toContain(cast.style)
    }
  })
})

describe('note sync (backend reactions, guarded)', () => {
  it('is disabled with no backend and degrades cleanly', async () => {
    expect(noteSyncEnabled).toBe(false)
    await expect(publishNote('a reflection drifting', '#caa57f')).resolves.toBe(false)
    await expect(fetchTopNotes()).resolves.toEqual([])
  })
})
