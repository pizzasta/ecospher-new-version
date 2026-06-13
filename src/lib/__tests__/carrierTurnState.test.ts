import { describe, it, expect } from 'vitest'
import { createRoomState, reduceRoom } from '../carrierTurnState'

describe('carrier turn-state reducer (keeper authority)', () => {
  it('queue: an open carrier is taken immediately, the rest line up', () => {
    let s = createRoomState('queue')
    s = reduceRoom(s, { type: 'request', key: 'a' })
    expect(s.carrier).toBe('a')
    s = reduceRoom(s, { type: 'request', key: 'b' })
    s = reduceRoom(s, { type: 'request', key: 'c' })
    expect(s.queue).toEqual(['b', 'c'])
  })

  it('advance promotes the front of the queue', () => {
    let s = createRoomState('queue')
    for (const k of ['a', 'b', 'c']) s = reduceRoom(s, { type: 'request', key: k })
    s = reduceRoom(s, { type: 'advance' }) // a's turn ends
    expect(s.carrier).toBe('b')
    expect(s.queue).toEqual(['c'])
  })

  it('keeper-led never auto-takes; grant promotes a queued key', () => {
    let s = createRoomState('keeper-led')
    s = reduceRoom(s, { type: 'request', key: 'a' })
    expect(s.carrier).toBeNull()
    expect(s.queue).toEqual(['a'])
    s = reduceRoom(s, { type: 'grant', key: 'a' })
    expect(s.carrier).toBe('a')
    expect(s.queue).toEqual([])
  })

  it('open-drift allows two carriers, then queues', () => {
    let s = createRoomState('open-drift')
    s = reduceRoom(s, { type: 'request', key: 'a' })
    s = reduceRoom(s, { type: 'request', key: 'b' })
    s = reduceRoom(s, { type: 'request', key: 'c' })
    expect(s.carrier).toBe('a')
    expect(s.second).toBe('b')
    expect(s.queue).toEqual(['c'])
  })

  it('yield and leave free the carrier and promote', () => {
    let s = createRoomState('queue')
    for (const k of ['a', 'b']) s = reduceRoom(s, { type: 'request', key: k })
    s = reduceRoom(s, { type: 'yield', key: 'a' })
    expect(s.carrier).toBe('b')
    s = reduceRoom(s, { type: 'leave', key: 'b' })
    expect(s.carrier).toBeNull()
  })

  it('clear drops the current carrier(s) and hush/mode behave', () => {
    let s = createRoomState('open-drift')
    s = reduceRoom(s, { type: 'request', key: 'a' })
    s = reduceRoom(s, { type: 'request', key: 'b' })
    s = reduceRoom(s, { type: 'clear' })
    expect(s.carrier).toBeNull()
    expect(s.second).toBeNull()
    s = reduceRoom(s, { type: 'hush', on: true })
    expect(s.hushed).toBe(true)
    s = reduceRoom(s, { type: 'mode', mode: 'listen-only' })
    expect(s.mode).toBe('listen-only')
    expect(s.carrier).toBeNull()
  })

  it('listen-only ignores requests', () => {
    let s = createRoomState('listen-only')
    s = reduceRoom(s, { type: 'request', key: 'a' })
    expect(s.carrier).toBeNull()
    expect(s.queue).toEqual([])
  })
})
