import { useEffect, useRef, useState } from 'react'
import { currentWhisper, WHISPER_EVERY_MS, WHISPER_VISIBLE_MS } from '../lib/presenceWhispers'
import './PresenceWhisper.css'

// A soft line that passes through the bottom of the screen every minute or
// two: the network noticing you back. Never a notification — no badge, no
// tap target, no urgency. It surfaces, breathes, and dissolves.

export default function PresenceWhisper() {
  const [line, setLine] = useState<string | null>(null)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    const surface = () => {
      setLine(currentWhisper())
      timersRef.current.push(window.setTimeout(() => setLine(null), WHISPER_VISIBLE_MS))
    }
    // first whisper arrives after you've settled in, not on the doorstep
    timersRef.current.push(window.setTimeout(surface, 26_000))
    const cycle = window.setInterval(surface, WHISPER_EVERY_MS)
    const timers = timersRef.current
    return () => {
      window.clearInterval(cycle)
      timers.forEach(id => window.clearTimeout(id))
    }
  }, [])

  if (!line) return null
  return (
    <div className="pwhisper" role="status" aria-live="polite" key={line}>
      <i aria-hidden="true" />
      {line}
    </div>
  )
}
