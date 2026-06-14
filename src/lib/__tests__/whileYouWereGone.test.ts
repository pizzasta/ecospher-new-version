// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { AWAY_THRESHOLD_MS, WELCOME_GAP_MS, markWelcomed, returnMoments, shouldWelcome, touchLastSeen } from '../whileYouWereGone'

describe('while you were gone', () => {
  beforeEach(() => window.localStorage.clear())

  it('never welcomes a brand-new device or a user who never left', () => {
    expect(shouldWelcome()).toBe(false)
    touchLastSeen()
    expect(shouldWelcome()).toBe(false)
  })

  it('welcomes after 3h away, then goes quiet for 6h', () => {
    const now = Date.now()
    touchLastSeen(now - AWAY_THRESHOLD_MS - 1000)
    expect(shouldWelcome(now)).toBe(true)
    markWelcomed(now)
    expect(shouldWelcome(now + 1000)).toBe(false)
    touchLastSeen(now - AWAY_THRESHOLD_MS - 1000)
    expect(shouldWelcome(now + WELCOME_GAP_MS + 1000)).toBe(true)
  })

  it('caps at two calm lines and stays human', () => {
    window.localStorage.setItem('ecosphere:tapeIntro', JSON.stringify({ id: 'x', durationMs: 8000, recordedAt: Date.now() }))
    window.localStorage.setItem('ecosphere:relicActivity', JSON.stringify({ rl1: { replays: 3 } }))
    const moments = returnMoments()
    expect(moments.length).toBeGreaterThan(0)
    expect(moments.length).toBeLessThanOrEqual(2)
    for (const line of moments) {
      expect(line).not.toMatch(/click here|don't miss|act now|!{2,}/i)
      expect(line.length).toBeLessThan(70)
    }
  })

  it('mentions your voice only when you actually have one out there', () => {
    const fresh = returnMoments()
    expect(fresh.join(' ')).not.toMatch(/your signal|yours/)
  })
})
