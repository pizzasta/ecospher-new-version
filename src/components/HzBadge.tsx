import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import './hz.css'

type HzBadgeProps = {
  hz: number
  displayName?: string | null
  color?: string
  compact?: boolean
}

/**
 * Personal Hz Signature pill: a miniature spectrum readout + "92.4 Hz" (or
 * the custom display name). The bars are computed from the Hz itself — every
 * signature draws its own reading, deterministically. Pure props.
 */
export default function HzBadge({ hz, displayName, color = '#66ccff', compact = false }: HzBadgeProps) {
  // seven deterministic spectrum bars — the signature's fingerprint in miniature
  const bars = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const t = (i / 7) * Math.PI * 2
    const a = Math.sin(t * 2 + hz / 10) * 0.5 + Math.sin(t * 5 + hz / 4) * 0.35 + Math.sin(t * 9 + hz) * 0.15
    return Math.round((0.3 + ((a + 1) / 2) * 0.7) * 100)
  }), [hz])

  return (
    <span
      className={`hz-badge${compact ? ' hz-badge--compact' : ''}`}
      style={{ '--hz-color': color } as CSSProperties}
      title={`${hz.toFixed(1)} Hz signature`}
    >
      <i className="hz-badge-wave hz-badge-wave--spectrum" aria-hidden="true">
        {bars.map((h, i) => <b key={i} style={{ '--bar': `${h}%` } as CSSProperties} />)}
      </i>
      {displayName ? `${displayName} · ${hz.toFixed(1)}` : `${hz.toFixed(1)} Hz`}
    </span>
  )
}
