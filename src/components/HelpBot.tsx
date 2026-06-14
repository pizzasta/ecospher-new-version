import { useEffect, useRef, useState } from 'react'
import { askHelpBot, HELP_TOPICS } from '../lib/helpBot'
import { startVoiceInput, voiceInputSupported, googleSearchUrl } from '../lib/voiceInput'
import type { VoiceSession } from '../lib/voiceInput'
import './HelpBot.css'

// Help Bot — a small chat overlay opened from Settings → Help & Safety.
// Answers FAQ and safety questions locally or via the help-bot Edge Function.
// A microphone lets you ask by voice (speech-to-text); every answer also offers
// a live web search, and a spoken question opens those web results automatically.

interface ChatMessage {
  id: number
  role: 'user' | 'bot'
  text: string
  /** when set, the bot offers a live web search for this query */
  query?: string
}

const INTRO: ChatMessage = {
  id: 0,
  role: 'bot',
  text: "i'm the help frequency. ask me how anything here works, or about the safety rules — recording, rooms, privacy, deleting your data, reporting, all of it.",
}

const SUGGESTED_IDS = ['what-is', 'safety', 'report', 'delete', 'lurker', 'age']

export default function HelpBot({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([INTRO])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const idRef = useRef(1)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const voiceRef = useRef<VoiceSession | null>(null)
  const micSupported = voiceInputSupported()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => () => { voiceRef.current?.stop() }, [])

  const openWeb = (query: string): boolean => {
    const opened = window.open(googleSearchUrl(query), '_blank', 'noopener,noreferrer')
    return opened !== null
  }

  const ask = (question: string, fromMic = false) => {
    const text = question.trim()
    if (!text || busy) return
    const userMsg: ChatMessage = { id: idRef.current++, role: 'user', text }
    const historyBefore = messages.slice(1) // intro isn't conversation
    setMessages(prev => [...prev, userMsg])
    setDraft('')
    setVoiceNote(null)
    setBusy(true)
    void askHelpBot(text, historyBefore.map(m => ({ role: m.role, text: m.text }))).then(reply => {
      setMessages(prev => [...prev, { id: idRef.current++, role: 'bot', text: reply.text, query: text }])
      setBusy(false)
      // a spoken question opens live web results automatically
      if (fromMic) openWeb(text)
    })
  }

  const toggleMic = () => {
    if (listening) { voiceRef.current?.stop(); return }
    if (!micSupported) { setVoiceNote("voice input isn't supported in this browser"); return }
    setVoiceNote(null)
    const session = startVoiceInput({
      onPartial: t => setDraft(t),
      onFinal: t => ask(t, true),
      onError: kind => setVoiceNote(kind === 'not-allowed' || kind === 'service-not-allowed'
        ? 'microphone permission is needed'
        : kind === 'no-speech' ? "didn't catch that — try again" : 'voice input failed'),
      onEnd: () => { setListening(false); voiceRef.current = null },
    })
    if (!session) { setVoiceNote('voice input failed to start'); return }
    voiceRef.current = session
    setListening(true)
  }

  const showChips = messages.length === 1

  return (
    <div className="helpbot-overlay" role="dialog" aria-label="Help bot">
      <div className="helpbot-panel">
        <header className="helpbot-head">
          <div>
            <span className="helpbot-title">◍ help frequency</span>
            <span className="helpbot-sub">faq · safety protocols</span>
          </div>
          <button type="button" className="helpbot-close" onClick={onClose} aria-label="Close help">✕</button>
        </header>

        <div className="helpbot-log" ref={logRef}>
          {messages.map(m => (
            <div key={m.id} className={`helpbot-msg helpbot-msg--${m.role}`}>
              <span>{m.text}</span>
              {m.role === 'bot' && m.query && (
                <a
                  className="helpbot-weblink"
                  href={googleSearchUrl(m.query)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ↗ search the web for this
                </a>
              )}
            </div>
          ))}
          {busy && (
            <div className="helpbot-msg helpbot-msg--bot helpbot-msg--typing" aria-label="thinking">
              <i /><i /><i />
            </div>
          )}
          {showChips && (
            <div className="helpbot-chips">
              {SUGGESTED_IDS.map(id => {
                const topic = HELP_TOPICS.find(t => t.id === id)
                if (!topic) return null
                return (
                  <button key={id} type="button" className="helpbot-chip" onClick={() => ask(topic.label)}>
                    {topic.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {voiceNote && <div className="helpbot-voice-note" role="status">{voiceNote}</div>}

        <div className="helpbot-input-row">
          <button
            type="button"
            className={`helpbot-mic${listening ? ' listening' : ''}`}
            onClick={toggleMic}
            disabled={!micSupported && !listening}
            aria-pressed={listening}
            aria-label={listening ? 'stop listening' : 'ask by voice'}
            title={micSupported ? 'ask by voice' : "voice input isn't supported here"}
          >
            {listening ? '◉' : '🎙'}
          </button>
          <input
            ref={inputRef}
            type="text"
            className="helpbot-input"
            placeholder={listening ? 'listening…' : 'ask the help frequency…'}
            maxLength={400}
            value={draft}
            disabled={busy}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ask(draft) }}
          />
          <button type="button" className="helpbot-send" disabled={busy || !draft.trim()} onClick={() => ask(draft)}>
            ask
          </button>
        </div>
        <p className="helpbot-foot">
          answers cover ecosphere only · not a crisis service · <a href="/terms.html">terms</a> · <a href="/privacy.html">privacy</a>
        </p>
      </div>
    </div>
  )
}
