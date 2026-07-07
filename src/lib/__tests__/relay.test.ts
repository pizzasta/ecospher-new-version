// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { relayState, relaySignal, hasRelayed, relayCount, ghostCarriers, distanceLine } from '../relay'

beforeEach(() => window.localStorage.clear())

describe('relay — spread you can hear, not count', () => {
  it('every signal already carries a seeded chorus, stable per signal', () => {
    const a = ghostCarriers('f1')
    expect(a).toEqual(ghostCarriers('f1'))
    expect(a.length).toBeGreaterThanOrEqual(1)
    expect(a.length).toBeLessThanOrEqual(7)
    expect(ghostCarriers('f2')).not.toEqual(a)
  })

  it('relaying folds your Hz into the chorus and pushes the distance', () => {
    const now = Date.now()
    const before = relayState('f1', now)
    expect(before.relayedByMe).toBe(false)
    const after = relaySignal('f1', 96.5, now)
    expect(after.relayedByMe).toBe(true)
    expect(after.carriers).toHaveLength(before.carriers.length + 1)
    expect(after.carriers[after.carriers.length - 1]).toBe(96.5) // yours rides last
    expect(after.distanceKm).toBeGreaterThan(before.distanceKm)
    expect(hasRelayed('f1')).toBe(true)
  })

  it('a voice is only pushed once — relaying twice is a no-op', () => {
    const now = Date.now()
    const first = relaySignal('f1', 96.5, now)
    const second = relaySignal('f1', 96.5, now)
    expect(second.carriers).toEqual(first.carriers)
    expect(second.distanceKm).toBe(first.distanceKm)
    expect(relayCount()).toBe(1)
  })

  it('the signal keeps drifting further as real time passes', () => {
    const now = Date.now()
    const today = relayState('f1', now)
    const nextWeek = relayState('f1', now + 7 * 86_400_000)
    expect(nextWeek.distanceKm).toBeGreaterThan(today.distanceKm)
  })

  it('reads as distance and voices, with your presence acknowledged', () => {
    const now = Date.now()
    expect(distanceLine(relayState('f1', now))).toMatch(/carried \d+ km down the band by (one voice|\d+ voices)/)
    relaySignal('f1', 96.5, now)
    expect(distanceLine(relayState('f1', now))).toContain('yours is in it now')
  })

  it('survives corrupt storage', () => {
    window.localStorage.setItem('ecosphere:relays', '{nope')
    expect(hasRelayed('f1')).toBe(false)
    expect(relayCount()).toBe(0)
    expect(() => relayState('f1')).not.toThrow()
  })
})
