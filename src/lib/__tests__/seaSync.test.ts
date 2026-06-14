// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { seaSyncEnabled, castToSea, fetchSeaLines, subscribeSeaLines } from '../seaSync'

describe('sea sync (backend fan-out, guarded)', () => {
  it('is disabled and degrades cleanly with no backend', async () => {
    expect(seaSyncEnabled).toBe(false)
    await expect(castToSea('still awake tonight again')).resolves.toBe(false)
    await expect(fetchSeaLines()).resolves.toEqual([])
    const unsub = subscribeSeaLines(() => {})
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
  })
})
