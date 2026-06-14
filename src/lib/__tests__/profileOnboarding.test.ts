// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { shouldAutoOnboard, profileOnboarded, markProfileOnboarded } from '../../components/ProfileOnboarding'

describe('onboarding gate', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('auto-opens for a genuinely new, blank device', () => {
    expect(shouldAutoOnboard()).toBe(true)
  })

  it('never re-opens once completed', () => {
    markProfileOnboarded()
    expect(shouldAutoOnboard()).toBe(false)
  })

  it('suppresses for an established user (prior activity) and marks them onboarded', () => {
    window.localStorage.setItem('ecosphere:tapeIntro', JSON.stringify({ id: 'x', durationMs: 9000 }))
    expect(profileOnboarded()).toBe(false)
    expect(shouldAutoOnboard()).toBe(false)
    // marked silently so the check short-circuits next time
    expect(profileOnboarded()).toBe(true)
  })

  it('ignores empty/default activity values', () => {
    window.localStorage.setItem('ecosphere:preservedSignals', '[]')
    window.localStorage.setItem('ecosphere:podPulses', '0')
    expect(shouldAutoOnboard()).toBe(true)
  })
})
