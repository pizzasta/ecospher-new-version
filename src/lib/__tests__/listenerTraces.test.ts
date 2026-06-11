import { describe, expect, it } from 'vitest'
import { mostReplayedTrace, tracesForSignal } from '../listenerTraces'

const day = new Date(2026, 5, 11, 15, 0) // 3pm — not night hours
const night = new Date(2026, 5, 11, 2, 30) // 2:30am

describe('trace placement gating', () => {
  it('gives nothing to quiet, unreplayed signals', () => {
    expect(tracesForSignal('f4', { replayed: false, resonance: 60, now: day })).toEqual([])
  })

  it('gives one trace to heavily replayed signals', () => {
    const traces = tracesForSignal('f1', { replayed: false, resonance: 94, now: day })
    expect(traces).toHaveLength(1)
    expect(traces[0].delayMs).toBe(0)
  })

  it('unlocks a second, late-arriving trace after the user replays', () => {
    const traces = tracesForSignal('f4', { replayed: true, resonance: 60, now: day })
    expect(traces).toHaveLength(2)
    expect(traces[1].delayMs).toBeGreaterThanOrEqual(18000)
  })

  it('surfaces a night trace only between midnight and 5am', () => {
    const atNight = tracesForSignal('f1', { replayed: false, resonance: 94, now: night })
    expect(atNight.some(t => t.night)).toBe(true)
    const byDay = tracesForSignal('f1', { replayed: false, resonance: 94, now: day })
    expect(byDay.some(t => t.night)).toBe(false)
  })
})

describe('trace texture', () => {
  it('is deterministic per signal and varies across signals', () => {
    const a = tracesForSignal('f1', { replayed: true, resonance: 90, now: day })
    const b = tracesForSignal('f1', { replayed: true, resonance: 90, now: day })
    expect(a).toEqual(b)
    const c = tracesForSignal('f2', { replayed: true, resonance: 90, now: day })
    expect(c[0].text).not.toBe(a[0].text)
  })

  it('sits slightly crooked, never perfectly straight rows', () => {
    const traces = tracesForSignal('f1', { replayed: true, resonance: 94, now: day })
    for (const trace of traces) {
      expect(Math.abs(trace.tilt)).toBeLessThanOrEqual(2.5)
      expect(trace.offset).toBeGreaterThanOrEqual(0)
      expect(trace.offset).toBeLessThanOrEqual(100)
    }
  })

  it('avoids the banned poetic register', () => {
    const all = [
      ...tracesForSignal('f1', { replayed: true, resonance: 95, now: night }),
      ...tracesForSignal('f2', { replayed: true, resonance: 95, now: night }),
      ...tracesForSignal('f3', { replayed: true, resonance: 95, now: night }),
    ].map(t => t.text.toLowerCase())
    for (const text of all) {
      expect(text).not.toMatch(/resonance|frequenc|bloom|orbit|cyan|drift/)
    }
  })
})

describe('most replayed trace', () => {
  it('only exists for heavily replayed signals', () => {
    expect(mostReplayedTrace('f1', 94)).toBeTruthy()
    expect(mostReplayedTrace('f1', 89)).toBeNull()
  })

  it('is stable per signal', () => {
    expect(mostReplayedTrace('f1', 94)).toBe(mostReplayedTrace('f1', 94))
  })
})
