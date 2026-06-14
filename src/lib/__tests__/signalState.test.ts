import { describe, it, expect } from 'vitest'
import { resolveSignalState, isAudible, SIGNAL_GLYPH, SIGNAL_LABEL } from '../signalState'

describe('signal state (mute as signal strength)', () => {
  it('only "live" is audible', () => {
    expect(isAudible('live')).toBe(true)
    for (const s of ['held-dark', 'drifting', 'dropped', 'cleared', 'hushed', 'unsettled'] as const) {
      expect(isAudible(s)).toBe(false)
    }
  })

  it('resolves the carrier states', () => {
    expect(resolveSignalState({ isCarrier: true, muted: false })).toBe('live')
    expect(resolveSignalState({ isCarrier: true, muted: true })).toBe('held-dark')
    expect(resolveSignalState({ isCarrier: false })).toBe('drifting')
  })

  it('faults and room-wide states win, resolving toward silence (fail-closed)', () => {
    // even a live carrier resolves to silence under a fault or hush
    expect(resolveSignalState({ isCarrier: true, muted: false, unsettled: true })).toBe('unsettled')
    expect(resolveSignalState({ isCarrier: true, muted: false, hushed: true })).toBe('hushed')
    expect(resolveSignalState({ isCarrier: true, muted: false, cleared: true })).toBe('cleared')
    expect(resolveSignalState({ isCarrier: true, muted: false, dropped: true })).toBe('dropped')
  })

  it('has a glyph and label for every state', () => {
    for (const s of ['live', 'held-dark', 'drifting', 'dropped', 'cleared', 'hushed', 'unsettled'] as const) {
      expect(SIGNAL_GLYPH[s]).toBeTruthy()
      expect(SIGNAL_LABEL[s]).toBeTruthy()
    }
  })
})
