import { useEffect, useState } from 'react'
import { getFamiliars, familiarReason, stageLabel, isQuiet } from '../lib/familiarFrequency'
import type { FamiliarSignal } from '../lib/familiarFrequency'
import './FamiliarFrequency.css'

// ── Familiar Frequency ────────────────────────────────────────────────────────
// The strip of recurring strangers — people whose signals keep crossing yours.
// Not a social graph. Not a follower list. Not a suggestion engine.
// It's the app noticing a pattern before you consciously registered it.
//
// Rendered as a low-profile horizontal scroll below the feed header.
// Invisible until you have at least one person who's crossed paths 3+ times.
// The less it demands attention, the more meaningful it feels when you notice it.

interface FamiliarFrequencyProps {
  /** Called when user taps a card to hear the last signal from that handle. */
  onPreviewSignal?: (signalId: string, handle: string) => void
  /** If true, renders a compact single-card strip (for observatory use). */
  compact?: boolean
}

export default function FamiliarFrequency({ onPreviewSignal, compact = false }: FamiliarFrequencyProps) {
  const [familiars, setFamiliars] = useState<FamiliarSignal[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setFamiliars(getFamiliars())
  }, [])

  if (familiars.length === 0) return null

  const visible = compact
    ? familiars.slice(0, 1)
    : expanded
      ? familiars
      : familiars.slice(0, 4)

  const hasMore = !compact && !expanded && familiars.length > 4

  return (
    <div className="familiar-frequency">
      <div className="familiar-frequency__label">
        in your field
      </div>

      <div className="familiar-frequency__strip">
        {visible.map((f, i) => (
          <FamiliarCard
            key={f.handle}
            familiar={f}
            index={i}
            onPreviewSignal={onPreviewSignal}
          />
        ))}

        {hasMore && (
          <button
            className="ff-card ff-card--more"
            onClick={() => { setExpanded(true) }}
            aria-label={`Show ${familiars.length - 4} more familiar frequencies`}
          >
            <span className="ff-card__handle">+{familiars.length - 4} more</span>
            <span className="ff-card__stage">in the field</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ── FamiliarCard ──────────────────────────────────────────────────────────────

interface FamiliarCardProps {
  familiar: FamiliarSignal
  index: number
  onPreviewSignal?: (signalId: string, handle: string) => void
}

function FamiliarCard({ familiar: f, index, onPreviewSignal }: FamiliarCardProps) {
  const quiet = isQuiet(f)
  const lastSignalId = f.signalIds[0]

  const handleClick = () => {
    if (onPreviewSignal && lastSignalId) onPreviewSignal(lastSignalId, f.handle)
    // a recurring stranger is exactly who you'd want to check out — open them
    window.dispatchEvent(new CustomEvent('ecosphere:viewCarrier', { detail: { handle: f.handle, line: f.lastContent } }))
  }

  const classNames = [
    'ff-card',
    `ff-card--${f.stage}`,
    quiet ? 'ff-card--quiet' : '',
  ].filter(Boolean).join(' ')

  const style = { animationDelay: `${index * 80}ms` }

  return (
    <div
      className={classNames}
      style={style}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      aria-label={`open ${f.handle} — ${stageLabel(f.stage)}`}
    >
      {quiet && <span className="ff-card__quiet-badge">quiet</span>}

      <div className="ff-card__handle">{f.handle}</div>
      <div className="ff-card__stage">{stageLabel(f.stage)}</div>

      {f.moods.length > 0 && (
        <div className="ff-card__moods" aria-hidden="true">
          {f.moods.slice(0, 4).map(mood => (
            <span
              key={mood}
              className={`ff-card__mood-dot ff-card__mood-dot--${mood}`}
            />
          ))}
        </div>
      )}

      {f.lastContent && (
        <div className="ff-card__content">
          &ldquo;{f.lastContent}&rdquo;
        </div>
      )}

      <div className="ff-card__reason">{familiarReason(f)}</div>
    </div>
  )
}
