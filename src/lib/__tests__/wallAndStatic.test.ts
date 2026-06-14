import { describe, expect, it } from 'vitest'
import { topReturns } from '../listeningIdentity'
import { MAX_GRAINS, daySeed, grainPositions } from '../visitorStatic'

describe('the wall of returns', () => {
  const listen = (label: string) => ({ label, playedAt: new Date().toISOString() })

  it('only shows fragments returned to at least twice, most-returned first', () => {
    const listens = [
      listen('a'), listen('a'), listen('a'),
      listen('b'), listen('b'),
      listen('c'),
    ]
    expect(topReturns(listens)).toEqual([
      { label: 'a', count: 3 },
      { label: 'b', count: 2 },
    ])
  })

  it('caps at three and stays empty without replays', () => {
    const listens = ['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd', 'e'].map(listen)
    expect(topReturns(listens)).toHaveLength(3)
    expect(topReturns(['x', 'y', 'z'].map(listen))).toEqual([])
  })
})

describe('visitor static grains', () => {
  it('is deterministic per day and changes across days', () => {
    expect(grainPositions(10, 20260611)).toEqual(grainPositions(10, 20260611))
    expect(grainPositions(10, 20260611)).not.toEqual(grainPositions(10, 20260612))
  })

  it('stays faint and in bounds, capped at MAX_GRAINS', () => {
    const grains = grainPositions(500, daySeed(new Date(2026, 5, 11)))
    expect(grains).toHaveLength(MAX_GRAINS)
    for (const grain of grains) {
      expect(grain.x).toBeGreaterThanOrEqual(0)
      expect(grain.x).toBeLessThanOrEqual(100)
      expect(grain.y).toBeGreaterThanOrEqual(0)
      expect(grain.y).toBeLessThanOrEqual(100)
      expect(grain.opacity).toBeLessThanOrEqual(0.34)
      expect(grain.size).toBeLessThanOrEqual(3)
    }
  })

  it('renders nothing for zero visitors', () => {
    expect(grainPositions(0, 1)).toEqual([])
  })
})
