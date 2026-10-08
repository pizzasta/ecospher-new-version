// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { EcosystemProvider } from '../../hooks/useEcosystemState'
import { GlobalAudioProvider } from '../../hooks/useGlobalAudio'
import { RecordingSessionProvider } from '../../hooks/useRecordingSession'
import App from '../../App'

// Whole-app smoke: every screen must mount and render its own content
// without throwing — the cheapest possible "no broken code" audit.

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }
  if (!('IntersectionObserver' in window)) {
    // @ts-expect-error jsdom shim
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (!window.scrollTo) window.scrollTo = (() => {}) as typeof window.scrollTo
})

// [route, text that only that screen renders]
const ROUTES: Array<[string, RegExp]> = [
  ['/', /tune into tonight|signal command|daily signal/i],
  ['/drift', /frequency scanner|hold and drag to sweep/i],
  ['/relics', /LIVE ECHOES/i],
  ['/chains', /strangers building one sound|the noise is the point/i],
  ['/capsules', /rare frequency|unmarked capsule/i],
  ['/frequencies', /live voices streaming past|drifting nearby/i],
  ['/pod', /your signal identity|signal ·/i],
  ['/zones', /dark zones|offline channels/i],
  ['/settings', /configure your presence/i],
  ['/signals', /live emotional radio|resonating|signal feed/i],
  ['/rooms', /anonymous group calls|live voice channels/i],
  ['/unsent', /dead drop/i],
]

describe('screen smoke: every route mounts without throwing', () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    window.localStorage.setItem('ecosphere:tourDone', 'yes')
    window.localStorage.setItem('ecosphere:ageConfirmed', 'yes')
    window.localStorage.setItem('signalIdentity', 'smoke_tester')
  })

  for (const [path, pattern] of ROUTES) {
    it(`renders ${path}`, async () => {
      window.history.replaceState({}, '', path)
      const { container } = render(
        <EcosystemProvider>
          <GlobalAudioProvider>
            <RecordingSessionProvider>
              <App />
            </RecordingSessionProvider>
          </GlobalAudioProvider>
        </EcosystemProvider>,
      )
      await waitFor(() => {
        expect(container.textContent ?? '').toMatch(pattern)
      }, { timeout: 4000 })
    })
  }

  it('blocks entry behind the 18+ gate until confirmed', async () => {
    window.localStorage.removeItem('ecosphere:ageConfirmed')
    window.history.replaceState({}, '', '/')
    const { container } = render(
      <EcosystemProvider>
        <GlobalAudioProvider>
          <RecordingSessionProvider>
            <App />
          </RecordingSessionProvider>
        </GlobalAudioProvider>
      </EcosystemProvider>,
    )
    await waitFor(() => {
      expect(container.textContent ?? '').toMatch(/18 or older/i)
    }, { timeout: 4000 })
    // the gated screen content must not be present yet
    expect(container.textContent ?? '').not.toMatch(/daily signal|signal command/i)
  })
})
