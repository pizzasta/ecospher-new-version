import { useEffect } from 'react'
import './NotificationBell.css'

/** Brief auto-dismissing toast (4s). Rendered by whoever owns the message. */
export default function Toast({ text, onDone, durationMs = 4000 }: { text: string; onDone: () => void; durationMs?: number }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, durationMs)
    return () => window.clearTimeout(timer)
  }, [onDone, durationMs])

  return (
    <div className="eco-toast" role="status">
      {text}
    </div>
  )
}
