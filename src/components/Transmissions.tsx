import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { BANDS, sendTransmission, listTransmissions, markHeard, replyDueIn } from '../lib/transmissions'
import type { Transmission } from '../lib/transmissions'
import { createVoiceRecorder, micErrorReason } from '../lib/audioBudget'
import { saveRecordingLocally, listLocalRecordings } from '../lib/localAudioStore'
import { moderatePublicSignalText } from '../lib/signalModeration'
import { playSampleBuffer } from '../lib/sampleAudio'
import { useGlobalAudio } from '../hooks/useGlobalAudio'
import { formatRelativeTime } from '../lib/notifications'
import './Transmissions.css'

// "Transmit to a frequency" — no recipients. You speak into a band; a resonant
// carrier echoes back after a drift delay.

async function blobFor(id: string): Promise<Blob | null> {
  try { return (await listLocalRecordings()).find(r => r.id === id)?.blob ?? null } catch { return null }
}

export default function Transmissions() {
  const audio = useGlobalAudio()
  const [band, setBand] = useState(BANDS[0].id)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recMs, setRecMs] = useState(0)
  const [draftBlob, setDraftBlob] = useState<Blob | null>(null)
  const [list, setList] = useState<Transmission[]>([])
  const [now, setNow] = useState(() => Date.now())
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  useEffect(() => { setList(listTransmissions()) }, [])
  // a slow tick surfaces replies as their drift delay elapses + live countdowns
  useEffect(() => {
    const t = window.setInterval(() => { setNow(Date.now()); setList(listTransmissions()) }, 3000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* no-op */ }
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const stopRec = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null }
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop() } catch { /* no-op */ }
    setRecording(false)
  }
  const startRec = async () => {
    setError(null)
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) { setError('this browser can’t record'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = createVoiceRecorder(stream)
      recRef.current = rec
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
        if (blob.size > 0) setDraftBlob(blob)
      }
      rec.start(); startedRef.current = Date.now(); setRecMs(0); setRecording(true)
      timerRef.current = window.setInterval(() => {
        const ms = Date.now() - startedRef.current
        setRecMs(ms)
        if (ms >= 20000) stopRec()
      }, 200)
    } catch (err) {
      const reason = micErrorReason(err)
      setError(reason === 'permission' ? 'microphone permission was declined' : reason === 'device' ? 'no microphone answered' : 'the mic wouldn’t open')
    }
  }

  const transmit = async () => {
    const body = text.trim().replace(/\s+/g, ' ')
    if (!body && !draftBlob) { setError('say something into the band'); return }
    if (body && moderatePublicSignalText(body).status === 'flagged') { setError('that one can’t go out on the band'); return }
    let voiceId: string | undefined
    if (draftBlob) {
      voiceId = crypto.randomUUID?.() ?? `tx-voice-${Date.now()}`
      await saveRecordingLocally({ id: voiceId, label: 'a transmission', durationMs: Math.max(1000, recMs), emotionalTag: 'signal', createdAt: Date.now(), blob: draftBlob }).catch(() => { voiceId = undefined })
    }
    sendTransmission(band, body || '(a wordless transmission)', voiceId)
    setText(''); setDraftBlob(null); setRecMs(0); setError(null)
    setList(listTransmissions())
  }

  const playReply = (t: Transmission) => {
    if (!t.reply) return
    void playSampleBuffer('voice', t.reply.seed, 5000, 0.3)
    markHeard(t.id); setList(listTransmissions())
  }
  const playMine = (voiceId: string) => {
    void blobFor(voiceId).then(b => { if (b) audio.playBlob(b, { id: voiceId, label: 'your transmission', source: 'signals' }) })
  }
  const openCarrier = (handle: string, line: string, seed: number) => {
    window.dispatchEvent(new CustomEvent('ecosphere:viewCarrier', { detail: { handle, line, seed } }))
  }

  return (
    <div className="screen tx-screen">
      <div className="screen-header">
        <div className="screen-kicker">TRANSMISSIONS</div>
        <h2 className="screen-title">speak into a frequency</h2>
        <p className="screen-sub">no names, no inbox — your words drift out and a carrier on the same wave echoes back.</p>
      </div>

      <div className="tx-compose">
        <div className="tx-bands" role="radiogroup" aria-label="frequency band">
          {BANDS.map(b => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={band === b.id}
              className={`tx-band${band === b.id ? ' on' : ''}`}
              title={b.line}
              onClick={() => setBand(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="tx-band-line">{BANDS.find(b => b.id === band)?.line}</p>
        <textarea
          className="tx-input"
          maxLength={200}
          value={text}
          aria-label="your transmission"
          placeholder="transmit into the band…"
          onChange={e => { setText(e.target.value); setError(null) }}
        />
        <div className="tx-compose-row">
          {!draftBlob ? (
            <button type="button" className={`tx-rec${recording ? ' on' : ''}`} onClick={() => (recording ? stopRec() : void startRec())}>
              {recording ? `■ stop · ${(recMs / 1000).toFixed(0)}s` : '● add voice'}
            </button>
          ) : (
            <button type="button" className="tx-rec on" onClick={() => { setDraftBlob(null); setRecMs(0) }}>✕ voice attached · {(recMs / 1000).toFixed(0)}s</button>
          )}
          <button type="button" className="tx-send" onClick={() => void transmit()}>transmit ∿</button>
        </div>
        {error && <span className="tx-error" role="alert">{error}</span>}
      </div>

      <div className="tx-outbox">
        {list.length === 0 ? (
          <p className="tx-empty">nothing transmitted yet. choose a band and speak into it — someone out there is on the same frequency.</p>
        ) : list.map(t => {
          const b = BANDS.find(x => x.id === t.bandId)
          const due = replyDueIn(t, now)
          return (
            <div key={t.id} className="tx-item">
              <div className="tx-mine">
                <span className="tx-mine-band">{b?.label ?? 'a band'}</span>
                <p>{t.text}</p>
                <div className="tx-mine-foot">
                  {t.voiceId && <button type="button" className="tx-play" onClick={() => playMine(t.voiceId!)}>▶ your voice</button>}
                  <span className="tx-time">{formatRelativeTime(t.at)}</span>
                </div>
              </div>
              {t.reply ? (
                <div className={`tx-echo${t.heard ? ' heard' : ''}`}>
                  <span className="tx-echo-mark" aria-hidden="true">∿</span>
                  <div className="tx-echo-body">
                    <button type="button" className="tx-echo-handle" onClick={() => openCarrier(t.reply!.handle, t.reply!.text, t.reply!.seed)}>
                      ◈ {t.reply.handle}
                    </button>
                    <p>"{t.reply.text}"</p>
                    <button type="button" className="tx-play" onClick={() => playReply(t)}>▶ hear the echo</button>
                  </div>
                </div>
              ) : (
                <div className="tx-drifting">drifting through the band… an echo finds you in {due}s</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
