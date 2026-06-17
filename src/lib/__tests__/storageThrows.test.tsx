// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { AudioProvider } from '../../audio-system'

// Embedded / in-app browsers (e.g. the Snapchat webview) and private mode can
// make *any* window.localStorage access throw instead of returning null. The
// boot providers read localStorage inside render-time state initializers, so an
// unguarded read crashes the whole app on first paint and strands the user on
// the "SIGNAL INTERRUPTED" screen — and clearing storage can't help, because
// the next render throws on the very same access. These guard against that.

describe('boot survives a localStorage that throws on access', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('AudioProvider mounts its children even if localStorage.getItem throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('storage disabled', 'SecurityError')
    })
    const { getByText } = render(
      <AudioProvider>
        <div>tuned in</div>
      </AudioProvider>,
    )
    expect(getByText('tuned in')).toBeTruthy()
  })
})
