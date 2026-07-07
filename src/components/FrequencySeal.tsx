import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import './FrequencySeal.css'

// FrequencySeal — the Hz symbol, rebuilt as an instrument reading instead of
// a typed character. Your signature frequency is rendered as a circular
// spectrum: a ring of radial ticks whose amplitudes are computed from your
// Hz, phase-shaped by your chosen sigil. No two signatures draw the same
// seal, the same signature always draws the same one, and it slowly turns —
// a live reading, not an icon.

interface FrequencySealProps {
  hz: number
  color?: string
  /** sigil id — shapes the harmonic profile so the mark stays yours */
  sigil?: string
  size?: number
  /** center content: the hz readout (default) or the raw sigil glyph */
  center?: 'hz' | 'glyph'
  glyph?: string
  /** static seals for dense lists; spinning for identity moments */
  spin?: boolean
  className?: string
}

const TICKS = 48

function hashString(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 0x7fffffff
  return h
}

/** Deterministic spectrum: three harmonics whose mix is (hz, sigil)-seeded. */
function amplitudes(hz: number, sigil: string): number[] {
  const seed = hashString(sigil || 'hz') % 977
  const base = hz / 10
  return Array.from({ length: TICKS }, (_, i) => {
    const t = (i / TICKS) * Math.PI * 2
    const a =
      Math.sin(t * (2 + (seed % 3)) + base) * 0.5 +
      Math.sin(t * (5 + (seed % 4)) + base * 1.7 + seed) * 0.3 +
      Math.sin(t * (9 + (seed % 5)) + base * 0.4 + seed * 2) * 0.2
    return 0.25 + ((a + 1) / 2) * 0.75 // 0.25..1 so the ring never breaks
  })
}

export default function FrequencySeal({
  hz, color = '#66ccff', sigil = 'hz', size = 56, center = 'hz', glyph, spin = true, className = '',
}: FrequencySealProps) {
  const amps = useMemo(() => amplitudes(hz, sigil), [hz, sigil])
  const R = 50
  const inner = 30
  const span = 14

  return (
    <span
      className={`fseal${spin ? ' fseal--spin' : ''} ${className}`}
      style={{ '--fseal-color': color, width: size, height: size, fontSize: Math.round(size * 0.26) } as CSSProperties}
      role="img"
      aria-label={`${hz.toFixed(1)} hertz signature seal`}
    >
      <svg viewBox="0 0 100 100" className="fseal-svg" aria-hidden="true">
        <circle cx="50" cy="50" r={R - 1.5} fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" />
        <circle cx="50" cy="50" r={inner - 4} fill="currentColor" opacity="0.07" />
        <g className="fseal-ticks">
          {amps.map((a, i) => {
            const angle = (i / TICKS) * Math.PI * 2 - Math.PI / 2
            const r0 = inner
            const r1 = inner + span * a
            const x0 = 50 + Math.cos(angle) * r0
            const y0 = 50 + Math.sin(angle) * r0
            const x1 = 50 + Math.cos(angle) * r1
            const y1 = 50 + Math.sin(angle) * r1
            return (
              <line
                key={i}
                x1={x0} y1={y0} x2={x1} y2={y1}
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeOpacity={0.45 + a * 0.55}
              />
            )
          })}
        </g>
        {/* cardinal marks — the instrument's bezel */}
        {[0, 90, 180, 270].map(deg => {
          const rad = (deg * Math.PI) / 180 - Math.PI / 2
          return (
            <line
              key={deg}
              x1={50 + Math.cos(rad) * (R - 5)} y1={50 + Math.sin(rad) * (R - 5)}
              x2={50 + Math.cos(rad) * (R - 1.5)} y2={50 + Math.sin(rad) * (R - 1.5)}
              stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.6"
            />
          )
        })}
      </svg>
      <span className="fseal-center">
        {center === 'glyph' && glyph ? (
          <span className="fseal-glyph">{glyph}</span>
        ) : (
          <>
            <b className="fseal-hz">{hz.toFixed(1)}</b>
            <i className="fseal-unit">Hz</i>
          </>
        )}
      </span>
    </span>
  )
}
