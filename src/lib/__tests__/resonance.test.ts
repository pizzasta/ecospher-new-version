// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  RESONANCE_SIGILS, toggleResonance, myResonance, tallyFor, topSigils, resonanceScore, baseTally,
} from '../resonance'

describe('resonance (sigils + impact)', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('offers a small set of meaningful sigils, not likes', () => {
    expect(RESONANCE_SIGILS.length).toBeGreaterThanOrEqual(6)
    for (const s of RESONANCE_SIGILS) {
      expect(s.glyph).toBeTruthy()
      expect(s.label).toBeTruthy()
      expect(s.meaning).toBeTruthy()
    }
  })

  it('toggles your sigil on/off/change', () => {
    expect(myResonance('n1')).toBeNull()
    toggleResonance('n1', 'felt')
    expect(myResonance('n1')).toBe('felt')
    toggleResonance('n1', 'felt') // same again = take it back
    expect(myResonance('n1')).toBeNull()
    toggleResonance('n1', 'felt'); toggleResonance('n1', 'kept') // change
    expect(myResonance('n1')).toBe('kept')
  })

  it('your contribution adds to the base tally', () => {
    const before = tallyFor('note-abc')
    toggleResonance('note-abc', 'light')
    const after = tallyFor('note-abc')
    expect((after.light ?? 0)).toBe((before.light ?? 0) + 1)
  })

  it('base tally is deterministic per note', () => {
    expect(baseTally('same-note')).toEqual(baseTally('same-note'))
  })

  it('impact counts sigils once and a voice echo for three', () => {
    const noteId = 'impact-note'
    const sigils = Object.values(tallyFor(noteId)).reduce((a, b) => a + b, 0)
    expect(resonanceScore(noteId, 0)).toBe(sigils)
    expect(resonanceScore(noteId, 2)).toBe(sigils + 6)
  })

  it('top sigils are sorted by count', () => {
    const top = topSigils('busy-note', 3)
    for (let i = 1; i < top.length; i++) expect(top[i - 1].count).toBeGreaterThanOrEqual(top[i].count)
  })
})
