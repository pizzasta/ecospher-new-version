import { describe, it, expect } from 'vitest'
import { cleanForSpeech, sampleText, estimateSpeechMs, rankVoice } from '../speech'

describe('speech sample helpers', () => {
  it('strips ui glyphs and zalgo so the reader is not tripped up', () => {
    const out = cleanForSpeech('still ░░░ awake ◈ tonight ̸̱͊')
    expect(out).not.toMatch(/[░◈]/)
    expect(out.toLowerCase()).toContain('still')
    expect(out.toLowerCase()).toContain('awake')
    expect(out.toLowerCase()).toContain('tonight')
  })

  it('keeps short lines whole', () => {
    expect(sampleText('the quiet feels different tonight')).toBe('the quiet feels different tonight')
  })

  it('trims long content to a sample with a breath', () => {
    const long = 'word '.repeat(80).trim()
    const sample = sampleText(long)
    expect(sample.length).toBeLessThanOrEqual(161)
    expect(sample.endsWith('…')).toBe(true)
  })

  it('estimates a non-trivial spoken duration', () => {
    const ms = estimateSpeechMs('still awake the quiet feels different tonight like something remembering itself')
    expect(ms).toBeGreaterThanOrEqual(1800)
    expect(ms).toBeLessThan(30000)
  })

  it('ranks natural same-language voices above robotic ones', () => {
    const natural = rankVoice({ name: 'Samantha (Enhanced)', lang: 'en-US', localService: false }, 'en')
    const robotic = rankVoice({ name: 'eSpeak compact', lang: 'en-US', localService: true }, 'en')
    const wrongLang = rankVoice({ name: 'Google Deutsch', lang: 'de-DE', localService: false }, 'en')
    expect(natural).toBeGreaterThan(robotic)
    expect(natural).toBeGreaterThan(wrongLang)
  })
})
