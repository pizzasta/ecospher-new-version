// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  readPresences, presenceFromEvent, ambientPresences, roomMood, presenceLine,
  LIVE_MS, WINDOW_MS, MAX_PRESENCES,
} from '../presence'

const NOW = 1_700_000_000_000

function seedNotes(notes: Array<{ id: string; type: string; createdAt: number }>) {
  window.localStorage.setItem('ecosphere:localNotifications', JSON.stringify(notes))
}

describe('presenceFromEvent', () => {
  it('is deterministic per id and stays in the frequency band', () => {
    const a = presenceFromEvent('evt-1', 'new_listener', NOW - 1000, NOW)
    const b = presenceFromEvent('evt-1', 'new_listener', NOW - 1000, NOW)
    expect(a).toEqual(b)
    expect(a.hz).toBeGreaterThanOrEqual(20)
    expect(a.hz).toBeLessThanOrEqual(200)
    expect(a.x).toBeGreaterThanOrEqual(0)
    expect(a.x).toBeLessThanOrEqual(100)
  })

  it('tiers by age: live → recent → fading', () => {
    expect(presenceFromEvent('e', 'new_listener', NOW - 1000, NOW).tier).toBe('live')
    expect(presenceFromEvent('e', 'new_listener', NOW - 20 * 60 * 1000, NOW).tier).toBe('recent')
    expect(presenceFromEvent('e', 'new_listener', NOW - 6 * 60 * 60 * 1000, NOW).tier).toBe('fading')
  })

  it('renders the phantom as the void-colored null', () => {
    const p = presenceFromEvent('ph', 'phantom_interaction', NOW - 1000, NOW)
    expect(p.feeling).toBe('null')
    expect(p.verb).toBe('drifted through')
  })
})

describe('readPresences', () => {
  beforeEach(() => window.localStorage.clear())

  it('surfaces only real visitor events inside the window, freshest first', () => {
    seedNotes([
      { id: 'a', type: 'new_listener', createdAt: NOW - 30 * 60 * 1000 },
      { id: 'b', type: 'new_reaction', createdAt: NOW - 1000 },
      { id: 'c', type: 'recap', createdAt: NOW - 2000 }, // system event — excluded
      { id: 'd', type: 'new_listener', createdAt: NOW - 2 * WINDOW_MS }, // too old — excluded
    ])
    const list = readPresences(NOW)
    expect(list.map(p => p.id)).toEqual(['b', 'a'])
    expect(list[0].tier).toBe('live')
  })

  it('caps the room so it never crowds', () => {
    seedNotes(Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, type: 'new_listener', createdAt: NOW - i * 1000 })))
    expect(readPresences(NOW).length).toBe(MAX_PRESENCES)
  })

  it('is empty (not throwing) with no store', () => {
    expect(readPresences(NOW)).toEqual([])
  })
})

describe('ambient + captions', () => {
  it('ambient presences are deterministic per seed and flagged ambient', () => {
    const a = ambientPresences(42, 3)
    expect(a).toEqual(ambientPresences(42, 3))
    expect(a.length).toBe(3)
    expect(a.every(p => p.ambient)).toBe(true)
  })

  it('roomMood reads qualitatively, never as a tally', () => {
    expect(roomMood([])).toMatch(/quiet/)
    const live = presenceFromEvent('x', 'new_reaction', NOW - LIVE_MS / 2, NOW)
    expect(roomMood([live])).toMatch(/here now/)
    const past = presenceFromEvent('y', 'new_listener', NOW - 30 * 60 * 1000, NOW)
    expect(roomMood([past])).toMatch(/lingered|drifted/)
  })

  it('presenceLine whispers the feeling, live-aware', () => {
    const live = presenceFromEvent('x', 'new_reaction', NOW - 1000, NOW)
    expect(presenceLine(live, 'just now')).toMatch(/is here now/)
    const past = presenceFromEvent('y', 'new_listener', NOW - 30 * 60 * 1000, NOW)
    expect(presenceLine(past, '30m ago')).toContain('30m ago')
  })
})
