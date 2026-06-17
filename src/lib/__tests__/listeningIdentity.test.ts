import { describe, expect, it } from 'vitest'
import { deriveAtmosphere, deriveTraits, humanizeActivity, memoryLines, tonightLines } from '../listeningIdentity'
import type { IdentityInput } from '../listeningIdentity'

const NOW = new Date(2026, 5, 11, 2, 0).getTime() // 2am

function iso(hoursAgo: number): string {
  return new Date(NOW - hoursAgo * 60 * 60 * 1000).toISOString()
}

const quiet: IdentityInput = {
  interactions: [],
  listens: [],
  savedCount: 0,
  recordingsCount: 0,
  silentDays: null,
  streak: 0,
}

describe('atmosphere', () => {
  it('detects a replay loop when one signal repeats tonight', () => {
    const input = { ...quiet, listens: [iso(1), iso(2), iso(3)].map(playedAt => ({ label: 'the same one', playedAt })) }
    expect(deriveAtmosphere(input, NOW)).toBe('replay loop detected')
  })

  it('goes low signal after days of silence', () => {
    expect(deriveAtmosphere({ ...quiet, silentDays: 4 }, NOW)).toBe('low signal')
  })

  it('lingers at night with no activity, quiet otherwise', () => {
    expect(deriveAtmosphere(quiet, NOW)).toBe('lingering')
    const day = new Date(2026, 5, 11, 14, 0).getTime()
    expect(deriveAtmosphere(quiet, day)).toBe('quiet tonight')
  })
})

describe('traits', () => {
  it('reads active hours and replay habits from real listens', () => {
    const input: IdentityInput = {
      ...quiet,
      listens: [
        { label: 'a', playedAt: iso(0.2) }, { label: 'a', playedAt: iso(0.5) },
        { label: 'b', playedAt: iso(1) }, { label: 'b', playedAt: iso(25) },
      ],
      interactions: [{ type: 'page_visit', label: 'entered zones', page: 'zones', createdAt: iso(1) }],
    }
    const traits = deriveTraits(input, NOW)
    expect(traits).toContain('most active between 1am and 4am')
    expect(traits).toContain('lingers in dead zones')
    expect(traits).toContain('replays the same fragments instead of finding new ones')
  })

  it('says nothing it cannot back up', () => {
    expect(deriveTraits(quiet, NOW)).toEqual([])
  })
})

describe('tonight + memory', () => {
  it('counts resurfaced signals and remembers returns', () => {
    const input = { ...quiet, listens: [{ label: 'x', playedAt: iso(1) }, { label: 'x', playedAt: iso(2) }] }
    expect(tonightLines(input, NOW)[0]).toBe('2 signals resurfaced tonight')
    expect(memoryLines(input, NOW)).toContain('you came back to the same signal again tonight')
  })

  it('notices room avoidance', () => {
    const interactions = Array.from({ length: 7 }, (_, i) => ({ type: 'page_visit', label: 'entered zones', page: 'zones', createdAt: iso(i) }))
    expect(memoryLines({ ...quiet, interactions }, NOW)).toContain('you avoid crowded rooms')
  })

  it('always has something gentle to say', () => {
    expect(tonightLines(quiet, NOW).length).toBeGreaterThan(0)
  })
})

describe('humanized activity', () => {
  it('collapses repeated plays into a count', () => {
    const interactions = [
      { type: 'signal_play', label: 'played the unsent one', createdAt: iso(0.1) },
      { type: 'signal_play', label: 'played the unsent one', createdAt: iso(0.2) },
      { type: 'signal_play', label: 'played the unsent one', createdAt: iso(0.3) },
      { type: 'page_visit', label: 'entered frequencies', page: 'frequencies', createdAt: iso(0.4) },
    ]
    const out = humanizeActivity(interactions)
    expect(out[0].text).toBe('replayed the unsent one 3 times')
    expect(out[1].text).toBe('floated the frequency sea for a while')
  })

  it('never outputs the raw "entered X" register', () => {
    const interactions = ['rooms', 'zones', 'unsent', 'relics'].map((page, i) => ({
      type: 'page_visit', label: `entered ${page}`, page, createdAt: iso(i),
    }))
    for (const activity of humanizeActivity(interactions)) {
      expect(activity.text).not.toMatch(/^entered /)
    }
  })

  // regression: old persisted interactions could be malformed (missing/non-string
  // label or type) and threw `it.label.replace` on first render, trapping the
  // user on the error boundary. humanizeActivity must skip them, never throw.
  it('survives malformed/old persisted interactions without throwing', () => {
    const malformed = [
      { type: 'signal_play', createdAt: iso(0.1) },            // missing label
      { type: 'room_enter', label: 42, createdAt: iso(0.2) },  // non-string label
      null,                                                    // not an object
      'corrupt',                                               // primitive
      { label: 'no type here', createdAt: iso(0.3) },          // missing type
      { type: 'page_visit', label: 'entered relics', page: 'relics', createdAt: iso(0.4) },
    ] as unknown as Parameters<typeof humanizeActivity>[0]
    const out = humanizeActivity(malformed)
    // only the one well-formed entry survives
    expect(out).toHaveLength(1)
    expect(out[0].text).not.toMatch(/^entered /)
  })
})

describe('one thing tonight', () => {
  const base = { recapAvailable: false, silentDays: null, topReturn: null, personalCapsules: 1, dropLive: false }

  it('prioritizes the recap, then silence, then returns', async () => {
    const { pickTonightAction } = await import('../listeningIdentity')
    expect(pickTonightAction({ ...base, recapAvailable: true, silentDays: 5 })).toBe('recap')
    expect(pickTonightAction({ ...base, silentDays: 3, topReturn: 'x' })).toBe('silence')
    expect(pickTonightAction({ ...base, topReturn: 'x' })).toBe('return')
  })

  it('falls through seal and drop to drifting', async () => {
    const { pickTonightAction } = await import('../listeningIdentity')
    expect(pickTonightAction({ ...base, personalCapsules: 0 })).toBe('seal')
    expect(pickTonightAction({ ...base, dropLive: true })).toBe('drop')
    expect(pickTonightAction(base)).toBe('drift')
  })
})
