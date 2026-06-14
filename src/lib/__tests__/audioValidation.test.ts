import { describe, expect, it } from 'vitest'
import { AUDIO_UPLOAD_LIMITS, validateAudioUpload } from '../library'

function blobOfSize(bytes: number) {
  return new Blob([new Uint8Array(bytes)], { type: 'audio/webm' })
}

describe('audio upload validation', () => {
  it('accepts a normal recording', () => {
    expect(validateAudioUpload(blobOfSize(50_000), 12)).toBeNull()
  })

  it('rejects an empty blob', () => {
    expect(validateAudioUpload(blobOfSize(0), 10)).toMatch(/empty/)
  })

  it('rejects recordings under the minimum duration', () => {
    expect(validateAudioUpload(blobOfSize(10_000), AUDIO_UPLOAD_LIMITS.minSeconds - 1)).toMatch(/too short/)
  })

  it('rejects recordings over the maximum duration', () => {
    expect(validateAudioUpload(blobOfSize(100_000), AUDIO_UPLOAD_LIMITS.maxSeconds + 5)).toMatch(/too long/)
  })

  it('rejects files over the 2MB limit', () => {
    expect(validateAudioUpload(blobOfSize(AUDIO_UPLOAD_LIMITS.maxBytes + 1), 30)).toMatch(/too large/)
  })

  it('accepts a recording exactly at the limits', () => {
    expect(validateAudioUpload(blobOfSize(AUDIO_UPLOAD_LIMITS.maxBytes), AUDIO_UPLOAD_LIMITS.maxSeconds)).toBeNull()
    expect(validateAudioUpload(blobOfSize(1_000), AUDIO_UPLOAD_LIMITS.minSeconds)).toBeNull()
  })
})
