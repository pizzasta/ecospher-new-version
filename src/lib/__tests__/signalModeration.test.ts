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
