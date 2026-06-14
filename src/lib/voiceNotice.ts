// A one-time, plain notice shown before someone's first recording: what
// happens to their voice. Remembered on-device so it never nags.

const KEY = 'ecosphere:voiceNoticeSeen'

export function voiceNoticeSeen(): boolean {
  try { return window.localStorage.getItem(KEY) === 'yes' } catch { return false }
}

export function markVoiceNoticeSeen(): void {
  try { window.localStorage.setItem(KEY, 'yes') } catch { /* session only */ }
}
