// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import TheSimultaneous from '../../components/TheSimultaneous'

describe('joining a shared moment', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    window.localStorage.setItem('ecosphere:simultaneousOverride', 'open')
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('stays open after the next invitation poll', () => {
    const { container, getByText } = render(<TheSimultaneous />)
    fireEvent.click(getByText(/join the moment/i))
    expect(container.querySelector('.simul--inside')).not.toBeNull()
    // the invitation poll runs every 15s; joining must not get it to close the view
    act(() => { vi.advanceTimersByTime(16_000) })
    expect(container.querySelector('.simul--inside')).not.toBeNull()
  })
})
