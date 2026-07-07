// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { speechSupported } from '../speech'
import { readPref } from '../../hooks/useEcoPrefs'

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('spoken voices setting', () => {
  it('speechSupported honors the voices switch', () => {
    // give jsdom a speech engine so support would otherwise be true
    vi.stubGlobal('speechSynthesis', { getVoices: () => [], addEventListener: () => {} })
    vi.stubGlobal('SpeechSynthesisUtterance', class {})
    expect(speechSupported()).toBe(true)
    window.localStorage.setItem('ecosphere:settings', JSON.stringify({ voices: false }))
    expect(speechSupported()).toBe(false)
    window.localStorage.setItem('ecosphere:settings', JSON.stringify({ voices: true }))
    expect(speechSupported()).toBe(true)
  })
})

describe('pref plumbing', () => {
  it('readPref returns stored values and falls back per-key', () => {
    window.localStorage.setItem('ecosphere:settings', JSON.stringify({ whispers: false, vibrate: false }))
    expect(readPref('whispers', true)).toBe(false)
    expect(readPref('vibrate', true)).toBe(false)
    expect(readPref('voices', true)).toBe(true) // unset → default
    expect(readPref('textSize', 'cozy')).toBe('cozy')
  })

  it('survives corrupt settings', () => {
    window.localStorage.setItem('ecosphere:settings', '{nope')
    expect(readPref('whispers', true)).toBe(true)
  })
})
