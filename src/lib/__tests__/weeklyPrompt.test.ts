import { describe, expect, it } from 'vitest'
import { currentPrompt } from '../weeklyPrompt'

const EPOCH = Date.UTC(2026, 0, 5)
const DAY = 24 * 60 * 60 * 1000

describe('prompt of the week', () => {
  it('is deterministic — every client agrees on the live prompt', () => {
    const now = EPOCH + 23 * DAY
    expect(currentPrompt(now)).toEqual(currentPrompt(now))
  })

  it('holds for a full week, then rotates', () => {
    const week0 = currentPrompt(EPOCH + 1000)
    expect(currentPrompt(EPOCH + 6 * DAY).id).toBe(week0.id)
    const week1 = currentPrompt(EPOCH + 7 * DAY + 1000)
    expect(week1.id).not.toBe(week0.id)
    expect(week1.text).not.toBe(week0.text)
  })

  it('counts down days remaining', () => {
    expect(currentPrompt(EPOCH + 1000).daysLeft).toBe(7)
    expect(currentPrompt(EPOCH + 6 * DAY + 1000).daysLeft).toBe(1)
  })

  it('keeps prompts in the human register', () => {
    for (let week = 0; week < 12; week += 1) {
      const prompt = currentPrompt(EPOCH + week * 7 * DAY + 1000)
      expect(prompt.text.toLowerCase()).not.toMatch(/resonance|frequenc|bloom|orbit|cyan/)
    }
  })
})
