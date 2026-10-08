// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  HZ_MAX,
  HZ_MIN,
  HZ_PRESET_COLORS,
  PHANTOM_HZ,
  computeHzSignature,
  getLocalHzProfile,
  hzForHandle,
  isPresetColor,
  seedHzSignature,
  validateHzDisplayName,
} from '../hzSignature'

describe('hz signature computation', () => {
  it('applies the formula: avg*2 + reactions*0.5 + 20', () => {
    expect(computeHzSignature(10, 4)).toBe(42)
    expect(computeHzSignature(30, 10)).toBe(85)
  })

  it('clamps between 20 and 200', () => {
    expect(computeHzSignature(0, 0)).toBe(HZ_MIN)
    expect(computeHzSignature(500, 1000)).toBe(HZ_MAX)
  })

  it('rounds to one decimal', () => {
    const value = computeHzSignature(7.77, 3)
    expect(value).toBe(Math.round(value * 10) / 10)
  })
})

describe('hz for synthetic handles', () => {
  it('is deterministic and in range', () => {
    const a = hzForHandle('gasstationoracle')
    expect(a).toEqual(hzForHandle('gasstationoracle'))
    expect(a.hz).toBeGreaterThanOrEqual(HZ_MIN)
    expect(a.hz).toBeLessThanOrEqual(HZ_MAX)
    expect(isPresetColor(a.color)).toBe(true)
  })

  it('differs across handles', () => {
    expect(hzForHandle('gasstationoracle').hz).not.toBe(hzForHandle('blurrywafflehouse').hz)
  })

  it('keeps the phantom fixed at 33.3', () => {
    expect(PHANTOM_HZ.hz).toBe(33.3)
  })
})

describe('hz settings validation', () => {
  it('accepts valid names and empty (clears)', () => {
    expect(validateHzDisplayName('driftwave')).toBeNull()
    expect(validateHzDisplayName('drift wave 7')).toBeNull()
    expect(validateHzDisplayName('')).toBeNull()
  })

  it('rejects long or non-alphanumeric names', () => {
    expect(validateHzDisplayName('a'.repeat(21))).toMatch(/max 20/)
    expect(validateHzDisplayName('drift_wave')).toMatch(/letters/)
    expect(validateHzDisplayName('<script>')).toMatch(/letters/)
  })

  it('only allows preset colors', () => {
    for (const preset of HZ_PRESET_COLORS) expect(isPresetColor(preset.value)).toBe(true)
    expect(isPresetColor('#bada55')).toBe(false)
    expect(isPresetColor('red')).toBe(false)
  })
})

describe('seeding the local signature (onboarding)', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('persists the previewed hz for a brand-new profile', () => {
    seedHzSignature(137.2)
    expect(getLocalHzProfile('anyone').hz).toBe(137.2)
  })

  it('never overwrites a signature that already exists', () => {
    seedHzSignature(137.2)
    seedHzSignature(55.5)
    expect(getLocalHzProfile('anyone').hz).toBe(137.2)
  })

  it('clamps into the band and rounds to one decimal', () => {
    seedHzSignature(999.99)
    expect(getLocalHzProfile('anyone').hz).toBe(HZ_MAX)
  })
})
