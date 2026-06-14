// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { bumpCastToday, castsToday } from '../castMetrics'

const DAY = 86400000

describe('cast metrics (anonymous daily tally)', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('starts at zero and counts up within a day', () => {
    const t = 1_000 * DAY
    expect(castsToday(t)).toBe(0)
    bumpCastToday(t); bumpCastToday(t); bumpCastToday(t)
    expect(castsToday(t)).toBe(3)
  })

  it('resets on a new day', () => {
    const t = 1_000 * DAY
    bumpCastToday(t); bumpCastToday(t)
    expect(castsToday(t)).toBe(2)
    expect(castsToday(t + DAY)).toBe(0)
    bumpCastToday(t + DAY)
    expect(castsToday(t + DAY)).toBe(1)
  })
})
