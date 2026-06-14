import { describe, it, expect } from 'vitest'
import {
  bandActivityAt, nightlyWave, bandNow, bandPhase, signalWeather, collectiveMood,
  bandIndicators, bandAlmanac, peakPressure, MOOD_SPECTRUM,
} from '../observatory'

// a fixed 3am moment for deterministic checks
const at = (h: number) => new Date(2026, 5, 13, h, 0, 0).getTime()

describe('observatory — the nocturne band', () => {
  it('activity peaks in the deep hours and is quiet at midday', () => {
    expect(bandActivityAt(3)).toBeGreaterThan(bandActivityAt(13))
    expect(bandActivityAt(3)).toBeGreaterThan(0.6)
  })

  it('produces a 24-point nightly wave bounded 0..1', () => {
    const wave = nightlyWave(at(3))
    expect(wave).toHaveLength(24)
    for (const p of wave) {
      expect(p.value).toBeGreaterThanOrEqual(0)
      expect(p.value).toBeLessThanOrEqual(1)
    }
  })

  it('reads the phase by time of night', () => {
    expect(bandPhase(at(3))).toBe('peaking')
    expect(bandPhase(at(13))).toBe('resting')
  })

  it('signal weather goes stormy on demand and stays in the set otherwise', () => {
    expect(signalWeather(at(2), true).id).toBe('storm')
    const w = signalWeather(at(2), false)
    expect(['clear', 'static', 'fog', 'aurora', 'calm']).toContain(w.id)
  })

  it('collective mood is a single labelled point on the spectrum', () => {
    const m = collectiveMood(at(3))
    expect(m.value).toBeGreaterThanOrEqual(0)
    expect(m.value).toBeLessThanOrEqual(1)
    expect(MOOD_SPECTRUM).toContain(m.label as typeof MOOD_SPECTRUM[number])
  })

  it('gives 7 live indicators and honors a live carrier count', () => {
    const inds = bandIndicators(at(2), { carriers: 42 })
    expect(inds).toHaveLength(7)
    expect(inds.find(i => i.id === 'carriers')?.value).toBe('42')
    expect(bandNow(at(2))).toBeGreaterThan(0)
  })

  it('almanac compares last night and tonight on the same axes', () => {
    const a = bandAlmanac(at(2))
    expect(MOOD_SPECTRUM).toContain(a.tonight.mood as typeof MOOD_SPECTRUM[number])
    expect(MOOD_SPECTRUM).toContain(a.lastNight.mood as typeof MOOD_SPECTRUM[number])
    expect(a.tonight.pressure).toBe(peakPressure(at(2)))
    expect(a.line.length).toBeGreaterThan(0)
  })
})
