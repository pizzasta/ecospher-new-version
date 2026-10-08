// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  currentMoment, shouldSurface, secondsLeft, othersInMoment,
  joinMoment, dismissMoment, hasJoined, isDismissed, momentsJoined,
  hourHostsMoment, momentMinute, MOMENT_DURATION_MS,
} from '../simultaneous'

beforeEach(() => window.localStorage.clear())

// walk a day of hours to find one that hosts a moment (deterministic)
function firstHostingHour(): Date {
  const base = new Date('2026-07-08T00:00:00')
  for (let h = 0; h < 48; h++) {
    const d = new Date(base.getTime() + h * 3_600_000)
    if (hourHostsMoment(d)) return d
  }
  throw new Error('no hosting hour in 48 — scheduling broke')
}

describe('the moment schedule', () => {
  it('only some hours host a moment, deterministically', () => {
    const d = new Date('2026-07-08T03:00:00')
    expect(hourHostsMoment(d)).toBe(hourHostsMoment(new Date('2026-07-08T03:00:00')))
    // across a day, some host and some don't — it's rare, not constant
    let hosts = 0
    for (let h = 0; h < 24; h++) if (hourHostsMoment(new Date(2026, 6, 8, h))) hosts++
    expect(hosts).toBeGreaterThan(0)
    expect(hosts).toBeLessThan(24)
  })

  it('opens on a stable minute inside a hosting hour', () => {
    const host = firstHostingHour()
    const min = momentMinute(host)
    expect(min).toBeGreaterThanOrEqual(2)
    expect(min).toBeLessThanOrEqual(56)
    // exactly on the minute → open; a minute before → closed
    const openAt = new Date(host); openAt.setMinutes(min, 5, 0)
    const before = new Date(host); before.setMinutes(min - 2, 0, 0)
    expect(currentMoment(openAt.getTime())).not.toBeNull()
    expect(currentMoment(before.getTime())).toBeNull()
  })

  it('closes after the shared window elapses', () => {
    const host = firstHostingHour()
    const start = new Date(host); start.setMinutes(momentMinute(host), 0, 0)
    expect(currentMoment(start.getTime() + 1000)).not.toBeNull()
    expect(currentMoment(start.getTime() + MOMENT_DURATION_MS + 1000)).toBeNull()
  })
})

describe('a moment is the same for everyone', () => {
  const now = Date.now()
  beforeEach(() => window.localStorage.setItem('ecosphere:simultaneousOverride', 'open'))

  it('is deterministic content per hour — one prompt, one tone', () => {
    const a = currentMoment(now)!
    const b = currentMoment(now)!
    expect(a.id).toBe(b.id)
    expect(a.line).toBe(b.line)
    expect(a.glyph).toBe(b.glyph)
    expect(a.toneHz).toBe(b.toneHz)
    expect(a.toneHz).toBeGreaterThanOrEqual(174)
  })

  it('counts others sharing it, drifting up as the window runs', () => {
    const m = currentMoment(now)!
    const early = othersInMoment(m, m.endsAt - MOMENT_DURATION_MS + 1000)
    const late = othersInMoment(m, m.endsAt - 2000)
    expect(early).toBeGreaterThan(0)
    expect(late).toBeGreaterThanOrEqual(early)
  })

  it('reports seconds left within the window', () => {
    const m = currentMoment(now)!
    expect(secondsLeft(m, m.endsAt - 10_000)).toBe(10)
    expect(secondsLeft(m, m.endsAt + 5000)).toBe(0)
  })
})

describe('answering a moment', () => {
  beforeEach(() => window.localStorage.setItem('ecosphere:simultaneousOverride', 'open'))

  it('joining records it and stops it re-surfacing', () => {
    const m = currentMoment()!
    expect(shouldSurface()).not.toBeNull()
    joinMoment(m.id)
    expect(hasJoined(m.id)).toBe(true)
    expect(momentsJoined()).toBe(1)
    expect(shouldSurface()).toBeNull() // answered — never nags
  })

  it('letting it pass dismisses it without joining', () => {
    const m = currentMoment()!
    dismissMoment(m.id)
    expect(isDismissed(m.id)).toBe(true)
    expect(hasJoined(m.id)).toBe(false)
    expect(shouldSurface()).toBeNull()
  })

  it('survives corrupt storage', () => {
    window.localStorage.setItem('ecosphere:simultaneous', '{broken')
    expect(hasJoined('x')).toBe(false)
    expect(() => joinMoment('x')).not.toThrow()
  })
})
