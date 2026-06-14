// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { MOOD_FIELDS, DEFAULT_MOOD, readMood, saveMood, moodToVars } from '../profileMood'

describe('profile mood (emotional atmosphere)', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('defines eight emotional dimensions', () => {
    expect(MOOD_FIELDS).toHaveLength(8)
    for (const f of MOOD_FIELDS) expect(f.options.length).toBeGreaterThanOrEqual(3)
  })

  it('defaults to a calm late-night mood when nothing is saved', () => {
    expect(readMood()).toEqual(DEFAULT_MOOD)
  })

  it('round-trips a saved mood', () => {
    const mood = { ...DEFAULT_MOOD, drift: 'wandering', aura: 'burning' }
    saveMood(mood)
    expect(readMood()).toMatchObject(mood)
  })

  it('turns a mood into the full set of CSS variables', () => {
    const vars = moodToVars(DEFAULT_MOOD)
    for (const key of ['--mood-tint', '--mood-drift', '--mood-glow', '--mood-pulse', '--mood-flicker', '--mood-fade', '--mood-density', '--mood-trail']) {
      expect(vars[key]).toBeDefined()
    }
  })

  it('reflects intensity choices in the variables', () => {
    const still = moodToVars({ ...DEFAULT_MOOD, drift: 'still' })['--mood-drift']
    const wandering = moodToVars({ ...DEFAULT_MOOD, drift: 'wandering' })['--mood-drift']
    expect(still).toBe('0s')
    expect(wandering).not.toBe(still)
    const dim = moodToVars({ ...DEFAULT_MOOD, aura: 'dim' })['--mood-glow']
    const burning = moodToVars({ ...DEFAULT_MOOD, aura: 'burning' })['--mood-glow']
    expect(Number(burning)).toBeGreaterThan(Number(dim))
  })
})
