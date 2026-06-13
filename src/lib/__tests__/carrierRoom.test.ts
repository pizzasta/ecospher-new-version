import { describe, it, expect } from 'vitest'
import {
  makeParticipants, simCarrierIndex, carrierTurn, carrierRemaining, clock, HOLD_MS,
} from '../carrierRoom'

describe('carrier room — one frequency, one carrier', () => {
  it('makes anonymous, deterministic participants (sigils + colors only)', () => {
    const a = makeParticipants(7, 6)
    const b = makeParticipants(7, 6)
    expect(a).toHaveLength(6)
    expect(a).toEqual(b)
    for (const p of a) {
      expect(p.sigil).toBeTruthy()
      expect(p.color).toMatch(/^#/)
      expect(p).not.toHaveProperty('name')
    }
  })

  it('rotates the carrier deterministically and wraps', () => {
    expect(simCarrierIndex(0, 6)).toBe(0)
    expect(simCarrierIndex(HOLD_MS, 6)).toBe(1)
    expect(simCarrierIndex(HOLD_MS * 6, 6)).toBe(0)
  })

  it('advances the turn number each hand-off', () => {
    expect(carrierTurn(HOLD_MS * 3 + 5)).toBe(3)
    expect(carrierTurn(HOLD_MS * 3 + 5)).toBeGreaterThan(carrierTurn(HOLD_MS * 2 + 5))
  })

  it('reports the time left in a turn', () => {
    expect(carrierRemaining(0)).toBe(HOLD_MS)
    expect(carrierRemaining(HOLD_MS - 1000)).toBe(1000)
  })

  it('formats a clock', () => {
    expect(clock(38000)).toBe('0:38')
    expect(clock(90000)).toBe('1:30')
  })
})
