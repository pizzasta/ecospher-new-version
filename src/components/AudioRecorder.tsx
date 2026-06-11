import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import AudioPlayer from './AudioPlayer'
import { useRecordingSession } from '../hooks/useRecordingSession'
import { AUDIO_UPLOAD_LIMITS } from '../lib/library'
import type { AudioMessageKind } from '../lib/library'
import './recording.css'

const LIVE_BAR_COUNT = 22

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export type FinishedRecording = {
  blob: Blob
  durationMs: number
  uploadId: string
}

type AudioRecorderProps = {
  kind: AudioMessageKind
  roomId?: string
  /** label baked into the stored title, e.g. a signal id or room name */
  context?: string
  prompt?: string
  minSeconds?: number
  maxSeconds?: number
  onComplete?: (recording: FinishedRecording) => void
}

type RecorderState = 'idle' | 'denied' | 'recording' | 'preview'

export default function AudioRecorder({
  kind,
  roomId,
  context,
  prompt,
  minSeconds = AUDIO_UPLOAD_LIMITS.minSeconds,
  maxSeconds = AUDIO_UPLOAD_LIMITS.maxSeconds,
  onComplete,
}: AudioRecorderProps) {
  const session = useRecordingSession()
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ blob: Blob; durationMs: number } | null>(null)
  const [liveBars, setLiveBars] = useState(() => Array.from({ length: LIVE_BAR_COUNT }, () => 0.16))

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const frameRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)

  const cleanupCapture = useCallback(() => {
    if (timerRef.current !== null) { window.clearInterval(timerRef.current); timerRef.current = null }
    if (frameRef.current !== null) { cancelAnimationFrame(frameRef.current); frameRef.current = null }
    analyserRef.current?.disconnect()
    analyserRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (audioCtxRef.current) { void audioCtxRef.current.close(); audioCtxRef.current = null }
    setLiveBars(Array.from({ length: LIVE_BAR_COUNT }, () => 0.16))
  }, [])

  useEffect(() => () => {
    cleanupCapture()
    session.setRecordingActive(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  const startRecording = async () => {
    if (state === 'recording') return
    setNote(null)
    setPreview(null)

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState('denied')
      setNote('this device has no way to listen — recording unavailable')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        cleanupCapture()
        session.setRecordingActive(false)

        if (durationMs < minSeconds * 1000) {
          setState('idle')
          setElapsed(0)
          setNote(`too short — hold it for at least ${minSeconds} seconds`)
          return
        }

        setPreview({ blob, durationMs })
        setState('preview')
      }

      // live waveform straight off the mic
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioContextCtor) {
        const ctx = new AudioContextCtor()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 128
        analyser.smoothingTimeConstant = 0.7
        source.connect(analyser)
        audioCtxRef.current = ctx
        analyserRef.current = analyser
        const data = new Uint8Array(analyser.frequencyBinCount)
        const sample = (timestamp = 0) => {
          if (timestamp - lastFrameRef.current > 60) {
            lastFrameRef.current = timestamp
            analyser.getByteFrequencyData(data)
            const stride = Math.max(1, Math.floor(data.length / LIVE_BAR_COUNT))
            setLiveBars(Array.from({ length: LIVE_BAR_COUNT }, (_, index) => Math.max(0.12, (data[index * stride] ?? 0) / 255)))
          }
          frameRef.current = requestAnimationFrame(sample)
        }
        sample()
      }

      recorderRef.current = recorder
      recorder.start()
      startedAtRef.current = Date.now()
      setElapsed(0)
      setState('recording')
      session.setRecordingActive(true)

      timerRef.current = window.setInterval(() => {
        const seconds = (Date.now() - startedAtRef.current) / 1000
        setElapsed(seconds)
        if (seconds >= maxSeconds) stopRecording()
      }, 250)
    } catch {
      cleanupCapture()
      setState('denied')
      setNote('microphone access was not opened — your signal stays quiet for now')
    }
  }

  const discard = () => {
    setPreview(null)
    setElapsed(0)
    setState('idle')
    setNote(null)
  }

  const upload = () => {
    if (!preview) return
    const title = context ? `${kind} · ${context}` : `${kind} transmission`
    const uploadId = session.enqueueUpload({
      title,
      kind,
      roomId,
      durationMs: preview.durationMs,
      blob: preview.blob,
    })
    onComplete?.({ blob: preview.blob, durationMs: preview.durationMs, uploadId })
    setPreview(null)
    setElapsed(0)
    setState('idle')
  }

  return (
    <div className={`eco-recorder eco-recorder--${state}`}>
      {prompt && <p className="eco-recorder-prompt">{prompt}</p>}

      {state === 'recording' && (
        <div className="eco-recorder-live">
          <span className="eco-recorder-dot" aria-hidden="true" />
          <div className="eco-recorder-wave" aria-hidden="true">
            {liveBars.map((level, index) => (
              <i key={index} style={{ '--live-h': `${Math.round(level * 100)}%` } as CSSProperties} />
            ))}
          </div>
          <span className="eco-recorder-timer">{formatTimer(elapsed)} / {formatTimer(maxSeconds)}</span>
        </div>
      )}

      {state === 'preview' && preview && (
        <div className="eco-recorder-preview">
          <AudioPlayer src={preview.blob} seed={Math.round(preview.durationMs)} durationSeconds={preview.durationMs / 1000} />
        </div>
      )}

      <div className="eco-recorder-actions">
        {state !== 'recording' && state !== 'preview' && (
          <button type="button" className="eco-recorder-btn eco-recorder-btn--record" onClick={() => { void startRecording() }}>
            ● record
          </button>
        )}
        {state === 'recording' && (
          <button type="button" className="eco-recorder-btn eco-recorder-btn--stop" onClick={stopRecording}>
            ◼ stop
          </button>
        )}
        {state === 'preview' && (
          <>
            <button type="button" className="eco-recorder-btn eco-recorder-btn--send" onClick={upload}>
              ↑ send it out
            </button>
            <button type="button" className="eco-recorder-btn" onClick={discard}>
              discard
            </button>
          </>
        )}
      </div>

      {note && <p className="eco-recorder-note" role="status">{note}</p>}
      <span className="eco-recorder-hint">{minSeconds}–{maxSeconds} seconds · stored privately unless shared</span>
    </div>
  )
}
