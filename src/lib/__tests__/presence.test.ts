// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { othersWhoSat, hasSatWith, sitWith, stillnessCount, stillnessLine, HOLD_MS } from '../stillness'
import { whisperCandidates, currentWhisper } from '../presenceWhispers'
import { lockHarmony } from '../echolocation'
import { carry, ARTIFACTS } from '../deepArchive'
import { relaySignal } from '../relay'

beforeEach(() => window.localStorage.clear())

describe('stillness — presence as the message', () => {
  it('others who sat are seeded, stable, and quiet numbers', () => {
    expect(othersWhoSat('f1')).toBe(othersWhoSat('f1'))
    expect(othersWhoSat('f1')).toBeGreaterThanOrEqual(1)
    expect(othersWhoSat('f1')).toBeLessThanOrEqual(9)
  })

  it('sitting is recorded once, idempotently', () => {
    expect(hasSatWith('f1')).toBe(false)
    sitWith('f1')
    sitWith('f1')
    expect(hasSatWith('f1')).toBe(true)
    expect(stillnessCount()).toBe(1)
  })

  it('the line acknowledges you after you stay', () => {
    expect(stillnessLine('f1')).toMatch(/sat with this/)
    expect(stillnessLine('f1')).not.toContain('you sat')
    sitWith('f1')
    expect(stillnessLine('f1')).toContain('you sat with this')
  })

  it('the hold costs a real breath', () => {
    expect(HOLD_MS).toBeGreaterThanOrEqual(2000)
  })

  it('survives corrupt storage', () => {
    window.localStorage.setItem('ecosphere:stillness', 'not json')
    expect(hasSatWith('f1')).toBe(false)
    expect(() => sitWith('f1')).not.toThrow()
  })
})

describe('presence whispers — the network noticing you back', () => {
  it('whispers something even before you have any history', () => {
    const lines = whisperCandidates()
    expect(lines.length).toBeGreaterThan(0)
    expect(typeof currentWhisper()).toBe('string')
  })

  it('draws from your real traces once they exist', () => {
    lockHarmony({
      handle: 'rainonthecarport', hz: 120, color: '#66ccff', interval: 'a perfect fifth apart',
      purity: 0.9, centsOff: 2, mood: 'nocturne', line: 'the last rain', seed: 3,
    })
    carry(ARTIFACTS[0].id)
    relaySignal('f1', 96.5)
    const lines = whisperCandidates().join(' | ')
    expect(lines).toContain('rainonthecarport')
    expect(lines).toContain(ARTIFACTS[0].name)
    expect(lines).toMatch(/relayed/)
  })

  it('is stable within a minute — a moment whispers one thing', () => {
    const now = Date.now()
    expect(currentWhisper(now)).toBe(currentWhisper(now + 10))
  })
})
