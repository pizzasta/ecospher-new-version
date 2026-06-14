// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { castRateCheck, recordCast, castWordCount, CAST_RATE } from '../castLine'

describe('cast-a-line rate limiter (fair)', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('allows the first cast', () => {
    expect(castRateCheck(1_000_000).allowed).toBe(true)
  })

  it('asks for a breath between rapid casts', () => {
    const t = 1_000_000
    recordCast(t)
    const g = castRateCheck(t + 500)
    expect(g.allowed).toBe(false)
    expect(g.waitMs).toBeGreaterThan(0)
    // after the gap it's fine again
    expect(castRateCheck(t + CAST_RATE.minGapMs + 1).allowed).toBe(true)
  })

  it('lets a handful through, then soft-caps per minute', () => {
    let t = 1_000_000
    for (let i = 0; i < CAST_RATE.perWindow; i++) { recordCast(t); t += CAST_RATE.minGapMs + 100 }
    const g = castRateCheck(t)
    expect(g.allowed).toBe(false)
    expect(g.reason).toMatch(/give it a minute/)
    // a minute after the first, the window clears
    expect(castRateCheck(1_000_000 + CAST_RATE.windowMs + 1).allowed).toBe(true)
  })

  it('counts words', () => {
    expect(castWordCount('  still   awake  tonight ')).toBe(3)
  })
})
