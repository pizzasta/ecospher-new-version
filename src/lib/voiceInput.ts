// Voice input for the help chat: speak a question, get it transcribed. Uses the
// browser's Web Speech Recognition API — recognition happens through the
// browser/OS, we never upload audio ourselves. Not available in every browser
// (notably Firefox), so callers must check voiceInputSupported() and degrade.

interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean;0: SRAlternative; length: number }
interface SRResultList { length: number;[index: number]: SRResult }
interface SRResultEvent { resultIndex: number; results: SRResultList }
interface SRErrorEvent { error: string }

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SRResultEvent) => void) | null
  onerror: ((e: SRErrorEvent) => void) | null
  onend: (() => void) | null
}

type SRConstructor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SRConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function voiceInputSupported(): boolean {
  return getRecognitionCtor() !== null
}

// app language code → a BCP-47 tag the recognizer understands
const LANG_TAGS: Record<string, string> = {
  en: 'en-US', es: 'es-ES', pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR', ja: 'ja-JP',
}

export function recognitionLang(): string {
  try {
    const raw = window.localStorage.getItem('ecosphere:settings')
    const code = raw ? String(JSON.parse(raw)?.language ?? '').toLowerCase().slice(0, 2) : ''
    if (code && LANG_TAGS[code]) return LANG_TAGS[code]
  } catch { /* default below */ }
  return 'en-US'
}

export interface VoiceSession { stop: () => void }

export interface VoiceHandlers {
  onPartial?: (text: string) => void
  onFinal: (text: string) => void
  onError?: (kind: string) => void
  onEnd?: () => void
}

/**
 * Start listening once. Streams interim text via onPartial and delivers the
 * settled transcript via onFinal. Returns null when speech recognition isn't
 * available. The recognizer auto-stops on a natural pause.
 */
export function startVoiceInput(handlers: VoiceHandlers, opts: { continuous?: boolean } = {}): VoiceSession | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null
  const rec = new Ctor()
  rec.lang = recognitionLang()
  rec.interimResults = true
  // continuous keeps listening through pauses — right for a timed voice
  // reaction; the help chat leaves it off so it settles on the first thought
  rec.continuous = opts.continuous ?? false
  rec.maxAlternatives = 1

  let finalText = ''
  rec.onresult = (e: SRResultEvent) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i]
      const phrase = result[0]?.transcript ?? ''
      if (result.isFinal) finalText += phrase
      else interim += phrase
    }
    handlers.onPartial?.((finalText + interim).trim())
  }
  rec.onerror = (e: SRErrorEvent) => handlers.onError?.(e?.error ?? 'error')
  rec.onend = () => {
    const settled = finalText.trim()
    if (settled) handlers.onFinal(settled)
    handlers.onEnd?.()
  }

  try {
    rec.start()
  } catch {
    return null
  }
  return { stop: () => { try { rec.stop() } catch { /* already stopped */ } } }
}

/** A Google results URL for a question — opened in a new tab from the chat. */
export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`
}
