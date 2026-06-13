// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  FREQUENCIES, tonightsFrequency, lastNightsFrequency, weaveSources,
  contributedTonight, recordContribution, lastNightUploadId,
} from '../tonightsFrequency'

const DAY = 86400000

describe("tonight's frequency", () => {
  beforeEach(() => { window.localStorage.clear() })

  it('has a deck of stations', () => {
    expect(FREQUENCIES.length).toBeGreaterThanOrEqual(10)
    for (const f of FREQUENCIES) {
      expect(f.label.length).toBeGreaterThan(0)
      expect(f.hz).toMatch(/^\d/)
    }
  })

  it("tonight is yesterday's 'last night'", () => {
    const now = 1_000 * DAY + 5 * 3600_000
    expect(lastNightsFrequency(now).id).toBe(tonightsFrequency(now - DAY).id)
  })

  it('weave is a set of layers, plus your own clip when present', () => {
    const without = weaveSources(1_000 * DAY)
    expect(without.length).toBeGreaterThanOrEqual(5)
    const withBlob = weaveSources(1_000 * DAY, new Blob(['x']))
    expect(withBlob.length).toBe(without.length + 1)
    expect(withBlob.some(s => 'blob' in s)).toBe(true)
  })

  it('tracks tonight\'s contribution and surfaces it as last night\'s the next day', () => {
    const now = 1_000 * DAY + 2 * 3600_000
    expect(contributedTonight(now)).toBe(false)
    recordContribution('rec-1', now)
    expect(contributedTonight(now)).toBe(true)
    expect(lastNightUploadId(now)).toBeNull()           // not last night — it's tonight
    expect(lastNightUploadId(now + DAY)).toBe('rec-1')  // tomorrow it's last night's
  })
})
