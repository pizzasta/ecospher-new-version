// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { cleanAnswers, localVibeRead, readVibe, validateVibe, vibeOptions } from '../vibeRead'
import fnSource from '../../../supabase/functions/vibe-read/index.ts?raw'

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

describe('vibe-read edge function', () => {
  it('offers the model exactly the options the app accepts', () => {
    const src = fnSource
    const block = src.slice(src.indexOf('const OPTIONS = {'), src.indexOf('} as const'))
    const o = vibeOptions()
    for (const [field, values] of Object.entries(o)) {
      const m = new RegExp(`${field}: \\[([^\\]]*)\\]`).exec(block)
      expect(m, field).not.toBeNull()
      const server = [...m![1].matchAll(/'([^']+)'/g)].map(x => x[1])
      expect(server, field).toEqual([...values])
    }
  })
})
