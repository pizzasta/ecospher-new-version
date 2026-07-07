import { describe, it, expect } from 'vitest'
import {
  makeParticipants, simCarrierIndex, carrierTurn, carrierRemaining, clock,
  FLOW_MODES, ringIndex, roundRobinIsYou, HOLD_MS,
  priorityOrder, priorityCarrier, resonanceFor, YOU_ID,
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

  it('offers the six flow modes', () => {
    expect(FLOW_MODES.map(f => f.value)).toEqual(['queue', 'auto-priority', 'round-robin', 'keeper-led', 'open-drift', 'listen-only'])
  })

  it('round-robin ring includes a "you" slot at the end and wraps to you once per cycle', () => {
    // 6 participants + you = ring of 7; index 6 is you
    expect(ringIndex(0, 6)).toBe(0)
    expect(roundRobinIsYou(HOLD_MS * 6, 6)).toBe(true)   // 7th slot is yours
    expect(roundRobinIsYou(HOLD_MS * 7, 6)).toBe(false)  // wraps back to a participant
    let yours = 0
    for (let t = 0; t < 7; t++) if (roundRobinIsYou(HOLD_MS * t, 6)) yours++
    expect(yours).toBe(1) // exactly one turn per cycle
  })
})

describe('auto priority', () => {
  const parts = makeParticipants(7, 6)
  const you = { sigil: '◉', color: '#9ae8ff' }

  it('lifts the highest score and is deterministic', () => {
    const a = priorityOrder(parts, 10, 10, {}, 7, you)
    const b = priorityOrder(parts, 10, 10, {}, 7, you)
    expect(a.map(e => e.id)).toEqual(b.map(e => e.id))
    expect(a[0].score).toBeGreaterThanOrEqual(a[a.length - 1].score)
  })

  it('includes you in the ranking', () => {
    const order = priorityOrder(parts, 10, 10, {}, 7, you)
    expect(order.some(e => e.isYou)).toBe(true)
    expect(order).toHaveLength(parts.length + 1)
  })

  it('never starves anyone: everybody holds the carrier within two rounds', () => {
    const lastHeld: Record<string, number> = {}
    const held = new Set<string>()
    const first = 100
    for (let turn = first; turn < first + (parts.length + 1) * 2; turn++) {
      const head = priorityCarrier(parts, turn, first, lastHeld, 7, you)
      lastHeld[head.id] = turn
      held.add(head.id)
    }
    expect(held.size).toBe(parts.length + 1)
  })

  it('waiting dominates resonance — the longest-unheard wins', () => {
    const lastHeld: Record<string, number> = {}
    parts.forEach((p, i) => { lastHeld[p.id] = 100 + i })
    lastHeld[YOU_ID] = 100 + parts.length
    // the one who spoke longest ago (parts[0]) outranks everyone
    const head = priorityCarrier(parts, 120, 100, lastHeld, 7, you)
    expect(head.id).toBe(parts[0].id)
  })

  it('resonance is stable per (listener, room)', () => {
    expect(resonanceFor('c7-0', 7)).toBe(resonanceFor('c7-0', 7))
    expect(resonanceFor('c7-0', 7)).toBeGreaterThanOrEqual(0)
    expect(resonanceFor('c7-0', 7)).toBeLessThanOrEqual(9)
  })
})
