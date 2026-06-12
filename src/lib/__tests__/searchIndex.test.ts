import { describe, expect, it } from 'vitest'
import { buildSearchIndex, searchSignals } from '../searchIndex'

describe('signal search', () => {
  const index = buildSearchIndex()

  it('finds by feeling, not just by name', () => {
    expect(searchSignals("can't sleep", index)[0].page).toMatch(/rooms|chains/)
    expect(searchSignals('driving at night', index).map(e => e.id)).toContain('rm3')
    expect(searchSignals('people laughing', index).map(e => e.id)).toContain('sea2')
    expect(searchSignals('unfinished conversations', index).length).toBeGreaterThan(0)
    expect(searchSignals('songs people stayed in', index).map(e => e.id)).toContain('rl8')
  })

  it('finds by name and routes to the right page', () => {
    const hold = searchSignals('hold music', index)
    expect(hold[0].id).toBe('rl7')
    expect(hold[0].page).toBe('relics')
  })

  it('caps results and returns nothing for nonsense', () => {
    expect(searchSignals('quiet', index).length).toBeLessThanOrEqual(8)
    expect(searchSignals('xylophone quarterly report', index)).toHaveLength(0)
  })

  it('every entry carries an audio preview seed and a route', () => {
    for (const entry of index) {
      expect(entry.seed).toBeGreaterThan(0)
      expect(entry.page.length).toBeGreaterThan(2)
    }
  })
})
