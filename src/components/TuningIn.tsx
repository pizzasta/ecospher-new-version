import { useEffect, useRef, useState } from 'react'
import TypewriterText from './TypewriterText'
import RoomAtmosphere from './RoomAtmosphere'
import './TuningIn.css'

// A brief one-time beat between the age gate and the tour: arriving should feel
// like tuning into a hidden late-night frequency, not loading a dashboard.
// Short, skippable, and reduced-motion aware (passes straight through).

const BOOT_LINES = [
  'restoring dormant frequencies',
  'reconnecting lost carriers',
  'stabilizing the nocturne band',
  'signal detected nearby',
]

const HOLD_MS = 2600

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export default function TuningIn({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const doneRef = useRef(false)

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    setLeaving(true)
    window.setTimeout(onDone, 460)
  }

  useEffect(() => {
    if (prefersReducedMotion()) {
      onDone()
      return
    }
    const t = window.setTimeout(finish, HOLD_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`tuning-in${leaving ? ' tuning-in--leaving' : ''}`} role="status" aria-live="polite">
      <RoomAtmosphere accent="#00d4ff" density="full" />
      <div className="tuning-in-core">
        <span className="tuning-in-glyph" aria-hidden="true">∿</span>
        <span className="tuning-in-kicker">tuning you in</span>
        <TypewriterText className="tuning-in-lines" lines={BOOT_LINES} speedMs={34} linePauseMs={260} />
      </div>
      <button type="button" className="tuning-in-skip" onClick={finish}>skip ⇥</button>
    </div>
  )
}
