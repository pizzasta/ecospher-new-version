import { describe, expect, it } from 'vitest'
import { SCREEN_PATHS, screenForPath } from '../routes'

describe('screen routing', () => {
  it('maps every screen path back to its screen', () => {
    for (const [screen, path] of Object.entries(SCREEN_PATHS)) {
      expect(screenForPath(path)).toBe(screen)
    }
  })

  it('normalizes trailing slashes and case', () => {
    expect(screenForPath('/rooms/')).toBe('rooms')
    expect(screenForPath('/ROOMS')).toBe('rooms')
    expect(screenForPath('//capsules//')).toBe('capsules')
  })

  it('lands unknown paths on home', () => {
    expect(screenForPath('/')).toBe('home')
    expect(screenForPath('')).toBe('home')
    expect(screenForPath('/nonexistent')).toBe('home')
    expect(screenForPath('/rooms/temporal')).toBe('home')
  })
})
