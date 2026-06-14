import type { CSSProperties, ReactNode } from 'react'

export const designTokens = {
  colors: {
    black: '#050708',
    deepPurple: '#0f061f',
    cyan: '#67e8f9',
    magenta: '#f472b6',
    violet: '#a78bfa',
    amber: '#fb923c',
    text: '#f8fafc',
    muted: '#e9d5ff',
  },
  motion: {
    fast: '180ms ease',
    normal: '220ms ease',
    slow: '520ms ease',
  },
  surfaces: {
    glass: 'rgba(7, 5, 22, 0.62)',
    border: 'rgba(255, 255, 255, 0.14)',
  },
} as const

type CinematicHeaderProps = {
  className: string
  kickerClassName: string
  kicker: string
  title: string
  subtitle: string
  children?: ReactNode
}

export function CinematicHeader({
  className,
  kickerClassName,
  kicker,
  title,
  subtitle,
  children,
}: CinematicHeaderProps) {
  return (
    <header className={className}>
      <div>
        <p className={kickerClassName}>{kicker}</p>
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
      {children}
    </header>
  )
}

type FloatingDockProps = {
  items: string[]
  activeItem: string
  onSelect: (item: string) => void
}

export function FloatingDock({ items, activeItem, onSelect }: FloatingDockProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => (
        <button className={activeItem === item ? 'active' : ''} key={item} onClick={() => onSelect(item)} type="button">
          <span />
          {item}
        </button>
      ))}
    </nav>
  )
}

type CategoryTabsProps = {
  items: string[]
  activeItem?: string
  className: string
}

export function CategoryTabs({ items, activeItem = items[0], className }: CategoryTabsProps) {
  return (
    <section className={className} aria-label="Category filters">
      {items.map((item) => (
        <button className={item === activeItem ? 'active' : ''} key={item} type="button">
          {item}
        </button>
      ))}
    </section>
  )
}

type AtmosphereBackgroundProps = {
  className: string
  count?: number
  delayVar?: string
  seedX?: number
  seedY?: number
  stepX?: number
  stepY?: number
  delayStep?: number
}

export function AtmosphereBackground({
  className,
  count = 14,
  delayVar = '--ambient-delay',
  seedX = 7,
  seedY = 11,
  stepX = 19,
  stepY = 23,
  delayStep = 180,
}: AtmosphereBackgroundProps) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          style={
            {
              left: `${(index * stepX + seedX) % 100}%`,
              top: `${(index * stepY + seedY) % 100}%`,
              [delayVar]: `${index * delayStep}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

type SignalMeterProps = {
  className: string
  value: number
  label: string
  strongClassName?: string
}

export function SignalMeter({ className, value, label }: SignalMeterProps) {
  return (
    <div className={className} aria-label={label}>
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <i>
        <b style={{ width: `${value}%` }} />
      </i>
    </div>
  )
}

export function SimpleMeter({ className, value, label }: SignalMeterProps) {
  return (
    <div className={className} aria-label={label}>
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <i style={{ width: `${value}%` }} />
    </div>
  )
}

type StatusBadgeProps = {
  value: string
  className: string
  as?: 'b' | 'span'
}

export function StatusBadge({ value, className, as = 'b' }: StatusBadgeProps) {
  if (as === 'span') {
    return <span className={className}>{value}</span>
  }
  return <b className={className}>{value}</b>
}

type WaveformPreviewProps = {
  bars: number
  className?: string
  active?: boolean
  ariaLabel?: string
  delayStep?: number
  strength?: number
}

export function WaveformPreview({
  bars,
  className = 'frequency-waveform',
  active = false,
  ariaLabel,
  delayStep = 90,
  strength = 64,
}: WaveformPreviewProps) {
  return (
    <div className={`${className} animated-waveform ${active ? 'active' : ''}`} aria-hidden={ariaLabel ? undefined : true} aria-label={ariaLabel}>
      {Array.from({ length: bars }, (_, index) => (
        <i
          key={index}
          style={
            {
              '--wave-delay': `${index * delayStep}ms`,
              '--cassette-delay': `${index * delayStep}ms`,
              '--wave-height': `${22 + ((strength + index * 13) % 52)}%`,
              '--wave-index': index,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

export function LivePulseIndicator() {
  return <i className="live-pulse-indicator" aria-hidden="true" />
}

export function SignalOrb({ className, children }: { className: string; children?: ReactNode }) {
  return (
    <div className={className} aria-hidden="true">
      {children}
    </div>
  )
}

export function GlowCard({
  className,
  children,
  as = 'article',
}: {
  className: string
  children: ReactNode
  as?: 'article' | 'section' | 'aside'
}) {
  if (as === 'section') {
    return <section className={className}>{children}</section>
  }
  if (as === 'aside') {
    return <aside className={className}>{children}</aside>
  }
  return <article className={className}>{children}</article>
}

export function NeonButton({ children, className }: { children: ReactNode; className: string }) {
  return (
    <button className={className} type="button">
      {children}
    </button>
  )
}
