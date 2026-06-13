import { useEffect, useRef, useState } from 'react'
import { askHelpBot, HELP_TOPICS } from '../lib/helpBot'
import { startVoiceInput, voiceInputSupported, googleSearchUrl } from '../lib/voiceInput'
import type { VoiceSession } from '../lib/voiceInput'
import './HelpBot.css'

// Help Bot — a small chat overlay opened from Settings → Help & Safety.
// Two modes: the scoped "help frequency" (FAQ + safety, answered locally or via
// the help-bot Edge Function), and a "$ live agent" that pulls real-time answers
// from the web (opens Google results in a new tab). A microphone lets you ask by
// voice; voice questions open the web automatically.

interface ChatMessage {
  id: number
  role: 'user' | 'bot'
  text: string
  /** when set, the bot offers a real-time web search for this query */
  query?: string
}

type AgentMode = 'help' | 'live'

const INTRO: ChatMessage = {
  id: 0,
  role: 'bot',
  text: "i'm the help frequency. ask me how anything here works, or about the safety rules — recording, rooms, privacy, deleting your data, reporting, all of it. switch to the $ live agent for real-time answers from the web.",
}

const SUGGESTED_IDS = ['what-is', 'safety', 'report', 'delete', 'lurker', 'age']

export default function HelpBot({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([INTRO])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<AgentMode>('help')
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

    // live agent: real-time answers come from the web — open results in a new tab
    if (mode === 'live') {
      const opened = openWeb(text)
      setMessages(prev => [...prev, {
        id: idRef.current++,
        role: 'bot',
        text: opened
          ? `opening live results for "${text}" in a new tab.`
          : `here are live results for "${text}" — tap to open.`,
        query: text,
      }])
      return
    }

    // help mode: scoped answer, with a real-time web link alongside
    setBusy(true)
    void askHelpBot(text, historyBefore.map(m => ({ role: m.role, text: m.text }))).then(reply => {
      setMessages(prev => [...prev, { id: idRef.current++, role: 'bot', text: reply.text, query: text }])
      setBusy(false)
      // a voice question always pops the web open automatically
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
      <div className={`helpbot-panel${mode === 'live' ? ' helpbot-panel--live' : ''}`}>
        <header className="helpbot-head">
          <div>
            <span className="helpbot-title">
              {mode === 'live' ? <b className="helpbot-logo-live" aria-hidden="true">$</b> : '◍'} {mode === 'live' ? 'live agent' : 'help frequency'}
            </span>
            <span className="helpbot-sub">{mode === 'live' ? 'real-time answers from the web' : 'faq · safety protocols'}</span>
          </div>
          <div className="helpbot-head-actions">
            <button
              type="button"
              className={`helpbot-mode${mode === 'live' ? ' on' : ''}`}
              onClick={() => setMode(m => (m === 'live' ? 'help' : 'live'))}
              aria-pressed={mode === 'live'}
              title="toggle the real-time web agent"
            >
              <span aria-hidden="true">$</span> {mode === 'live' ? 'live' : 'go live'}
            </button>
            <button type="button" className="helpbot-close" onClick={onClose} aria-label="Close help">✕</button>
          </div>
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
                  ↗ open live results on the web
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
            placeholder={listening ? 'listening…' : mode === 'live' ? 'ask anything — answers from the web…' : 'ask the help frequency…'}
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
          {mode === 'live'
            ? 'live answers open google in a new tab · not a crisis service'
            : <>answers cover ecosphere only · not a crisis service</>} · <a href="/terms.html">terms</a> · <a href="/privacy.html">privacy</a>
        </p>
      </div>
    </div>
  )
}
