import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { mostReplayedTrace, tracesForSignal } from '../lib/listenerTraces'
import './ListenerTraces.css'

type ListenerTracesProps = {
  signalId: string
  resonance: number
  replayed: boolean
}

/**
 * Tiny pinned scraps under a signal — listener fingerprints. Renders
 * nothing for signals that haven't earned them. Late traces mount while
 * you're still on the page; everything fades in slowly and sits slightly
 * crooked on purpose.
 */
export default function ListenerTraces({ signalId, resonance, replayed }: ListenerTracesProps) {
  const traces = useMemo(() => tracesForSignal(signalId, { replayed, resonance }), [signalId, replayed, resonance])
  const known = useMemo(() => mostReplayedTrace(signalId, resonance), [signalId, resonance])
  const [arrivedIds, setArrivedIds] = useState<string[]>(() => traces.filter(t => t.delayMs === 0).map(t => t.id))

  useEffect(() => {
    const timers = traces
      .filter(t => t.delayMs > 0)
      .map(t => window.setTimeout(() => {
        setArrivedIds(prev => (prev.includes(t.id) ? prev : [...prev, t.id]))
      }, t.delayMs))
    return () => timers.forEach(id => window.clearTimeout(id))
  }, [traces])

  const visible = traces.filter(t => arrivedIds.includes(t.id))
  if (visible.length === 0 && !known) return null

  return (
    <div className="listener-traces" aria-label="listener traces">
      {known && (
        <div className="lt-scrap lt-scrap--known" style={{ '--lt-tilt': '-1.2deg', '--lt-offset': '4%' } as CSSProperties}>
          <em>most replayed trace</em>
          <p>{known}</p>
        </div>
      )}
      {visible.map((trace, index) => (
        <div
          key={trace.id}
          className={`lt-scrap${trace.night ? ' lt-scrap--night' : ''}${index % 2 === 1 ? ' lt-scrap--overlap' : ''}`}
          style={{ '--lt-tilt': `${trace.tilt}deg`, '--lt-offset': `${trace.offset}%` } as CSSProperties}
        >
          <p>{trace.text}</p>
        </div>
      ))}
    </div>
  )
}
