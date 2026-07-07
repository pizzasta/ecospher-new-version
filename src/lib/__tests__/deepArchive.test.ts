// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  ARTIFACTS, CARRY_LIMIT, tonightsArtifact, descend, descendedTonight, surfacedTonight,
  msUntilDawn, scanDepth, carry, setDown, isCarried, carriedArtifacts, carryingRoom,
} from '../deepArchive'

beforeEach(() => window.localStorage.clear())

describe('the nightly descent', () => {
  it('is deterministic per night — reloading never rerolls', () => {
    const now = Date.now()
    expect(tonightsArtifact(now).id).toBe(tonightsArtifact(now).id)
    const a = descend(now)
    const b = descend(now) // second call the same night returns the same artifact
    expect(b.id).toBe(a.id)
    expect(descendedTonight(now)).toBe(true)
    expect(surfacedTonight(now)?.id).toBe(a.id)
  })

  it('has not descended before the first descent', () => {
    expect(descendedTonight()).toBe(false)
    expect(surfacedTonight()).toBeNull()
  })

  it('prefers artifacts that have not surfaced before', () => {
    const base = Date.now()
    const seen = new Set<string>()
    for (let d = 0; d < ARTIFACTS.length; d++) {
      const a = descend(base + d * 86_400_000)
      expect(seen.has(a.id)).toBe(false) // bottomless until the pool is exhausted
      seen.add(a.id)
    }
    expect(seen.size).toBe(ARTIFACTS.length)
  })

  it('reseals at dawn: countdown is positive and under 24h', () => {
    const ms = msUntilDawn()
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(24 * 3_600_000)
  })

  it('scan depth is stable flavor for the night', () => {
    const now = Date.now()
    expect(scanDepth(now)).toBe(scanDepth(now))
    expect(scanDepth(now)).toBeGreaterThanOrEqual(180)
  })
})

describe('carrying — three pockets, no trophies', () => {
  it('carries up to the limit, then demands a choice', () => {
    const [a, b, c, d] = ARTIFACTS
    expect(carry(a.id)).toBe(true)
    expect(carry(b.id)).toBe(true)
    expect(carry(c.id)).toBe(true)
    expect(carryingRoom()).toBe(false)
    expect(carry(d.id)).toBe(false) // hands full — no silent eviction
    expect(carriedArtifacts()).toHaveLength(CARRY_LIMIT)
  })

  it('setting one down makes room and never errors on strangers', () => {
    const [a, b] = ARTIFACTS
    carry(a.id)
    expect(isCarried(a.id)).toBe(true)
    setDown(a.id)
    expect(isCarried(a.id)).toBe(false)
    setDown('not-a-real-artifact') // harmless
    expect(carry(b.id)).toBe(true)
  })

  it('carrying the same artifact twice is a no-op, not a duplicate', () => {
    const a = ARTIFACTS[0]
    carry(a.id)
    carry(a.id)
    expect(carriedArtifacts()).toHaveLength(1)
  })

  it('survives corrupt storage', () => {
    window.localStorage.setItem('ecosphere:deepArchive', '{broken')
    expect(carriedArtifacts()).toEqual([])
    expect(descendedTonight()).toBe(false)
  })
})
