// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { EcosystemProvider } from '../../hooks/useEcosystemState'
import { SettingsScreen } from '../../App'

function mountSettings() {
  return render(
    <EcosystemProvider>
      <SettingsScreen />
    </EcosystemProvider>,
  )
}

describe('settings toggles', () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('renders all nine toggles', () => {
    const { container } = mountSettings()
    expect(container.querySelectorAll('button.toggle')).toHaveLength(9)
  })

  it('flips state, class, and persisted value on click', () => {
    const { container } = mountSettings()
    const toggles = container.querySelectorAll('button.toggle')
    const vibrate = toggles[1] as HTMLButtonElement // anonymous, vibrate, night, ...

    const wasOn = vibrate.classList.contains('on')
    fireEvent.click(vibrate)
    expect(vibrate.classList.contains('on')).toBe(!wasOn)

    const stored = JSON.parse(window.localStorage.getItem('ecosphere:settings') ?? '{}')
    expect(stored.vibrate).toBe(!wasOn)

    fireEvent.click(vibrate)
    expect(vibrate.classList.contains('on')).toBe(wasOn)
  })

  it('survives settings stored by an older app version (missing new keys)', () => {
    window.localStorage.setItem('ecosphere:settings', JSON.stringify({ vibrate: true, anonymous: true, nightMode: false, signalVolume: 72, driftSensitivity: 60 }))
    const { container } = mountSettings()
    const toggles = container.querySelectorAll('button.toggle')
    // lurker toggle (index 4) starts off because the key is missing
    const lurker = toggles[4] as HTMLButtonElement
    expect(lurker.classList.contains('on')).toBe(false)
    fireEvent.click(lurker)
    expect(lurker.classList.contains('on')).toBe(true)
    const stored = JSON.parse(window.localStorage.getItem('ecosphere:settings') ?? '{}')
    expect(stored.lurker).toBe(true)
    expect(stored.vibrate).toBe(true) // old keys preserved
  })

  it('broadcasts changes for live systems', () => {
    const { container } = mountSettings()
    let lastDetail: Record<string, unknown> | null = null
    const onPrefs = (event: Event) => { lastDetail = (event as CustomEvent).detail }
    window.addEventListener('ecosphere:prefs', onPrefs)
    fireEvent.click(container.querySelectorAll('button.toggle')[2]) // night protocol
    window.removeEventListener('ecosphere:prefs', onPrefs)
    expect(lastDetail).not.toBeNull()
    expect((lastDetail as unknown as { nightMode: boolean }).nightMode).toBe(true)
  })
})
