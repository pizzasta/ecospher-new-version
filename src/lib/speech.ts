// Real spoken playback. When a signal is played, the actual words are read
// aloud in the most natural voice the device has — not the wordless
// synthesized murmur. Everything runs on-device through the Web Speech API:
// nothing is uploaded, no API keys, no network, so anonymity is untouched.
// It's a short sample, not a full reading.

export function speechSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof window.speechSynthesis !== 'undefined'
    && typeof window.SpeechSynthesisUtterance !== 'undefined'
}

// strip combining/corruption glyphs (zalgo) and ui symbols so the reader
// doesn't choke on them or spell them out
const COMBINING = /\p{M}/gu // combining marks (zalgo / corruption glyphs)
const UI_GLYPHS = /[░▒▓█♪◈⬡∿≋◌◍◔◉○✶✦✧⬢⟁∅·]/g

export function cleanForSpeech(text: string): string {
  return text
    .normalize('NFKD')
    .replace(COMBINING, '')
    .replace(UI_GLYPHS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A sample, not the whole thing: first sentence or ~160 chars, with a breath. */
export function sampleText(text: string, maxChars = 160): string {
  const clean = cleanForSpeech(text)
  if (clean.length <= maxChars) return clean
  const cut = clean.slice(0, maxChars)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(', '), cut.lastIndexOf(' '))
  return (stop > 40 ? cut.slice(0, stop) : cut).trim() + '…'
}

/** Rough spoken duration in ms at our calm rate (~2.6 words/sec), floored. */
export function estimateSpeechMs(text: string): number {
  const words = sampleText(text).split(/\s+/).filter(Boolean).length
  return Math.max(1800, Math.round((words / 2.6) * 1000) + 600)
}

// ─── voice selection: prefer natural/neural voices ────────────────────────────

const GOOD_NAME = /(natural|neural|premium|enhanced|online|siri|samantha|ava|allison|serena|jenny|aria|google)/i
const ROBOTIC_NAME = /(espeak|compact|eloquence|\bfred\b|albert|zarvox|cellos|bells|bad news|robot)/i

type VoiceLike = { name: string; lang: string; localService?: boolean }

/** Higher is better: language match + natural-sounding name + online voice. */
export function rankVoice(voice: VoiceLike, lang: string): number {
  const vlang = (voice.lang ?? '').toLowerCase()
  let score = 0
  if (vlang.startsWith(lang)) score += 40
  else if (vlang.slice(0, 2) === lang.slice(0, 2)) score += 25
  if (GOOD_NAME.test(voice.name)) score += 30
  if (voice.localService === false) score += 12 // online voices are usually neural
  if (ROBOTIC_NAME.test(voice.name)) score -= 60
  return score
}

let cachedVoices: SpeechSynthesisVoice[] = []

function loadVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return []
  const voices = window.speechSynthesis.getVoices()
  if (voices.length) cachedVoices = voices
  return cachedVoices
}

// warm the voice list early — on some browsers getVoices() is empty until this fires
if (speechSupported()) {
  loadVoices()
  try { window.speechSynthesis.addEventListener('voiceschanged', loadVoices) } catch { /* older browsers */ }
}

function preferredSpeechLang(): string {
  try {
    const raw = window.localStorage.getItem('ecosphere:settings')
    const lang = raw ? String(JSON.parse(raw)?.language ?? '') : ''
    if (lang) return lang.toLowerCase().slice(0, 2)
  } catch { /* default below */ }
  return 'en'
}

function preferredSpeechVolume(): number {
  try {
    const raw = window.localStorage.getItem('ecosphere:settings')
    const v = raw ? Number(JSON.parse(raw)?.signalVolume) : NaN
    if (Number.isFinite(v)) return Math.min(1, Math.max(0.1, v / 100))
  } catch { /* default below */ }
  return 0.95
}

/**
 * Pick a voice, biased toward the best ones, but seeded so a given signal
 * keeps the same voice every time it plays.
 */
function pickVoice(seed: number, lang: string): SpeechSynthesisVoice | null {
  const voices = loadVoices()
  if (!voices.length) return null
  const ranked = voices
    .map(v => ({ v, score: rankVoice(v, lang) }))
    .sort((a, b) => b.score - a.score)
    .filter(r => r.score > 0)
  const pool = (ranked.length ? ranked : voices.map(v => ({ v, score: 0 }))).slice(0, 4)
  return pool[Math.abs(seed) % pool.length].v
}

// ─── playback ────────────────────────────────────────────────────────────────

let current: SpeechSynthesisUtterance | null = null

export function cancelSpeech(): void {
  if (!speechSupported()) return
  current = null
  try { window.speechSynthesis.cancel() } catch { /* nothing speaking */ }
}

type SpeakOpts = { onStart?: () => void; onEnd?: () => void }

/**
 * Read a signal's words aloud, once. Calm, slightly low, with a small
 * per-signal variation so each signal keeps a consistent voice. Returns the
 * estimated duration so callers can drive the waveform; returns 0 and does
 * nothing when speech isn't supported.
 */
export function speakSignal(text: string, seed: number, opts: SpeakOpts = {}): number {
  if (!speechSupported()) return 0
  const phrase = sampleText(text)
  if (!phrase) return 0

  cancelSpeech()

  const lang = preferredSpeechLang()
  const utter = new SpeechSynthesisUtterance(phrase)
  const voice = pickVoice(seed, lang)
  if (voice) { utter.voice = voice; utter.lang = voice.lang }
  else utter.lang = lang

  // late-night intimacy: a touch slow, a touch low, seeded jitter for character
  utter.rate = 0.9 + (((seed % 7) - 3) * 0.012)
  utter.pitch = 0.92 + (((seed % 5) - 2) * 0.04)
  utter.volume = preferredSpeechVolume()

  utter.onstart = () => opts.onStart?.()
  utter.onend = () => { if (current === utter) current = null; opts.onEnd?.() }
  utter.onerror = () => { if (current === utter) current = null; opts.onEnd?.() }

  current = utter
  try {
    window.speechSynthesis.speak(utter)
  } catch {
    current = null
    return 0
  }
  return estimateSpeechMs(text)
}

// stop talking when the tab is hidden — never keep a voice going in the background
if (speechSupported() && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelSpeech() })
}
