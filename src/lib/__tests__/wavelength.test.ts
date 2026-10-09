// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { describePeer, joinWavelength, rankMatches, sanitizePeer, wavelengthScore } from '../wavelength'
import type { WaveBus, WaveMeta } from '../wavelength'
import { groupNotifications, groupText, inQuietHours, matchesFilter } from '../notifications'
import type { EcoNotification } from '../notifications'

const base: WaveMeta = { key: 'me', mood: 'tender', energy: 'low', hz: 80, hour: 3, replays: ['lost', 'nocturne'], sigil: '◌', color: '#ff2d78', joinedAt: 1 }
const peer = (over: Partial<WaveMeta>): WaveMeta => ({ ...base, key: Math.random().toString(36), joinedAt: 2, ...over })

describe('wavelength scoring', () => {
  it('scores a near-twin high and says why', () => {
    const { score, reasons } = wavelengthScore(base, peer({ hz: 82 }))
    expect(score).toBeGreaterThanOrEqual(90)
    expect(reasons).toContain('both tender tonight')
  })

  it('scores a stranger in another mood, hour and band low', () => {
    expect(wavelengthScore(base, peer({ mood: 'restless', energy: 'awake', hz: 190, hour: 15, replays: ['bloom'] })).score).toBeLessThan(20)
  })

  it('treats the clock as a circle (11pm and 1am are close)', () => {
    const a = wavelengthScore({ ...base, hour: 23 }, peer({ hour: 1 })).score
    const b = wavelengthScore({ ...base, hour: 23 }, peer({ hour: 11 })).score
    expect(a).toBeGreaterThan(b)
  })

  it('ranks best first, drops weak matches and never matches you with yourself', () => {
    const close = peer({ hz: 81 })
    const far = peer({ mood: 'restless', energy: 'awake', hz: 190, hour: 15, replays: [] })
    const ranked = rankMatches(base, [far, base, close])
    expect(ranked.map(m => m.peer.key)).toEqual([close.key])
  })

  it('describes a peer without anything identifying', () => {
    expect(describePeer(peer({ mood: 'heavy', hour: 3 }))).toBe('someone heavy · 3am')
  })

  it('clamps whatever a peer broadcasts', () => {
    const p = sanitizePeer({ key: 'x', mood: 'tender', hz: 9999, hour: 99, replays: [1, 'a', 'b', 'c', 'd'], sigil: '<script>', color: 'red', joinedAt: 5 })
    expect(p).toMatchObject({ hz: 200, hour: 23, replays: ['a', 'b', 'c'], color: '#8a93ad', sigil: '<s' })
    expect(sanitizePeer({ key: 'x' })).toBeNull()
  })
})

describe('waves', () => {
  function pair() {
    const listeners: Array<(e: 'wave' | 'tune', p: { to: string; from: WaveMeta }) => void> = []
    const bus = (): WaveBus => ({
      send: (e, p) => listeners.forEach(l => l(e, p)),
      onMessage: cb => { listeners.push(cb) },
      onPeers: () => {},
      close: () => {},
    })
    return bus
  }

  it('only the addressed person hears a wave, and repeats are rate-limited', () => {
    const mk = pair()
    const heardB: string[] = []
    const heardC: string[] = []
    const a = joinWavelength(base, { onPeers: () => {}, onEvent: () => {} }, mk())!
    const b = peer({ key: 'b' })
    joinWavelength(b, { onPeers: () => {}, onEvent: e => heardB.push(e.kind) }, mk())
    joinWavelength(peer({ key: 'c' }), { onPeers: () => {}, onEvent: e => heardC.push(e.kind) }, mk())
    expect(a.wave(b)).toBe(true)
    expect(a.wave(b)).toBe(false)
    expect(a.tune(b)).toBe(true)
    expect(heardB).toEqual(['wave', 'tune'])
    expect(heardC).toEqual([])
  })
})

describe('inbox grouping', () => {
  const n = (id: string, type: EcoNotification['type'], minutesAgo: number, read = false): EcoNotification =>
    ({ id, type, text: type, read, createdAt: 1_000_000_000 - minutesAgo * 60_000, remote: false })

  it('collapses a burst of reactions into one line, keeps waves separate', () => {
    const groups = groupNotifications([
      n('1', 'new_reaction', 1), n('2', 'new_reaction', 5), n('3', 'new_reaction', 20, true),
      n('4', 'wave', 30), n('5', 'wave', 31),
    ])
    expect(groups).toHaveLength(3)
    expect(groupText(groups[0])).toBe('3 people resonated with your signal')
    expect(groups[0].unread).toBe(2)
  })

  it('filters wavelength events from your own signal activity', () => {
    expect(matchesFilter(n('1', 'wave', 1), 'wavelength')).toBe(true)
    expect(matchesFilter(n('1', 'wave', 1), 'you')).toBe(false)
    expect(matchesFilter(n('1', 'new_listener', 1), 'you')).toBe(true)
  })

  it('quiet hours wrap past midnight', () => {
    const q = { on: true, from: 23, to: 7 }
    expect(inQuietHours(q, 2)).toBe(true)
    expect(inQuietHours(q, 12)).toBe(false)
    expect(inQuietHours({ ...q, on: false }, 2)).toBe(false)
  })
})
