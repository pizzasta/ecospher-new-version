import { describe, it, expect } from 'vitest'
import { mostSaidWords, hasConsensus } from '../voiceWordReactions'

describe('mostSaidWords — the crowd in their own words', () => {
  it('ranks words by how many reactions used them', () => {
    const out = mostSaidWords([
      'this hurts so much',
      'god this hurts',
      'hurts to hear',
      'soft and warm',
    ])
    expect(out[0]).toEqual({ word: 'hurts', count: 3 })
    expect(out.map(w => w.word)).toContain('soft')
  })

  it('strips (stage directions) so laughter/static never counts as words', () => {
    const out = mostSaidWords(['(laughing)', '(four seconds of static)', '(whispered) same'])
    // only the real spoken word "same" survives
    expect(out).toEqual([{ word: 'same', count: 1 }])
  })

  it('drops stopwords and filler', () => {
    const out = mostSaidWords(['i was just really tired', 'so tired honestly'])
    const words = out.map(w => w.word)
    expect(words).toContain('tired')
    expect(words).not.toContain('just')
    expect(words).not.toContain('so')
    expect(words).not.toContain('was')
  })

  it('counts a word once per reaction, not per repetition within it', () => {
    const out = mostSaidWords(['same same same same'])
    expect(out).toEqual([{ word: 'same', count: 1 }])
  })

  it('breaks frequency ties alphabetically for stable ordering', () => {
    const a = mostSaidWords(['zebra apple', 'nothing else here now'])
    const b = mostSaidWords(['apple zebra', 'nothing else here now'])
    expect(a.map(w => w.word)).toEqual(b.map(w => w.word))
    // apple before zebra at equal count
    expect(a.findIndex(w => w.word === 'apple')).toBeLessThan(a.findIndex(w => w.word === 'zebra'))
  })

  it('respects the limit', () => {
    expect(mostSaidWords(['alpha bravo charlie delta echo foxtrot'], 3)).toHaveLength(3)
  })

  it('ignores null / empty / unintelligible captions', () => {
    expect(mostSaidWords([null, undefined, '', '   ', '(static)'])).toEqual([])
  })
})

describe('hasConsensus', () => {
  it('shows once two distinct things are said, or one word repeats', () => {
    expect(hasConsensus(mostSaidWords(['same', 'familiar']))).toBe(true) // two distinct words
    expect(hasConsensus(mostSaidWords(['same', 'same too']))).toBe(true) // one word, two people
    expect(hasConsensus(mostSaidWords(['same']))).toBe(false)            // a stray murmur
    expect(hasConsensus(mostSaidWords([]))).toBe(false)
  })
})
