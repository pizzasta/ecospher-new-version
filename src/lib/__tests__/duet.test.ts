// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { DUET_MAX_MS, duetCaption, duetLength } from '../duet'
import { AUDIO_UPLOAD_LIMITS } from '../library'
import { exportFilename } from '../storyExport'

describe('voice duets', () => {
  it('caption names who you answered, with your words when you add some', () => {
    expect(duetCaption('night_owl')).toBe('duet ⧉ @night_owl')
    expect(duetCaption('@night_owl', '  same   here ')).toBe('duet ⧉ @night_owl — same here')
    expect(duetCaption('')).toBe('duet ⧉ @anonymous')
  })

  it('never runs longer than the network accepts', () => {
    expect(DUET_MAX_MS).toBeLessThanOrEqual(AUDIO_UPLOAD_LIMITS.maxSeconds * 1000)
    expect(duetLength(DUET_MAX_MS + 900)).toBe(DUET_MAX_MS)
    expect(duetLength(-5)).toBe(0)
  })
})

describe('clip export filenames', () => {
  it('match the container the browser recorded', () => {
    expect(exportFilename('a b', 'video', 'video/mp4;codecs=avc1')).toMatch(/^ecosphere-a_b-\d+\.mp4$/)
    expect(exportFilename('a', 'video', 'video/webm')).toMatch(/\.webm$/)
    expect(exportFilename('a', 'image')).toMatch(/\.png$/)
  })
})
