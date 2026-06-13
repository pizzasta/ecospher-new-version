// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { driftedTextRelics } from '../castRelics'

describe('drifted text relics (cast lines that travelled)', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('returns nothing with no cast lines', () => {
    expect(driftedTextRelics()).toEqual([])
  })

  it('only the well-travelled lines graduate, deterministically, top 2', () => {
    // seed a bunch of lines; whichever cross the threshold are returned
    const lines = Array.from({ length: 12 }, (_, i) => `line number ${i} drifting in the sea`)
    window.localStorage.setItem('ecosphere:seaLines', JSON.stringify(lines))
    const a = driftedTextRelics(1_000 * 86400000)
    const b = driftedTextRelics(1_000 * 86400000)
    expect(a).toEqual(b)               // deterministic per day
    expect(a.length).toBeLessThanOrEqual(2)
    for (const r of a) {
      expect(r.passes).toBeGreaterThanOrEqual(22)
      expect(r.text).toBeTruthy()
      expect(r.note).toBeTruthy()
    }
    // sorted by passes desc
    if (a.length === 2) expect(a[0].passes).toBeGreaterThanOrEqual(a[1].passes)
  })
})
