import { describe, expect, it } from 'vitest'
import { generateLocalBio } from '../aiBio'
import { BIO_MAX_LENGTH } from '../library'

const base = {
  username: 'gasstationoracle',
  recordingCount: 4,
  topPage: 'rooms',
  streak: 3,
  joinedLabel: 'Jun 2026',
}

describe('local AI bio generator', () => {
  it('produces one sentence within the bio limit', () => {
    const bio = generateLocalBio(base, 0)
    expect(bio.length).toBeLessThanOrEqual(BIO_MAX_LENGTH)
    expect(bio.endsWith('.')).toBe(true)
    expect(bio).toContain('late-night rooms')
  })

  it('is deterministic per seed and varies across seeds', () => {
    expect(generateLocalBio(base, 1)).toBe(generateLocalBio(base, 1))
    const variants = new Set([0, 1, 2, 3, 4].map(seed => generateLocalBio(base, seed)))
    expect(variants.size).toBeGreaterThan(1)
  })

  it('handles silent users and unknown pages', () => {
    const bio = generateLocalBio({ ...base, recordingCount: 0, topPage: null, streak: 0 }, 0)
    expect(bio).toContain('observatory')
    expect(bio).not.toContain('transmissions released')
  })

  it('mentions the streak when 2+ nights', () => {
    expect(generateLocalBio(base, 0)).toContain('3 nights running')
    expect(generateLocalBio({ ...base, streak: 1 }, 0)).not.toContain('running')
  })
})
