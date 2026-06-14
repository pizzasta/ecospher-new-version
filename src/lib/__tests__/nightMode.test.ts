import { describe, expect, it } from 'vitest'
import { DEEP_NIGHT_LINES, isDeepNight, nightIntensity } from '../nightMode'

const at = (h: number, m = 0) => new Date(2026, 5, 11, h, m)

describe('night intensity curve', () => {
  it('is zero through the day', () => {
    expect(nightIntensity(at(9))).toBe(0)
    expect(nightIntensity(at(14))).toBe(0)
    expect(nightIntensity(at(20, 59))).toBe(0)
  })

  it('ramps up through the evening', () => {
    expect(nightIntensity(at(21))).toBeCloseTo(0.3, 5)
    expect(nightIntensity(at(22, 30))).toBeGreaterThan(0.3)
    expect(nightIntensity(at(23, 59))).toBeLessThanOrEqual(1)
  })

  it('holds full depth from midnight to 4am', () => {
    expect(nightIntensity(at(0))).toBe(1)
    expect(nightIntensity(at(3, 33))).toBe(1)
    expect(nightIntensity(at(3, 59))).toBe(1)
  })

  it('ramps down from 4 to 6am', () => {
    expect(nightIntensity(at(5))).toBeCloseTo(0.5, 5)
    expect(nightIntensity(at(6))).toBe(0)
  })

  it('deep night is the midnight-4am window', () => {
    expect(isDeepNight(at(2))).toBe(true)
    expect(isDeepNight(at(15))).toBe(false)
    expect(isDeepNight(at(21, 30))).toBe(false)
  })

  it('keeps the night lines in the human register', () => {
    for (const line of DEEP_NIGHT_LINES) {
      expect(line.toLowerCase()).not.toMatch(/resonance|bloom|orbit|cyan/)
    }
  })
})
