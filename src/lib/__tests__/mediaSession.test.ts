// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mediaSessionSupported, setNowPlaying, clearNowPlaying } from '../mediaSession'

describe('media session (background playback)', () => {
  it('detects support and no-ops gracefully when absent', () => {
    // jsdom has no navigator.mediaSession
    expect(mediaSessionSupported()).toBe(false)
    // must never throw, even unsupported
    expect(() => setNowPlaying('a signal', () => {})).not.toThrow()
    expect(() => clearNowPlaying()).not.toThrow()
  })

  it('drives a stubbed media session when present', () => {
    const handlers: Record<string, unknown> = {}
    const stub = {
      metadata: null as unknown,
      playbackState: 'none',
      setActionHandler: (a: string, h: unknown) => { handlers[a] = h },
    }
    // @ts-expect-error test stub
    navigator.mediaSession = stub
    // @ts-expect-error minimal MediaMetadata stub
    window.MediaMetadata = class { constructor(public init: unknown) {} }

    let stopped = false
    setNowPlaying('still awake', () => { stopped = true })
    expect(stub.playbackState).toBe('playing')
    ;(handlers.pause as () => void)()
    expect(stopped).toBe(true)

    clearNowPlaying()
    expect(stub.playbackState).toBe('none')
  })
})
