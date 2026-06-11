// Weight of Silence: a neutral observation, not a whip. Tracks when the
// user last released a recording anywhere in the app (every recording
// passes through saveRecordingLocally, which stamps this).

const LAST_VOICE_KEY = 'ecosphere:lastVoiceAt'

export function readLastVoiceAt(): number | null {
  try {
    const raw = window.localStorage.getItem(LAST_VOICE_KEY)
    if (!raw) return null
    const value = Number(raw)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function stampVoiceNow() {
  try {
    window.localStorage.setItem(LAST_VOICE_KEY, String(Date.now()))
  } catch {
    /* storage unavailable */
  }
  try {
    window.dispatchEvent(new CustomEvent('ecosphere:voice'))
  } catch {
    /* non-browser context */
  }
}

/** Whole days of silence. null lastVoiceAt means "never spoken" → null. */
export function silentDays(lastVoiceAt: number | null, now = Date.now()): number | null {
  if (lastVoiceAt == null || lastVoiceAt > now) return null
  return Math.floor((now - lastVoiceAt) / (24 * 60 * 60 * 1000))
}

export function silenceLine(days: number): string {
  if (days === 2) return 'silent for 2 days. the band still remembers your frequency.'
  if (days <= 4) return `silent for ${days} days. your resonance is fading.`
  if (days <= 9) return `silent for ${days} days. your channel is drifting toward static.`
  return `silent for ${days} days. the ecosystem keeps your frequency open anyway.`
}
