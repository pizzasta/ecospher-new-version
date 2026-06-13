// Lock-screen / background playback via the Media Session API, so a signal
// keeps playing (and shows controls) when the screen is off — the whole point
// of a late-night, eyes-closed listen. Fully guarded: a no-op where it isn't
// supported (jsdom, older browsers).

export function mediaSessionSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator
}

/** Announce what's playing and route the lock-screen pause/stop to our engine. */
export function setNowPlaying(title: string, onStop: () => void): void {
  if (!mediaSessionSupported()) return
  try {
    const ms = navigator.mediaSession
    if (typeof window !== 'undefined' && 'MediaMetadata' in window) {
      ms.metadata = new window.MediaMetadata({
        title: title || 'a signal',
        artist: 'Ecosphere',
        album: 'the nocturne band',
      })
    }
    ms.playbackState = 'playing'
    ms.setActionHandler('pause', () => { try { onStop() } catch { /* ignore */ } })
    ms.setActionHandler('stop', () => { try { onStop() } catch { /* ignore */ } })
    ms.setActionHandler('play', () => { ms.playbackState = 'playing' })
  } catch { /* unsupported metadata shape */ }
}

export function clearNowPlaying(): void {
  if (!mediaSessionSupported()) return
  try {
    const ms = navigator.mediaSession
    ms.playbackState = 'none'
    ms.metadata = null
    for (const action of ['play', 'pause', 'stop'] as const) ms.setActionHandler(action, null)
  } catch { /* ignore */ }
}
