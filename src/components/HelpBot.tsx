import { useEffect, useRef, useState } from 'react'
import { askHelpBot, HELP_TOPICS } from '../lib/helpBot'
import './HelpBot.css'

// Help Bot — a small chat overlay opened from Settings → Help & Safety.
// Answers FAQ and safety-protocol questions instantly from the local
// knowledge base, or via Claude when the help-bot Edge Function is live.

interface ChatMessage {
  id: number
  role: 'user' | 'bot'
  text: string
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
  const idRef = useRef(1)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const ask = (question: string) => {
    const text = question.trim()
    if (!text || busy) return
    const userMsg: ChatMessage = { id: idRef.current++, role: 'user', text }
    const historyBefore = messages.slice(1) // intro isn't conversation
    setMessages(prev => [...prev, userMsg])
    setDraft('')
    setBusy(true)
    void askHelpBot(text, historyBefore.map(m => ({ role: m.role, text: m.text }))).then(reply => {
      setMessages(prev => [...prev, { id: idRef.current++, role: 'bot', text: reply.text }])
      setBusy(false)
    })
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
              {m.text}
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

        <div className="helpbot-input-row">
          <input
            ref={inputRef}
            type="text"
            className="helpbot-input"
            placeholder="ask the help frequency…"
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
