// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { cleanAnswers, localVibeRead, readVibe, validateVibe, vibeOptions } from '../vibeRead'

describe('vibe read', () => {
  it('reads three taps into a full node, on-device', () => {
    const v = localVibeRead({ hour: '3am', weather: 'rain', need: 'be heard' })
    expect(v).toMatchObject({ mood: 'tender', energy: 'awake', scene3d: 'rain-city', style: 'rain', firstStop: 'open-mic', source: 'local' })
    const o = vibeOptions()
    expect(o.sigil).toContain(v.sigil)
    expect(o.paletteId).toContain(v.paletteId)
    expect(v.reading).toMatch(/3am/)
  })

  it('lets your own words steer the mood', () => {
    expect(localVibeRead({ weather: 'clear sky' }, 'i miss them and the house is empty').mood).toBe('heavy')
  })

  it('is the same answer for the same input', () => {
    expect(localVibeRead({ hour: 'dawn' }, 'x')).toEqual(localVibeRead({ hour: 'dawn' }, 'x'))
  })

  it('drops answers that are not ours', () => {
    expect(cleanAnswers({ hour: '3am', weather: 'tornado' as string })).toEqual({ hour: '3am' })
  })

  it('rejects an AI reply that invents an option or skips the reading', () => {
    const good = { ...localVibeRead({ hour: 'midnight' }), source: undefined }
    expect(validateVibe(good)?.source).toBe('ai')
    expect(validateVibe({ ...good, sigil: 'unicorn' })).toBeNull()
    expect(validateVibe({ ...good, scene3d: 'none' })).toBeNull()
    expect(validateVibe({ ...good, reading: '' })).toBeNull()
  })

  it('falls back on-device when there is no backend', async () => {
    expect((await readVibe({ need: 'disappear' })).source).toBe('local')
  })
})
