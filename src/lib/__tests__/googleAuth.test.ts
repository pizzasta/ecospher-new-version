import { describe, expect, it } from 'vitest'
import { defaultUsernameFor, googleAuthErrorMessage } from '../googleAuth'

describe('google auth helpers', () => {
  it('builds a valid fallback signal name from a user id', () => {
    const name = defaultUsernameFor('A1B2C3D4-EEEE-4FFF-9999-000011112222')
    expect(name).toBe('signal_a1b2c3')
    expect(name).toMatch(/^[a-z0-9_]{3,24}$/)
  })

  it('maps every known failure mode to a human message', () => {
    expect(googleAuthErrorMessage('not configured')).toMatch(/environment variables/)
    expect(googleAuthErrorMessage('Popup window was blocked')).toMatch(/allow popups/)
    expect(googleAuthErrorMessage('provider is not enabled')).toMatch(/providers → google/)
    expect(googleAuthErrorMessage('identity_already_exists')).toMatch(/another signal/)
    expect(googleAuthErrorMessage('manual_linking_disabled')).toMatch(/identity linking/)
    expect(googleAuthErrorMessage('NetworkError when attempting to fetch')).toMatch(/connection/)
    expect(googleAuthErrorMessage('weird thing')).toMatch(/sign-in failed: weird thing/)
    expect(googleAuthErrorMessage(null)).toMatch(/try again/)
  })
})
