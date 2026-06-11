import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { playSampleBuffer, stopPreviewBuffer } from '../lib/sampleAudio'
import type { SampleKind } from '../lib/sampleAudio'
import './DeepListen.css'

const DRIFT_KINDS: SampleKind[] = ['voice', 'whisper', 'static', 'tone', 'voice', 'whisper']
const BAR_COUNT = 36

/**
 * Deep Listen: no visuals, only audio. A black full-screen surface with a
 * large waveform, one play/pause control, and an exit. Signals drift in an
 * endless sequence — designed for eyes-closed listening.
 */
export default function DeepListen({ onExit }: { onExit: () => void }) {
  const [playing, setPlaying] = useState(false)
  const [segmentCount, setSegmentCount] = useState(0)
  const timerRef = useRef<number | null>(null)
  const playingRef = useRef(false)

  const stopDrift = useCallback(() => {
    playingRef.current = false
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    stopPreviewBuffer()
    setPlaying(false)
  }, [])

  const driftStep = useCallback(() => {
    if (!playingRef.current) return
    const kind = DRIFT_KINDS[Math.floor(Math.random() * DRIFT_KINDS.length)]
    const durationMs = 8000 + Math.floor(Math.random() * 6000)
    void playSampleBuffer(kind, Math.floor(Math.random() * 9000), durationMs, 0.3)
    setSegmentCount(n => n + 1)
    timerRef.current = window.setTimeout(driftStep, durationMs + 600)
  }, [])

  const startDrift = useCallback(() => {
    playingRef.current = true
    setPlaying(true)
    driftStep()
  }, [driftStep])

  useEffect(() => () => stopDrift(), [stopDrift])

  // escape key exits, for keyboard users
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        stopDrift()
        onExit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, stopDrift])

  return (
    <div className="deep-listen" role="dialog" aria-label="Deep listen mode">
      <button
        type="button"
        className="deep-listen-exit"
        onClick={() => { stopDrift(); onExit() }}
      >
        exit
      </button>

      <div className={`deep-listen-wave${playing ? ' live' : ''}`} aria-hidden="true">
        {Array.from({ length: BAR_COUNT }, (_, index) => (
          <i
            key={index}
            style={{
              '--dl-delay': `${(index % 9) * 0.14}s`,
              '--dl-height': `${18 + ((index * 37 + segmentCount * 13) % 70)}%`,
            } as CSSProperties}
          />
        ))}
      </div>

      <button
        type="button"
        className="deep-listen-toggle"
        onClick={playing ? stopDrift : startDrift}
        aria-label={playing ? 'pause' : 'play'}
      >
        {playing ? '❚❚' : '▶'}
      </button>

      <p className="deep-listen-caption">
        {playing ? 'close your eyes. the band is open.' : 'deep listen · no visuals, only audio'}
      </p>
    </div>
  )
}
