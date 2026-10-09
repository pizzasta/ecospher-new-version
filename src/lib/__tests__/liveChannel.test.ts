// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createLiveState, reduceLive, electKeeper, turnExpired, liveVoiceMode,
  LIVE_TURN_CAP_MS,
} from '../liveChannel'

const T0 = 1_700_000_000_000

describe('live channel turn-state', () => {
  it('one voice holds the mic; the next request waits in line', () => {
    let s = createLiveState()
    s = reduceLive(s, { type: 'request', key: 'a' }, T0)
    s = reduceLive(s, { type: 'request', key: 'b' }, T0)
    expect(s.room.carrier).toBe('a')
    expect(s.room.queue).toEqual(['b'])
    expect(s.turnStartedAt).toBe(T0)
  })

  it('passing the mic hands it to the next in line and restarts the clock', () => {
    let s = createLiveState()
    s = reduceLive(s, { type: 'request', key: 'a' }, T0)
    s = reduceLive(s, { type: 'request', key: 'b' }, T0)
    s = reduceLive(s, { type: 'yield', key: 'a' }, T0 + 5000)
    expect(s.room.carrier).toBe('b')
    expect(s.turnStartedAt).toBe(T0 + 5000)
  })

  it('the turn cap expires a long turn', () => {
    let s = createLiveState()
    s = reduceLive(s, { type: 'request', key: 'a' }, T0)
    expect(turnExpired(s, T0 + LIVE_TURN_CAP_MS - 1)).toBe(false)
    expect(turnExpired(s, T0 + LIVE_TURN_CAP_MS)).toBe(true)
  })

  it('removing someone drops them from the mic and blocks them from asking again', () => {
    let s = createLiveState()
    s = reduceLive(s, { type: 'request', key: 'a' }, T0)
    s = reduceLive(s, { type: 'request', key: 'b' }, T0)
    s = reduceLive(s, { type: 'remove', key: 'a' }, T0 + 1000)
    expect(s.removed).toContain('a')
    expect(s.room.carrier).toBe('b')
    const again = reduceLive(s, { type: 'request', key: 'a' }, T0 + 2000)
    expect(again.room.queue).not.toContain('a')
    expect(again).toBe(s)
  })

  it('every change bumps the revision; no-ops do not', () => {
    const s0 = createLiveState()
    const s1 = reduceLive(s0, { type: 'request', key: 'a' }, T0)
    expect(s1.rev).toBe(1)
    expect(reduceLive(s1, { type: 'request', key: 'a' }, T0)).toBe(s1)
  })
})

describe('keeper election', () => {
  it('is whoever joined first, ties broken by key, same answer on every client', () => {
    const peers = [
      { key: 'v_b', sigil: '◌', color: '#fff', joinedAt: 20 },
      { key: 'v_c', sigil: '◌', color: '#fff', joinedAt: 10 },
      { key: 'v_a', sigil: '◌', color: '#fff', joinedAt: 10 },
    ]
    expect(electKeeper(peers)).toBe('v_a')
    expect(electKeeper([...peers].reverse())).toBe('v_a')
    expect(electKeeper([])).toBeNull()
  })
})

describe('beta flag', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('is off when there is no backend to carry it', () => {
    expect(liveVoiceMode()).toBe('off')
  })

  it('?livevoice=local switches to the same-browser test bus and ?livevoice=0 turns it off', () => {
    window.history.replaceState(null, '', '/rooms?livevoice=local')
    expect(liveVoiceMode()).toBe('local')
    window.history.replaceState(null, '', '/rooms')
    expect(liveVoiceMode()).toBe('local')
    window.history.replaceState(null, '', '/rooms?livevoice=0')
    expect(liveVoiceMode()).toBe('off')
    window.history.replaceState(null, '', '/rooms?livevoice=1')
    expect(liveVoiceMode()).toBe('off') // override cleared → default (no backend in tests)
  })
})
