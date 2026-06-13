import { describe, it, expect } from 'vitest'
import { dormantRooms, quietFor } from '../dormantRooms'

describe('dormant rooms (Dead Zones for Rooms)', () => {
  it('lists dormant frequencies with a last-spoken trace', () => {
    const rooms = dormantRooms(1_000 * 86400000)
    expect(rooms.length).toBeGreaterThanOrEqual(4)
    for (const r of rooms) {
      expect(r.hz).toMatch(/^\d/)
      expect(r.lastSigil).toBeTruthy()
      expect(r.lastColor).toMatch(/^#/)
      expect(r.quietMins).toBeGreaterThan(0)
    }
  })

  it('is deterministic per day', () => {
    expect(dormantRooms(1_000 * 86400000)).toEqual(dormantRooms(1_000 * 86400000))
  })

  it('formats quiet duration', () => {
    expect(quietFor(18)).toBe('quiet for 18m')
    expect(quietFor(60)).toBe('quiet for 1h')
    expect(quietFor(134)).toBe('quiet for 2h 14m')
  })
})
