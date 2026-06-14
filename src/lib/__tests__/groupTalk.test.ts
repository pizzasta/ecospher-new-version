import { describe, it, expect } from 'vitest'
import { GROUP_TOPICS, orderedTurns, voiceSeedFor } from '../groupTalk'

describe('group conversations', () => {
  it('every topic has a short title, teaser, and several turns', () => {
    expect(GROUP_TOPICS.length).toBeGreaterThanOrEqual(6)
    for (const topic of GROUP_TOPICS) {
      expect(topic.title.length).toBeGreaterThan(0)
      expect(topic.teaser.length).toBeGreaterThan(0)
      expect(topic.turns.length).toBeGreaterThanOrEqual(4)
      for (const turn of topic.turns) {
        expect(turn.who).toBeGreaterThanOrEqual(0)
        expect(turn.who).toBeLessThanOrEqual(3)
        expect(turn.line.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('gives each speaker a distinct, stable voice seed within a topic', () => {
    const topic = GROUP_TOPICS[0]
    const a = voiceSeedFor(topic, 0)
    const b = voiceSeedFor(topic, 1)
    expect(a).not.toBe(b)
    expect(voiceSeedFor(topic, 0)).toBe(a) // stable
  })

  it('rotates the turn order by day but keeps all turns', () => {
    const topic = GROUP_TOPICS[0]
    const day1 = orderedTurns(topic, 0)
    const day2 = orderedTurns(topic, 86400000 * 3)
    expect(day1).toHaveLength(topic.turns.length)
    expect(day2).toHaveLength(topic.turns.length)
    expect(new Set(day1.map(t => t.line))).toEqual(new Set(topic.turns.map(t => t.line)))
  })
})
