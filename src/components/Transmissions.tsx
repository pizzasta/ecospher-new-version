import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { BANDS, sendTransmission, listTransmissions, markHeard, replyDueIn, setBackendId, attachEcho, pendingBackendIds, myBackendIds } from '../lib/transmissions'
import type { Transmission } from '../lib/transmissions'
import { createVoiceRecorder, micErrorReason } from '../lib/audioBudget'
import { saveRecordingLocally, listLocalRecordings } from '../lib/localAudioStore'
import { moderatePublicSignalText } from '../lib/signalModeration'
import { playSampleBuffer } from '../lib/sampleAudio'
import { useGlobalAudio } from '../hooks/useGlobalAudio'
import { formatRelativeTime, pushLocalNotification } from '../lib/notifications'
import { isSupabaseConfigured } from '../lib/supabase-env'
import { sendBackendTransmission, echoBackendTransmission, fetchOpenTransmissions, fetchEchoes, subscribeTransmissions } from '../lib/backendBridge'
import type { TransmissionRow } from '../lib/backendBridge'
import './Transmissions.css'

function seedFromId(id: string): number {
  let h = 7
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973
  return h
}

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
  const [incoming, setIncoming] = useState<TransmissionRow[]>([])
  const [echoingId, setEchoingId] = useState<string | null>(null)
  const [echoDraft, setEchoDraft] = useState('')
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

  // cross-user layer (no-op offline): attach real echoes to your transmissions,
  // surface open transmissions drifting on the bands, refresh on realtime inserts
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let alive = true
    const refresh = async () => {
      const echoes = await fetchEchoes(pendingBackendIds())
      let gotEcho = false
      echoes.forEach(e => {
        if (e.replyTo) { attachEcho(e.replyTo, { text: e.text, seed: seedFromId(e.id), audioUrl: e.audioUrl, anonymous: true }); gotEcho = true }
      })
      const mine = new Set(myBackendIds())
      const open = await fetchOpenTransmissions(BANDS.map(b => b.id))
      if (!alive) return
      if (gotEcho) { setList(listTransmissions()); pushLocalNotification('new_reaction', 'an echo found your transmission') }
      setIncoming(open.filter(o => !mine.has(o.id)))
    }
    void refresh()
    const t = window.setInterval(() => void refresh(), 8000)
    const unsub = subscribeTransmissions(() => void refresh())
    return () => { alive = false; window.clearInterval(t); unsub() }
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
      const id = crypto.randomUUID?.() ?? `tx-voice-${Date.now()}`
      // saveRecordingLocally resolves false (not reject) when IndexedDB is
      // unavailable — only attach the voice if it actually persisted
      const ok = await saveRecordingLocally({ id, label: 'a transmission', durationMs: Math.max(1000, recMs), emotionalTag: 'signal', createdAt: Date.now(), blob: draftBlob }).catch(() => false)
      if (ok) voiceId = id
    }
    const local = sendTransmission(band, body || '(a wordless transmission)', voiceId)
    const blob = draftBlob
    setText(''); setDraftBlob(null); setRecMs(0); setError(null)
    setList(listTransmissions())
    // fan out to real carriers when a backend is on; the deterministic sim echo
    // is suppressed for backend-backed transmissions (they await a real echo)
    if (isSupabaseConfigured) {
      const bid = await sendBackendTransmission(band, body || '', blob, Math.round(Math.max(1000, recMs) / 1000))
      if (bid) { setBackendId(local.id, bid); setList(listTransmissions()) }
    }
  }

  const playReply = (t: Transmission) => {
    if (!t.reply) return
    if (t.reply.audioUrl) audio.playUrl(t.reply.audioUrl, { id: `echo-${t.id}`, label: 'an echo', source: 'signals' })
    else void playSampleBuffer('voice', t.reply.seed, 5000, 0.3)
    markHeard(t.id); setList(listTransmissions())
  }
  const playMine = (voiceId: string) => {
    void blobFor(voiceId).then(b => { if (b) audio.playBlob(b, { id: voiceId, label: 'your transmission', source: 'signals' }) })
  }
  const openCarrier = (handle: string, line: string, seed: number) => {
    window.dispatchEvent(new CustomEvent('ecosphere:viewCarrier', { detail: { handle, line, seed } }))
  }
  const sendEcho = async (row: TransmissionRow) => {
    const clean = echoDraft.trim().replace(/\s+/g, ' ').slice(0, 200)
    if (!clean) return
    if (moderatePublicSignalText(clean).status === 'flagged') { setError('that echo can’t go out on the band'); return }
    setEchoingId(null); setEchoDraft(''); setError(null)
    setIncoming(prev => prev.filter(o => o.id !== row.id))
    await echoBackendTransmission(row.id, row.band, clean)
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
                    {t.reply.handle ? (
                      <button type="button" className="tx-echo-handle" onClick={() => openCarrier(t.reply!.handle!, t.reply!.text, t.reply!.seed)}>
                        ◈ {t.reply.handle}
                      </button>
                    ) : (
                      <span className="tx-echo-anon">∿ a carrier on your frequency</span>
                    )}
                    <p>"{t.reply.text}"</p>
                    <button type="button" className="tx-play" onClick={() => playReply(t)}>▶ hear the echo</button>
                  </div>
                </div>
              ) : (
                <div className="tx-drifting">drifting through the band{isSupabaseConfigured ? ' — waiting for a carrier to echo' : `… an echo finds you in ${due}s`}</div>
              )}
            </div>
          )
        })}
      </div>

      {incoming.length > 0 && (
        <div className="tx-incoming">
          <span className="tx-incoming-label">drifting on your frequency · echo one back</span>
          {incoming.map(o => {
            const b = BANDS.find(x => x.id === o.band)
            return (
              <div key={o.id} className="tx-incoming-item">
                <span className="tx-incoming-band">{b?.label ?? o.band}</span>
                <p>"{o.text}"</p>
                <div className="tx-incoming-foot">
                  {o.audioUrl && <button type="button" className="tx-play" onClick={() => audio.playUrl(o.audioUrl!, { id: `in-${o.id}`, label: 'a transmission', source: 'signals' })}>▶ hear it</button>}
                  {echoingId === o.id ? (
                    <span className="tx-echo-compose">
                      <input
                        type="text"
                        autoFocus
                        maxLength={200}
                        value={echoDraft}
                        aria-label="echo back"
                        placeholder="echo back…"
                        onChange={e => { setEchoDraft(e.target.value); setError(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') void sendEcho(o); if (e.key === 'Escape') { setEchoingId(null); setEchoDraft('') } }}
                      />
                      <button type="button" onClick={() => void sendEcho(o)}>send ∿</button>
                    </span>
                  ) : (
                    <button type="button" className="tx-echo-btn" onClick={() => { setEchoingId(o.id); setEchoDraft('') }}>∿ echo back</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
