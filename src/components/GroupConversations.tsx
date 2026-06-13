import { useEffect, useRef, useState } from 'react'
import { GROUP_TOPICS, playGroupConversation } from '../lib/groupTalk'
import type { GroupSession } from '../lib/groupTalk'
import { speechSupported } from '../lib/speech'

// Tap a topic and hear a small anonymous group talking about it — real voices
// trading short lines, over a low murmur of others in the room.

const SPEAKER_GLYPHS = ['◍', '◐', '◑', '◒']

function listenersFor(id: string, tick: number): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return 3 + ((h + tick) % 9)
}

export default function GroupConversations() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<{ who: number; line: string }[]>([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [ended, setEnded] = useState(false)
  const [tick, setTick] = useState(0)
  const sessionRef = useRef<GroupSession | null>(null)
  const noVoices = !speechSupported()

  useEffect(() => {
    const t = window.setInterval(() => setTick(n => n + 1), 5000)
    return () => {
      window.clearInterval(t)
      sessionRef.current?.stop()
      sessionRef.current = null
    }
  }, [])

  const stopActive = () => {
    sessionRef.current?.stop()
    sessionRef.current = null
  }

  const toggle = (id: string) => {
    if (activeId === id) {
      stopActive()
      setActiveId(null)
      setCurrentIdx(-1)
      return
    }
    stopActive()
    const topic = GROUP_TOPICS.find(t => t.id === id)
    if (!topic) return
    setActiveId(id)
    setTranscript([])
    setCurrentIdx(-1)
    setEnded(false)
    sessionRef.current = playGroupConversation(topic, {
      onTurn: (turn, index) => {
        setTranscript(prev => [...prev, { who: turn.who, line: turn.line }])
        setCurrentIdx(index)
      },
      onEnd: () => { setEnded(true); setCurrentIdx(-1) },
    })
  }

  const leave = () => {
    stopActive()
    setActiveId(null)
    setCurrentIdx(-1)
  }

  const activeTopic = GROUP_TOPICS.find(t => t.id === activeId) ?? null

  return (
    <section className="group-talk">
      <header className="group-talk-head">
        <span className="group-talk-kicker">GROUP CONVERSATIONS</span>
        <span className="group-talk-sub">tap a topic to listen in — voices trade lines about it</span>
      </header>

      <div className="group-talk-grid">
        {GROUP_TOPICS.map(topic => {
          const live = activeId === topic.id
          return (
            <button
              key={topic.id}
              type="button"
              className={`group-talk-card${live ? ' live' : ''}`}
              onClick={() => toggle(topic.id)}
              aria-pressed={live}
            >
              <span className="group-talk-glyph" aria-hidden="true">{topic.glyph}</span>
              <span className="group-talk-body">
                <strong>{topic.title}</strong>
                <em>{topic.teaser}</em>
              </span>
              <span className="group-talk-meta">
                {live ? <span className="group-talk-onair">● listening</span> : `${listenersFor(topic.id, tick)} here`}
              </span>
            </button>
          )
        })}
      </div>

      {activeTopic && (
        <div className="group-talk-stage" role="status" aria-live="polite">
          <div className="group-talk-stage-head">
            <span className="group-talk-stage-title">{activeTopic.glyph} {activeTopic.title}</span>
            <button type="button" className="group-talk-leave" onClick={leave}>✕ leave</button>
          </div>
          {noVoices && (
            <p className="group-talk-novoice">your device has no built-in speech voice — you'll hear the room murmur, and the lines appear below.</p>
          )}
          <div className="group-talk-transcript">
            {transcript.map((t, idx) => (
              <p key={idx} className={`group-line group-line--s${t.who}${idx === currentIdx ? ' speaking' : ''}`}>
                <i aria-hidden="true">{SPEAKER_GLYPHS[t.who]}</i>
                <span>{t.line}</span>
              </p>
            ))}
            {!ended ? (
              <p className="group-line group-line--typing"><i aria-hidden="true">∿</i><span>someone's about to speak…</span></p>
            ) : (
              <p className="group-talk-ended">the room went quiet. tap the topic again to listen back.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
