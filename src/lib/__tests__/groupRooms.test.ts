// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { createCustomTopic, addLineToCustom, loadCustomTopics, isCustomTopic } from '../groupTalk'
import { fetchGroupVoices, dropGroupVoice, groupRoomsEnabled } from '../groupRooms'

describe('custom groups', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('rejects an empty name or too-short first line', () => {
    expect('error' in createCustomTopic('', 'a real first line here')).toBe(true)
    expect('error' in createCustomTopic('moving home', 'too short')).toBe(true)
  })

  it('creates and persists a custom topic from a title and first line', () => {
    const result = createCustomTopic('moving back home', 'i moved back in with my parents this week')
    expect('topic' in result).toBe(true)
    if ('topic' in result) {
      expect(isCustomTopic(result.topic.id)).toBe(true)
      expect(result.topic.turns).toHaveLength(1)
      expect(loadCustomTopics().some(t => t.id === result.topic.id)).toBe(true)
    }
  })

  it('adds lines with cycling speakers', () => {
    const created = createCustomTopic('the night shift', 'nobody talks about working while the city sleeps')
    if (!('topic' in created)) throw new Error('setup failed')
    const updated = addLineToCustom(created.topic.id, 'i kind of love the quiet of it honestly')
    expect(updated).not.toBeNull()
    expect(updated?.turns).toHaveLength(2)
    expect(updated?.turns[1].who).toBe(1)
  })
})

describe('real group rooms (backend off in tests)', () => {
  it('is disabled and returns no voices without a configured backend', async () => {
    expect(groupRoomsEnabled).toBe(false)
    await expect(fetchGroupVoices('cant-sleep')).resolves.toEqual([])
  })

  it('refuses a drop cleanly when the backend is off', async () => {
    const res = await dropGroupVoice('cant-sleep', new Blob(['x']), 5, 'just checking in tonight')
    expect(res.ok).toBe(false)
  })
})
