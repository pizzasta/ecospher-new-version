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
})
