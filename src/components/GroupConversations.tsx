import { useEffect, useRef, useState, useCallback } from 'react'
import {
  GROUP_TOPICS, playGroupConversation, loadCustomTopics, createCustomTopic, addLineToCustom, isCustomTopic,
} from '../lib/groupTalk'
import type { GroupSession, GroupTopic } from '../lib/groupTalk'
import { speechSupported } from '../lib/speech'
import { createVoiceRecorder } from '../lib/audioBudget'
import { groupRoomsEnabled, fetchGroupVoices, dropGroupVoice, subscribeGroupVoices } from '../lib/groupRooms'
import type { GroupVoice } from '../lib/groupRooms'
import { useGlobalAudio } from '../hooks/useGlobalAudio'
import VoiceConsentNotice from './VoiceConsentNotice'
import { voiceNoticeSeen, markVoiceNoticeSeen } from '../lib/voiceNotice'

// Tap a topic and hear a small anonymous group talking about it — real device
// voices trading short lines, over a low murmur of others. You can start your
// own group, and (when the backend is on) drop a real screened voice clip that
// others in the group actually hear.

const SPEAKER_GLYPHS = ['◍', '◐', '◑', '◒']
const RECORD_CAP_MS = 10000

function listenersFor(id: string, tick: number): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return 3 + ((h + tick) % 9)
}

