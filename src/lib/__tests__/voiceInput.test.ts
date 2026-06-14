// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { googleSearchUrl, voiceInputSupported, recognitionLang } from '../voiceInput'

describe('voice input + web link helpers', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('builds a Google results URL with the query encoded', () => {
    expect(googleSearchUrl('how do rooms work')).toBe('https://www.google.com/search?q=how%20do%20rooms%20work')
    expect(googleSearchUrl('  spaced  ')).toBe('https://www.google.com/search?q=spaced')
  })

  it('reports no speech recognition in jsdom', () => {
    expect(voiceInputSupported()).toBe(false)
  })

  it('maps the saved language to a recognizer tag, defaulting to en-US', () => {
    expect(recognitionLang()).toBe('en-US')
    window.localStorage.setItem('ecosphere:settings', JSON.stringify({ language: 'es' }))
    expect(recognitionLang()).toBe('es-ES')
    window.localStorage.setItem('ecosphere:settings', JSON.stringify({ language: 'zz' }))
    expect(recognitionLang()).toBe('en-US')
  })
})
