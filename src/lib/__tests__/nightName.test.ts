import { describe, it, expect } from 'vitest'
import { castNightName } from '../nightName'
import { validateHzDisplayName, HZ_NAME_MAX } from '../hzSignature'

describe('castNightName', () => {
  it('is deterministic per seed', () => {
    expect(castNightName(1234567)).toBe(castNightName(1234567))
  })

  it('varies across seeds', () => {
    const names = new Set(Array.from({ length: 200 }, (_, i) => castNightName(i * 997)))
    expect(names.size).toBeGreaterThan(20)
  })

  it('every cast is a valid hz display name', () => {
    for (let i = 0; i < 500; i++) {
      const name = castNightName(i * 31 + 7)
      expect(name.length).toBeGreaterThan(0)
      expect(name.length).toBeLessThanOrEqual(HZ_NAME_MAX)
      expect(validateHzDisplayName(name)).toBeNull()
    }
  })

  it('stays valid for timestamp-scale seeds that overflow signed 32-bit', () => {
    // Date.now() values above 2^31 (mod 2^32) used to shift negative and
    // index the tone list with a negative modulo → "undefined nocturne"
    const base = 415 * 2 ** 32 + 3_000_000_000 // ToInt32(base) < 0
    for (let i = 0; i < 200; i++) {
      const name = castNightName(base + i * 7_919)
      expect(name).not.toContain('undefined')
      expect(validateHzDisplayName(name)).toBeNull()
    }
  })
})