export default function GroupConversations() {
  const audio = useGlobalAudio()
  const [custom, setCustom] = useState<GroupTopic[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<{ who: number; line: string }[]>([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [ended, setEnded] = useState(false)
  const [tick, setTick] = useState(0)
  const sessionRef = useRef<GroupSession | null>(null)
  const noVoices = !speechSupported()

  // start-a-group form
  const [showForm, setShowForm] = useState(false)
  const [gTitle, setGTitle] = useState('')
  const [gLine, setGLine] = useState('')
  const [gError, setGError] = useState<string | null>(null)

  // add-a-line composer (custom groups)
  const [addText, setAddText] = useState('')

  // real voices (backend)
  const [voices, setVoices] = useState<GroupVoice[]>([])
  const [caption, setCaption] = useState('')
  const [consent, setConsent] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedDur, setRecordedDur] = useState(0)
  const [dropping, setDropping] = useState(false)
  const [dropError, setDropError] = useState<string | null>(null)
  const [showVoiceNotice, setShowVoiceNotice] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recStartRef = useRef(0)
  const recTimerRef = useRef(0)

  useEffect(() => { setCustom(loadCustomTopics()) }, [])

  useEffect(() => {
    const t = window.setInterval(() => setTick(n => n + 1), 5000)
    return () => {
      window.clearInterval(t)
      sessionRef.current?.stop()
      sessionRef.current = null
      streamRef.current?.getTracks().forEach(tr => tr.stop())
      window.clearTimeout(recTimerRef.current)
    }
  }, [])

  const allTopics = [...custom, ...GROUP_TOPICS]
  const activeTopic = allTopics.find(t => t.id === activeId) ?? null

  // load + live-refresh the real voices for whichever group is open
  const refreshVoices = useCallback((id: string) => {
    void fetchGroupVoices(id).then(setVoices)
  }, [])

  useEffect(() => {
    if (!activeId || !groupRoomsEnabled) { setVoices([]); return }
    let cancelled = false
    const load = () => { void fetchGroupVoices(activeId).then(v => { if (!cancelled) setVoices(v) }) }
    load()
    const unsub = subscribeGroupVoices(activeId, load)
    return () => { cancelled = true; unsub() }
  }, [activeId])

  const stopActive = () => {
    sessionRef.current?.stop()
    sessionRef.current = null
  }

  const startConversation = (topic: GroupTopic) => {
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

  const toggle = (id: string) => {
    if (activeId === id) { stopActive(); setActiveId(null); setCurrentIdx(-1); return }
    stopActive()
    const topic = allTopics.find(t => t.id === id)
    if (!topic) return
    setActiveId(id)
    startConversation(topic)
  }

  const leave = () => {
    stopActive()
    setActiveId(null)
    setCurrentIdx(-1)
    resetRecorder()
  }

  const submitNewGroup = () => {
    const result = createCustomTopic(gTitle, gLine)
    if ('error' in result) { setGError(result.error); return }
    setCustom(loadCustomTopics())
    setGTitle(''); setGLine(''); setGError(null); setShowForm(false)
    setActiveId(result.topic.id)
    startConversation(result.topic)
  }

  const submitAddLine = () => {
    if (!activeTopic) return
    const updated = addLineToCustom(activeTopic.id, addText)
    if (!updated) return
    setCustom(loadCustomTopics())
    setAddText('')
    // replay so the new line is heard in context
    stopActive()
    startConversation(updated)
  }

  // ─── real voice recorder ───────────────────────────────────────────────
  const resetRecorder = () => {
    window.clearTimeout(recTimerRef.current)
    if (recRef.current && recRef.current.state !== 'inactive') { try { recRef.current.stop() } catch { /* idle */ } }
    streamRef.current?.getTracks().forEach(tr => tr.stop())
    streamRef.current = null
    setRecording(false)
    setRecordedBlob(null)
    setRecordedDur(0)
    setCaption('')
    setConsent(false)
    setDropError(null)
  }

  const startRecording = async () => {
    setDropError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = createVoiceRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setRecordedBlob(blob)
        setRecordedDur(Math.max(3, Math.round((Date.now() - recStartRef.current) / 1000)))
        streamRef.current?.getTracks().forEach(tr => tr.stop())
        streamRef.current = null
        setRecording(false)
      }
      recRef.current = rec
      recStartRef.current = Date.now()
      rec.start()
      setRecording(true)
      recTimerRef.current = window.setTimeout(() => stopRecording(), RECORD_CAP_MS)
    } catch {
      setDropError('mic permission is needed to drop a voice')
    }
  }

  const stopRecording = () => {
    window.clearTimeout(recTimerRef.current)
    if (recRef.current && recRef.current.state !== 'inactive') { try { recRef.current.stop() } catch { /* idle */ } }
  }

  const submitDrop = async () => {
    if (!recordedBlob || !activeId) return
    if (!consent) { setDropError('check the box — others will hear this'); return }
    setDropping(true); setDropError(null)
    const res = await dropGroupVoice(activeId, recordedBlob, recordedDur, caption)
    setDropping(false)
    if (!res.ok) { setDropError(res.error); return }
    resetRecorder()
    refreshVoices(activeId)
  }

  const playVoice = (v: GroupVoice) => {
    void audio.playUrl(v.url, { id: `gv-${v.id}`, label: 'a voice in the group', source: 'rooms' })
  }

  return (
    <section className="group-talk">
      {showVoiceNotice && (
        <VoiceConsentNotice
          onClose={() => setShowVoiceNotice(false)}
          onAccept={() => { markVoiceNoticeSeen(); setShowVoiceNotice(false); void startRecording() }}
        />
      )}
      <header className="group-talk-head">
        <span className="group-talk-kicker">GROUP CONVERSATIONS</span>
        <span className="group-talk-sub">tap a topic to listen in — voices trade lines about it</span>
      </header>

      <div className="group-talk-grid">
        {allTopics.map(topic => {
          const live = activeId === topic.id
          const mine = isCustomTopic(topic.id)
          return (
            <button
              key={topic.id}
              type="button"
              className={`group-talk-card${live ? ' live' : ''}${mine ? ' mine' : ''}`}
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

        {/* start your own group */}
        <button type="button" className="group-talk-card group-talk-card--new" onClick={() => setShowForm(s => !s)}>
          <span className="group-talk-glyph" aria-hidden="true">＋</span>
          <span className="group-talk-body">
            <strong>start a group</strong>
            <em>name a topic, say the first line</em>
          </span>
        </button>
      </div>

      {showForm && (
        <div className="group-talk-form">
          <input
            type="text" value={gTitle} maxLength={40}
            placeholder="topic — e.g. moving back home"
            onChange={e => setGTitle(e.target.value)}
          />
          <input
            type="text" value={gLine} maxLength={90}
            placeholder="your first line — like something you'd actually say"
            onChange={e => setGLine(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitNewGroup() }}
          />
          <div className="group-talk-form-row">
            {gError && <span className="group-talk-error">{gError}</span>}
            <button type="button" className="group-talk-form-go" onClick={submitNewGroup}>open it</button>
          </div>
        </div>
      )}

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
              <p className="group-talk-ended">the room went quiet.</p>
            )}
          </div>

          {/* custom group: add another line to the conversation */}
          {isCustomTopic(activeTopic.id) && (
            <div className="group-talk-addline">
              <input
                type="text" value={addText} maxLength={90}
                placeholder="add a line to this group…"
                onChange={e => setAddText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitAddLine() }}
              />
              <button type="button" onClick={submitAddLine}>add</button>
            </div>
          )}

          {/* real human voices dropped into this group (backend on) */}
          {groupRoomsEnabled && (
            <div className="group-talk-real">
              <div className="group-talk-real-head">
                <span>real voices in this group</span>
                <small>{voices.length ? `${voices.length} dropped` : 'none yet — be the first'}</small>
              </div>
              {voices.map(v => (
                <div key={v.id} className="group-talk-voice">
                  <button type="button" className="group-talk-voice-play" onClick={() => playVoice(v)} aria-label="play this voice">▶</button>
                  <span className="group-talk-voice-line">{v.line}</span>
                </div>
              ))}

              <div className="group-talk-drop">
                {!recordedBlob ? (
                  <button
                    type="button"
                    className={`group-talk-rec${recording ? ' recording' : ''}`}
                    onClick={() => {
                      if (recording) { stopRecording(); return }
                      if (!voiceNoticeSeen()) { setShowVoiceNotice(true); return }
                      void startRecording()
                    }}
                  >
                    {recording ? '■ stop (max 10s)' : '● drop your voice'}
                  </button>
                ) : (
                  <div className="group-talk-drop-form">
                    <input
                      type="text" value={caption} maxLength={90}
                      placeholder="one line, so others know what they're hearing"
                      onChange={e => setCaption(e.target.value)}
                    />
                    <label className="group-talk-consent">
                      <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
                      others can hear this once it's screened. no names attached.
                    </label>
                    <div className="group-talk-drop-actions">
                      <button type="button" className="group-talk-drop-cancel" onClick={resetRecorder}>discard</button>
                      <button type="button" className="group-talk-drop-go" disabled={dropping} onClick={submitDrop}>
                        {dropping ? 'screening…' : 'drop into group'}
                      </button>
                    </div>
                  </div>
                )}
                {dropError && <span className="group-talk-error">{dropError}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
