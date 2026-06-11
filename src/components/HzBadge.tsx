import type { CSSProperties } from 'react'
import './hz.css'

type HzBadgeProps = {
  hz: number
  displayName?: string | null
  color?: string
  compact?: boolean
}

/**
 * Personal Hz Signature pill: tiny waveform icon + "92.4 Hz" (or the custom
 * display name). Pure props — callers pass values to avoid repeated queries.
 */
export default function HzBadge({ hz, displayName, color = '#66ccff', compact = false }: HzBadgeProps) {
  return (
    <span
      className={`hz-badge${compact ? ' hz-badge--compact' : ''}`}
      style={{ '--hz-color': color } as CSSProperties}
      title={`${hz.toFixed(1)} Hz signature`}
    >
      <i className="hz-badge-wave" aria-hidden="true"><b /><b /><b /></i>
      {displayName ? `${displayName} · ${hz.toFixed(1)}` : `${hz.toFixed(1)} Hz`}
    </span>
  )
}
