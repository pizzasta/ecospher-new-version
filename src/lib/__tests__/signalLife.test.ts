// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { DECAY_LABELS, decayLevel, decayText, heatFor, listPreserved, preserveSignal, presenceLine, whyFoundYou } from '../signalLife'

describe('signal life', () => {
  beforeEach(() => window.localStorage.clear())

  it('decay is deterministic per signal per day and spans all levels', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `sig-${i}`)
    const levels = new Set(ids.map(id => decayLevel(id)))
    expect(levels.size).toBeGreaterThan(2)
    expect(decayLevel('sig-1')).toBe(decayLevel('sig-1'))
  })

  it('preserving a signal restores it to intact', () => {
    const decayed = Array.from({ length: 60 }, (_, i) => `x-${i}`).find(id => decayLevel(id) > 0)!
    preserveSignal(decayed)
    expect(decayLevel(decayed)).toBe(0)
    expect(listPreserved()).toContain(decayed)
  })

  it('fragmenting drops words but never the whole sentence', () => {
    const text = 'the quiet feels different tonight like something is about to remember itself'
    const broken = decayText(text, 3, 'sig-frag')
    expect(broken).toContain('░░')
    expect(broken.split(' ').length).toBe(text.split(' ').length)
    expect(decayText(text, 1, 'sig-frag')).toBe(text)
  })

  it('heat lines stay human and decay labels are emotional, not stressful', () => {
    const lines = Array.from({ length: 40 }, (_, i) => heatFor(`h-${i}`).line).filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(line).not.toMatch(/score|algorithm|trending|engagement/i)
    expect(DECAY_LABELS[3]).toMatch(/preserve/)
  })

  it('why-lines avoid recommendation language', () => {
    for (let i = 0; i < 20; i++) {
      const why = whyFoundYou(`w-${i}`)
      expect(why).not.toMatch(/recommended|because you (liked|watched)|for you|algorithm|based on your/i)
      expect(why.length).toBeLessThan(60)
    }
  })

  it('presence lines are ambient humans, never social-media mechanics', () => {
    for (let i = 0; i < 12; i++) {
      const line = presenceLine(`p-${i}`)
      expect(line).not.toMatch(/follow|like|friend|subscriber/i)
    }
  })
})
