// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  harmonicMatch, castPing, nightKey, PURITY_WINDOW_CENTS,
  markCast, castCooldownRemaining, CAST_COOLDOWN_MS,
  lockHarmony, listHarmonies, isLocked, audibleHz,
  inboundPing, answerPing, hasAnsweredTonight,
} from '../echolocation'
import type { EchoReturn } from '../echolocation'
import { chimeForHandle, readChime, saveChime, CHIME_STYLES } from '../signatureChime'

const ret = (over: Partial<EchoReturn> = {}): EchoReturn => ({
  handle: 'rainonthecarport', hz: 120, color: '#66ccff', interval: 'a perfect fifth apart',
  purity: 0.9, centsOff: 4, mood: 'nocturne', line: 'the last time i heard rain like this', seed: 17,
  ...over,
})

beforeEach(() => window.localStorage.clear())

describe('harmonicMatch', () => {
  it('hears a perfect fifth', () => {
    const m = harmonicMatch(100, 150)
    expect(m?.interval).toBe('a perfect fifth apart')
    expect(m?.purity).toBe(1)
    expect(m?.centsOff).toBe(0)
  })

  it('hears an octave and does not call it unison', () => {
    expect(harmonicMatch(60, 120)?.interval).toBe('an octave apart')
  })

  it('hears near-unison as unison', () => {
    expect(harmonicMatch(100, 101)?.interval).toBe('in unison')
  })

  it('folds intervals wider than an octave back into range', () => {
    // 100 vs 300 = an octave + a fifth → still reads as a fifth
    expect(harmonicMatch(100, 300)?.interval).toBe('a perfect fifth apart')
  })

  it('is symmetric', () => {
    expect(harmonicMatch(90, 135)?.interval).toBe(harmonicMatch(135, 90)?.interval)
  })

  it('returns null for dissonant pairs — they never hear each other', () => {
    // a tritone-ish ratio sits outside every consonance window
    expect(harmonicMatch(100, 141.4)).toBeNull()
  })

  it('purity fades toward the edge of the window', () => {
    const nearEdgeHz = 150 * Math.pow(2, (PURITY_WINDOW_CENTS - 5) / 1200)
    const m = harmonicMatch(100, nearEdgeHz)
    expect(m).not.toBeNull()
    expect(m!.purity).toBeGreaterThan(0)
    expect(m!.purity).toBeLessThan(0.25)
  })

  it('rejects nonsense frequencies', () => {
    expect(harmonicMatch(0, 100)).toBeNull()
    expect(harmonicMatch(-5, 100)).toBeNull()
  })
})

describe('castPing', () => {
  it('returns at most four, purest first, all genuinely harmonic', () => {
    const out = castPing(96.5)
    expect(out.length).toBeLessThanOrEqual(4)
    for (let i = 1; i < out.length; i++) expect(out[i - 1].purity).toBeGreaterThanOrEqual(out[i].purity)
    for (const r of out) expect(harmonicMatch(96.5, r.hz)).not.toBeNull()
  })

  it('is deterministic within a night — recognition, not a slot machine', () => {
    const now = Date.now()
    const a = castPing(96.5, now).map(r => r.handle)
    const b = castPing(96.5, now).map(r => r.handle)
    expect(a).toEqual(b)
  })
})

describe('nightKey', () => {
  it('keeps 1am on yesterday\'s night', () => {
    const evening = new Date('2026-07-04T23:00:00').getTime()
    const smallHours = new Date('2026-07-05T01:30:00').getTime()
    const nextEvening = new Date('2026-07-05T22:00:00').getTime()
    expect(nightKey(smallHours)).toBe(nightKey(evening))
    expect(nightKey(nextEvening)).not.toBe(nightKey(evening))
  })
})

describe('cast pacing + locked harmonies', () => {
  it('cooldown counts down from a cast and reaches zero', () => {
    const now = Date.now()
    expect(castCooldownRemaining(now)).toBe(0)
    markCast(now)
    expect(castCooldownRemaining(now)).toBe(CAST_COOLDOWN_MS)
    expect(castCooldownRemaining(now + CAST_COOLDOWN_MS + 1)).toBe(0)
  })

  it('locks a harmony once and lists it', () => {
    expect(isLocked('rainonthecarport')).toBe(false)
    lockHarmony(ret())
    lockHarmony(ret()) // double-lock is a no-op
    const kept = listHarmonies()
    expect(kept).toHaveLength(1)
    expect(kept[0].handle).toBe('rainonthecarport')
    expect(isLocked('rainonthecarport')).toBe(true)
  })

  it('locking records a familiar-frequency crossing', () => {
    lockHarmony(ret())
    const familiars = JSON.parse(window.localStorage.getItem('ecosphere:familiarFrequencies') ?? '[]') as Array<{ handle: string }>
    expect(familiars.some(f => f.handle === 'rainonthecarport')).toBe(true)
  })

  it('survives corrupt storage', () => {
    window.localStorage.setItem('ecosphere:echolocation', '{not json')
    expect(listHarmonies()).toEqual([])
    expect(castCooldownRemaining()).toBe(0)
  })
})

describe('audibleHz', () => {
  it('lifts the 20-200 signature band into a clearly audible register', () => {
    expect(audibleHz(20)).toBeGreaterThanOrEqual(80)
    expect(audibleHz(200)).toBeLessThanOrEqual(800)
  })
})

describe('inbound pings + answering', () => {
  const findInboundNight = (hz: number): { now: number; ping: EchoReturn } => {
    // inbound is seeded per night; walk nights until one has a caster
    const base = Date.now()
    for (let d = 0; d < 30; d++) {
      const now = base + d * 86_400_000
      const ping = inboundPing(hz, now)
      if (ping) return { now, ping }
    }
    throw new Error('no inbound ping found in 30 nights — seeding is broken')
  }

  it('is deterministic per night and harmonises with you', () => {
    const { now, ping } = findInboundNight(96.5)
    expect(inboundPing(96.5, now)?.handle).toBe(ping.handle)
    expect(harmonicMatch(96.5, ping.hz)).not.toBeNull()
  })

  it('answering binds mutually and closes the night', () => {
    const { now, ping } = findInboundNight(96.5)
    expect(hasAnsweredTonight(now)).toBe(false)
    answerPing(ping, now)
    expect(hasAnsweredTonight(now)).toBe(true)
    expect(inboundPing(96.5, now)).toBeNull() // one answer a night
    const kept = listHarmonies().find(h => h.handle === ping.handle)
    expect(kept?.mutual).toBe(true)
  })

  it('answering upgrades an existing one-way lock to mutual', () => {
    lockHarmony(ret())
    expect(listHarmonies()[0].mutual).toBeUndefined()
    answerPing(ret())
    expect(listHarmonies()[0].mutual).toBe(true)
    expect(listHarmonies()).toHaveLength(1)
  })
})

describe('signature chime', () => {
  it('persists a valid choice and rejects junk', () => {
    expect(readChime()).toBe('pure')
    saveChime('deep')
    expect(readChime()).toBe('deep')
    window.localStorage.setItem('ecosphere:signatureChime', 'kazoo')
    expect(readChime()).toBe('pure')
  })

  it('gives every carrier a stable chime from the palette', () => {
    const a = chimeForHandle('rainonthecarport')
    expect(a).toBe(chimeForHandle('rainonthecarport'))
    expect(CHIME_STYLES.some(c => c.value === a)).toBe(true)
  })
})
