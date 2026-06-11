import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './recording.css'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// deterministic waveform bars so the same clip always looks the same
function seededBars(seed: number, count: number) {
  let state = seed || 7
  return Array.from({ length: count }, () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return 0.22 + (state / 2147483648) * 0.78
  })
}

type AudioPlayerProps = {
  /** object URL, remote URL, or Blob */
  src: string | Blob
  title?: string
  seed?: number
  /** fallback when the source's metadata duration is unavailable (streams) */
  durationSeconds?: number
}

export default function AudioPlayer({ src, title, seed = 21, durationSeconds }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(durationSeconds ?? 0)
  const bars = useMemo(() => seededBars(seed, 32), [seed])

  const url = useMemo(() => (typeof src === 'string' ? src : URL.createObjectURL(src)), [src])

  useEffect(() => {
    if (typeof src === 'string') return undefined
    return () => URL.revokeObjectURL(url)
  }, [src, url])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setElapsed(audio.currentTime)
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration)
    }
    const onEnd = () => { setPlaying(false); setElapsed(0) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('ended', onEnd)
    }
  }, [url])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  const seek = (value: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = value
    setElapsed(value)
  }

  const total = duration || durationSeconds || 0
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0

  return (
    <div className={`eco-audio-player${playing ? ' playing' : ''}`}>
      <audio ref={audioRef} src={url} preload="metadata" />
      <button type="button" className="eco-player-toggle" onClick={toggle} aria-label={playing ? 'pause' : 'play'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="eco-player-main">
        {title && <span className="eco-player-title">{title}</span>}
        <div className="eco-player-wave" aria-hidden="true">
          {bars.map((height, index) => (
            <i
              key={index}
              className={index / bars.length <= progress ? 'played' : ''}
              style={{ '--bar-h': `${Math.round(height * 100)}%` } as CSSProperties}
            />
          ))}
        </div>
        <input
          className="eco-player-seek"
          type="range"
          min={0}
          max={total || 1}
          step={0.1}
          value={elapsed}
          onChange={event => seek(Number(event.target.value))}
          aria-label="seek"
        />
      </div>
      <span className="eco-player-time">{formatTime(elapsed)} / {formatTime(total)}</span>
    </div>
  )
}
