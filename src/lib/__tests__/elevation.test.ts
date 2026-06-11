import { describe, expect, it } from 'vitest'
import { predictText } from '../predictiveEcho'
import { temporalWindow, tomorrowLabel } from '../temporalWindow'
import { futureSignals } from '../futureSignals'

describe('predictive echo', () => {
  it('returns null for empty or unknown input', () => {
    expect(predictText('')).toBeNull()
    expect(predictText('zzzzqqqq')).toBeNull()
  })

  it('completes from corpus words, starting with a space', () => {
    // "the" appears throughout the ghost archive
    const suggestion = predictText('the')
    expect(suggestion).not.toBeNull()
    expect(suggestion).toMatch(/^ \S/)
  })

  it('respects the max word budget', () => {
    const suggestion = predictText('the', 3)
    if (suggestion) {
      expect(suggestion.trim().split(/\s+/).length).toBeLessThanOrEqual(3)
    }
  })
})

describe('temporal resonance window', () => {
  const at = (h: number, m: number) => new Date(2026, 5, 11, h, m)

  it('is open from 3:33 to 3:42', () => {
    expect(temporalWindow(at(3, 33)).phase).toBe('open')
    expect(temporalWindow(at(3, 42)).phase).toBe('open')
    expect(temporalWindow(at(3, 38)).minutesRemaining).toBe(5)
  })

  it('is forming from 3:00 to 3:32', () => {
    expect(temporalWindow(at(3, 0)).phase).toBe('forming')
    expect(temporalWindow(at(3, 32)).phase).toBe('forming')
    expect(temporalWindow(at(3, 30)).minutesUntilOpen).toBe(3)
  })

  it('is closed the rest of the day', () => {
    expect(temporalWindow(at(3, 43)).phase).toBe('closed')
    expect(temporalWindow(at(2, 59)).phase).toBe('closed')
    expect(temporalWindow(at(15, 38)).phase).toBe('closed')
    expect(temporalWindow(at(0, 0)).phase).toBe('closed')
  })

  it('labels future signals with tomorrow', () => {
    const label = tomorrowLabel(new Date(2026, 5, 11))
    expect(label.toLowerCase()).toContain('12')
    const signals = futureSignals()
    expect(signals.length).toBeGreaterThanOrEqual(5)
    expect(signals.every(s => s.timeLabel.includes('tomorrow'))).toBe(true)
  })
})
