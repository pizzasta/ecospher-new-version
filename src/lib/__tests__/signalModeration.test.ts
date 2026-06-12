import { describe, expect, it } from 'vitest'
import { moderatePublicSignalText } from '../signalModeration'

describe('automated signal moderation', () => {
  it('passes ordinary late-night text', () => {
    const result = moderatePublicSignalText('still awake. the quiet feels different tonight.')
    expect(result.status).toBe('passed')
    expect(result.flags).toHaveLength(0)
    expect(result.warning).toBeNull()
  })

  it('flags threatening language', () => {
    const result = moderatePublicSignalText('i will hurt you')
    expect(result.status).toBe('flagged')
    expect(result.flags).toContain('threats')
    expect(result.warning).toBeTruthy()
  })

  it('flags personal information like phone numbers and emails', () => {
    expect(moderatePublicSignalText('call me at 555-123-4567').flags).toContain('explicit_personal_information')
    expect(moderatePublicSignalText('write to someone@example.com').flags).toContain('explicit_personal_information')
  })

  it('flags promotional spam', () => {
    const result = moderatePublicSignalText('buy now at https://example.com promo code SAVE20')
    expect(result.status).toBe('flagged')
    expect(result.flags).toContain('spam')
  })

  it('flags unsafe content and produces a warning', () => {
    const result = moderatePublicSignalText('thinking about self harm again')
    expect(result.status).toBe('flagged')
    expect(result.flags).toContain('unsafe_content')
    expect(result.warning).toBeTruthy()
  })
})

describe('child safety screening', () => {
  it('flags age solicitation and asl', () => {
    expect(moderatePublicSignalText('hey how old are you').flags).toContain('child_safety')
    expect(moderatePublicSignalText('asl').flags).toContain('child_safety')
  })

  it('flags off-platform contact pulls', () => {
    expect(moderatePublicSignalText('add me on snapchat').flags).toContain('child_safety')
    expect(moderatePublicSignalText('dm me on instagram').flags).toContain('child_safety')
    expect(moderatePublicSignalText('whats your kik? message me').flags).toContain('child_safety')
  })

  it('flags photo requests and meet-up pressure', () => {
    expect(moderatePublicSignalText('send me a pic').flags).toContain('child_safety')
    expect(moderatePublicSignalText('where do you live? we should meet up').flags).toContain('child_safety')
  })

  it('flags and shields minor self-identification', () => {
    const result = moderatePublicSignalText("im 14 btw")
    expect(result.flags).toContain('child_safety')
    expect(result.status).toBe('flagged')
    expect(result.warning).toMatch(/no private contact/)
  })

  it('does not flag ordinary late-night talk', () => {
    expect(moderatePublicSignalText('i met up with my own thoughts again tonight').status).toBe('passed')
    expect(moderatePublicSignalText('the photo on my fridge is crooked').status).toBe('passed')
  })
})

describe('sexual content screening', () => {
  it('flags explicit solicitation and content', () => {
    expect(moderatePublicSignalText('send nudes').flags).toContain('sexual_content')
    expect(moderatePublicSignalText('anyone wanna sext').flags).toContain('sexual_content')
    expect(moderatePublicSignalText('so horny tonight').flags).toContain('sexual_content')
    expect(moderatePublicSignalText('check out my onlyfans').flags).toContain('sexual_content')
  })

  it('blocks public visibility with a clear warning', () => {
    const result = moderatePublicSignalText('send me something sexy')
    expect(result.status).toBe('flagged')
    expect(result.warning).toMatch(/that kind of frequency/)
  })

  it('does not flag late-night expletives or innocent phrasing', () => {
    expect(moderatePublicSignalText('fuck this whole week honestly').status).toBe('passed')
    expect(moderatePublicSignalText('the naked truth is i miss them').status).toBe('passed')
    expect(moderatePublicSignalText('my cat knocked the cup off again').status).toBe('passed')
  })
})
