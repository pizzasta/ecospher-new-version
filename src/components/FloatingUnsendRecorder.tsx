import { createVoiceRecorder, micErrorReason } from '../lib/audioBudget'
import './FloatingUnsendRecorder.css'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PlayerStateText } from '../design-system'

type LocalUnsentRecording = {
  id: string
  durationSeconds: number
  createdAt: string
  url: string
}

const maxRecordingSeconds = 15
const minRecordingSeconds = 5

function micErrorMessage(err: unknown): string {
  switch (micErrorReason(err)) {
    case 'permission':
      return 'Microphone permission was not granted.'
    case 'device':
      return 'No microphone was found. Check it is connected and not in use elsewhere.'
    case 'unsupported':
      return 'Recording is not supported in this browser.'
    default:
      return 'The microphone could not be opened. Try again.'
  }
}

export default function FloatingUnsendRecorder() {
  const [isOpen, setIsOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [savedRecordings, setSavedRecordings] = useState<LocalUnsentRecording[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const durationRef = useRef(0)
  const savedUrlsRef = useRef<string[]>([])
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopRecording = useCallback(() => {
    clearTimer()

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    setIsRecording(false)
  }, [clearTimer])

  const saveRecording = useCallback((blob: Blob, durationSeconds: number) => {
    const url = URL.createObjectURL(blob)
    const nextUrls = [url, ...savedUrlsRef.current]
    nextUrls.slice(4).forEach((oldUrl) => URL.revokeObjectURL(oldUrl))
    savedUrlsRef.current = nextUrls.slice(0, 4)

    const nextRecording: LocalUnsentRecording = {
      createdAt: new Date().toISOString(),
      durationSeconds,
      id: crypto.randomUUID(),
      url,
    }

    setSavedRecordings((current) => [nextRecording, ...current].slice(0, 4))

    const savedMeta = {
      createdAt: nextRecording.createdAt,
      durationSeconds: nextRecording.durationSeconds,
      id: nextRecording.id,
    }
    localStorage.setItem('ecosphere:lastUnsentRecording', JSON.stringify(savedMeta))
  }, [])

  const playRecording = useCallback((recording: LocalUnsentRecording) => {
    setPlaybackError(null)

    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current = null
      setPlayingId(null)
    }

    setPlayingId(recording.id)

    const element = new Audio(recording.url)
    element.volume = 0.74
    activeAudioRef.current = element

    element.onerror = () => {
      setPlayingId(null)
      setPlaybackError('audio unavailable')
      activeAudioRef.current = null
    }

    element.onended = () => {
      setPlayingId(null)
      activeAudioRef.current = null
    }

    element.play().catch(() => {
      setPlayingId(null)
      setPlaybackError('tap again to hear it')
      activeAudioRef.current = null
    })
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    chunksRef.current = []
    durationRef.current = 0
    setRecordingSeconds(0)

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = createVoiceRecorder(stream)
      streamRef.current = stream
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const duration = durationRef.current || 1
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stopStream()

        if (blob.size > 0 && duration >= minRecordingSeconds) {
          saveRecording(blob, Math.min(duration, maxRecordingSeconds))
        }

        chunksRef.current = []
      }

      recorder.start()
      setIsRecording(true)

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => {
          const next = current + 1
          durationRef.current = next
          if (next >= maxRecordingSeconds) {
            window.setTimeout(stopRecording, 0)
          }
          return Math.min(next, maxRecordingSeconds)
        })
      }, 1000)
    } catch (err) {
      setError(micErrorMessage(err))
      stopStream()
    }
  }, [saveRecording, stopRecording, stopStream])

  useEffect(() => {
    return () => {
      clearTimer()
      stopStream()
      if (activeAudioRef.current) {
        activeAudioRef.current.pause()
        activeAudioRef.current = null
      }
      savedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [clearTimer, stopStream])

  const canSave = recordingSeconds >= minRecordingSeconds

  return (
    <>
      <button className="floating-unsend-button" onClick={() => setIsOpen(true)} type="button">
        + UNSEND
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="unsend-recorder-modal"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
          >
            <motion.section
              animate={{ filter: 'blur(0px)', opacity: 1, scale: 1, y: 0 }}
              className={`unsend-recorder-panel ${isRecording ? 'is-recording' : ''}`}
              exit={{ filter: 'blur(10px)', opacity: 0, scale: 0.96, y: 16 }}
              initial={{ filter: 'blur(10px)', opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                aria-label="Close unsend recorder"
                className="unsend-recorder-close"
                onClick={() => {
                  stopRecording()
                  setIsOpen(false)
                }}
                type="button"
              >
                x
              </button>

              <p className="unsend-recorder-kicker">UNSENT ROOM // LOCAL ONLY</p>
              <h2>Record what never arrived.</h2>
              <p className="unsend-recorder-copy">Hold the signal between 5 and 15 seconds. Nothing leaves this device.</p>

              <div className="unsend-recorder-waveform" aria-hidden="true">
                {Array.from({ length: 28 }, (_, index) => (
                  <i
                    key={index}
                    style={
                      {
                        '--unsend-wave-delay': `${index * 46}ms`,
                        '--unsend-wave-height': `${22 + ((index * 13 + recordingSeconds * 9) % 58)}%`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>

              <div className="unsend-recorder-timer">
                <strong>{recordingSeconds.toString().padStart(2, '0')}s</strong>
                <span>{canSave ? 'safe to save' : 'minimum 5 seconds'}</span>
              </div>

              {error ? <p className="unsend-recorder-error">{error}</p> : null}

              <div className="unsend-recorder-actions">
                {isRecording ? (
                  <button onClick={stopRecording} type="button">END TRANSMISSION</button>
                ) : (
                  <button onClick={startRecording} type="button">BEGIN RECORDING</button>
                )}
              </div>

              {savedRecordings.length > 0 ? (
                <div className="unsend-recorder-saved">
                  <span>LOCAL SAVES</span>
                  {savedRecordings.map((recording) => (
                    <div
                      className={`unsend-recorder-playback ${playingId === recording.id ? 'is-playing' : ''}`}
                      key={recording.id}
                    >
                      <button
                        type="button"
                        onClick={() => { playRecording(recording) }}
                      >
                        {playingId === recording.id ? 'PLAYING' : 'REPLAY'}
                      </button>
                      <PlayerStateText
                        error={playbackError && playingId === null ? playbackError : null}
                        isPlaying={playingId === recording.id}
                        idle={`${recording.durationSeconds}s local save`}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
