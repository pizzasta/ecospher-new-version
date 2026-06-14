import { describe, expect, it } from 'vitest'
import { buildRecapScript, localDayKey } from '../frequencyRecap'
import { silenceLine, silentDays } from '../weightOfSilence'

const DAY = 24 * 60 * 60 * 1000

describe('frequency recap script', () => {
  const base = {
    visitedPages: ['rooms', 'unsent'],
    listenedLabels: ['gasstationoracle'],
    streak: 4,
    resonance: 72,
    silentDays: null,
    personalCapsules: 2,
  }

  it('always produces open + 3 echoes + capsule + close', () => {
    const script = buildRecapScript(base, new Date(2026, 5, 11))
    expect(script.segments).toHaveLength(6)
    expect(script.segments[0].id).toBe('open')
    expect(script.segments.filter(s => s.id.startsWith('echo-'))).toHaveLength(3)
    expect(script.segments[4].id).toBe('capsule')
    expect(script.segments[5].id).toBe('close')
  })

  it('quotes what the user actually replayed', () => {
    const script = buildRecapScript(base, new Date(2026, 5, 11))
    expect(script.segments[1].line).toContain('gasstationoracle')
  })

  it('falls back to the observatory when nothing was visited', () => {
    const script = buildRecapScript({ ...base, visitedPages: [], listenedLabels: [] }, new Date(2026, 5, 11))
    expect(script.segments[1].caption).toContain('home')
  })

  it('mentions sealed capsules when the user has them, forming otherwise', () => {
    const withCapsules = buildRecapScript(base, new Date(2026, 5, 11))
    expect(withCapsules.segments[4].line).toContain('2 sealed')
    const without = buildRecapScript({ ...base, personalCapsules: 0 }, new Date(2026, 5, 11))
    expect(without.segments[4].line).toContain('forming')
  })

  it('is deterministic for the same day', () => {
    const a = buildRecapScript(base, new Date(2026, 5, 11))
    const b = buildRecapScript(base, new Date(2026, 5, 11))
    expect(a.segments.map(s => s.seed)).toEqual(b.segments.map(s => s.seed))
  })

  it('builds a stable local day key', () => {
    expect(localDayKey(new Date(2026, 5, 11))).toBe('2026-06-11')
  })
})

describe('weight of silence', () => {
  const now = Date.UTC(2026, 5, 11, 12)

  it('returns null when there is no voice history', () => {
    expect(silentDays(null, now)).toBeNull()
  })

  it('counts whole days of silence', () => {
    expect(silentDays(now - 3 * DAY, now)).toBe(3)
    expect(silentDays(now - DAY + 1000, now)).toBe(0)
  })

  it('never goes negative on clock skew', () => {
    expect(silentDays(now + DAY, now)).toBeNull()
  })

  it('keeps the tone neutral at every stage', () => {
    expect(silenceLine(2)).toContain('remembers')
    expect(silenceLine(4)).toContain('fading')
    expect(silenceLine(7)).toContain('static')
    expect(silenceLine(30)).toContain('anyway')
  })
})
