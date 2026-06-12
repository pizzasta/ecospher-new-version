import { describe, it, expect } from 'vitest'
import { HELP_TOPICS, HELP_FALLBACK, answerLocally, isCrisisQuery } from '../helpBot'

describe('help bot local matcher', () => {
  it('answers FAQ questions with the right topic', () => {
    expect(answerLocally('how do i record a signal?').topicId).toBe('record')
    expect(answerLocally('can people find my real name').topicId).toBe('anonymous')
    expect(answerLocally('how do i delete my account and data').topicId).toBe('delete')
    expect(answerLocally('how do i join a room').topicId).toBe('rooms')
    expect(answerLocally('what are capsules and relics').topicId).toBe('clocks')
    expect(answerLocally('can i just listen without talking').topicId).toBe('lurker')
  })

  it('answers safety-protocol questions', () => {
    expect(answerLocally('how does moderation work here').topicId).toBe('safety')
    expect(answerLocally('how do i report harassment').topicId).toBe('report')
    expect(answerLocally('do kids use this app').topicId).toBe('age')
  })

  it('falls back gracefully on unknown questions', () => {
    const reply = answerLocally('what is the airspeed velocity of an unladen swallow')
    expect(reply.topicId).toBeNull()
    expect(reply.text).toBe(HELP_FALLBACK)
  })

  it('crisis queries always get the crisis answer, beating any keyword score', () => {
    expect(isCrisisQuery('i want to die')).toBe(true)
    expect(isCrisisQuery('how do i delete a recording')).toBe(false)
    const reply = answerLocally('i want to delete my account because i want to die')
    expect(reply.topicId).toBe('crisis')
    expect(reply.text).toContain('988')
    expect(reply.text).toContain('not a crisis service')
  })

  it('every topic answer stays in the human register (no lore words)', () => {
    const banned = /resonance|bloom|orbit\b|cyan/i
    for (const topic of HELP_TOPICS) {
      expect(topic.answer).not.toMatch(banned)
    }
  })

  it('safety topics point at the legal pages', () => {
    expect(HELP_TOPICS.find(t => t.id === 'privacy-data')?.answer).toContain('/privacy.html')
    expect(HELP_TOPICS.find(t => t.id === 'terms')?.answer).toContain('/terms.html')
  })
})
