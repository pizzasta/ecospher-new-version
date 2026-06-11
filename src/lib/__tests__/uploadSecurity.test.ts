import { describe, expect, it } from 'vitest'
import { sanitizeRoomId, validateAudioUpload } from '../library'

function audioBlob(bytes: number, type: string) {
  return new Blob([new Uint8Array(bytes)], { type })
}

describe('upload security — MIME allowlist', () => {
  it('accepts MediaRecorder formats including codec suffixes', () => {
    expect(validateAudioUpload(audioBlob(10_000, 'audio/webm;codecs=opus'), 10)).toBeNull()
    expect(validateAudioUpload(audioBlob(10_000, 'audio/mp4'), 10)).toBeNull()
    expect(validateAudioUpload(audioBlob(10_000, 'audio/ogg'), 10)).toBeNull()
  })

  it('rejects non-audio content types', () => {
    expect(validateAudioUpload(audioBlob(10_000, 'text/html'), 10)).toMatch(/unsupported/)
    expect(validateAudioUpload(audioBlob(10_000, 'application/javascript'), 10)).toMatch(/unsupported/)
    expect(validateAudioUpload(audioBlob(10_000, 'video/mp4'), 10)).toMatch(/unsupported/)
  })
})

describe('upload security — room id sanitization', () => {
  it('passes slug-style room ids through', () => {
    expect(sanitizeRoomId('resonance-chambers')).toBe('resonance-chambers')
    expect(sanitizeRoomId('room_42')).toBe('room_42')
  })

  it('drops anything that is not a slug', () => {
    expect(sanitizeRoomId('../../etc/passwd')).toBeNull()
    expect(sanitizeRoomId('<script>alert(1)</script>')).toBeNull()
    expect(sanitizeRoomId('a'.repeat(65))).toBeNull()
    expect(sanitizeRoomId(undefined)).toBeNull()
    expect(sanitizeRoomId('')).toBeNull()
  })
})
