import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type SignalStatus = 'live' | 'fading' | 'drifting' | 'archiving' | 'corrupted' | 'resonating'
type SignalType = 'voice_note' | 'drifting_thought' | 'unresolved_echo' | 'static_bloom' | 'dead_zone' | 'memory_fragment' | 'nocturne_broadcast' | 'abandoned_carrier'
type Mood = 'nocturne' | 'bloom' | 'drift' | 'static' | 'lost'
type ExportType = 'tiktok' | 'story' | 'relic' | 'drift' | 'remix'
type ReactionType = 'drift' | 'bloom' | 'echo' | 'static' | 'nocturne' | 'fracture'

type SignalReactions = {
  [K in ReactionType]?: boolean
}


type FeedSignal = {
  id: string
  handle: string
  timeAgo: string
  content: string
  mood: Mood
  resonance: number
  anonymous: boolean
  duration: string
  type: SignalType
  status: SignalStatus
  emotionalBand: string
  waveformSeed: number
  typewriterEffect?: boolean
  expiresIn?: number
}

type EcosystemEvent = {
  id: string
  message: string
  visible: boolean
}

type Particle = {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  speedX: number
  speedY: number
  color: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FEED_SIGNALS: FeedSignal[] = [
  { id: 'f1', handle: 'anonymous_03:14', timeAgo: '2m ago', content: 'still awake. the quiet feels different tonight. like something is about to remember itself.', mood: 'nocturne', resonance: 94, anonymous: true, duration: '0:38', type: 'nocturne_broadcast', status: 'resonating', emotionalBand: 'nocturne-depth', waveformSeed: 42, typewriterEffect: true },
  { id: 'f2', handle: 'signal_veil', timeAgo: 'currently resonating', content: 'replaying that moment again. the part before everything shifted. i keep landing in the same second.', mood: 'drift', resonance: 87, anonymous: false, duration: '1:04', type: 'unresolved_echo', status: 'live', emotionalBand: 'drift-loop', waveformSeed: 17 },
  { id: 'f3', handle: 'anonymous_fade', timeAgo: 'fading', content: 'static bloom opened near the eastern band. something warm is inside the noise.', mood: 'static', resonance: 79, anonymous: true, duration: '0:22', type: 'static_bloom', status: 'fading', emotionalBand: 'static-warm', waveformSeed: 88, expiresIn: 180 },
  { id: 'f4', handle: 'lost_carrier_7', timeAgo: 'drifting', content: 'there are frequencies you only hear when no one else is listening. late night internet knows this.', mood: 'lost', resonance: 63, anonymous: false, duration: '0:51', type: 'abandoned_carrier', status: 'drifting', emotionalBand: 'lost-frequency', waveformSeed: 31 },
  { id: 'f5', handle: 'anonymous_0:48', timeAgo: 'archiving soon', content: 'the ecosystem held the channel open. like it was waiting.', mood: 'bloom', resonance: 91, anonymous: true, duration: '0:44', type: 'memory_fragment', status: 'archiving', emotionalBand: 'bloom-memory', waveformSeed: 65, expiresIn: 60, typewriterEffect: true },
  { id: 'f6', handle: 'echo_fragment_9', timeAgo: '14m ago', content: 'dead zone at the edge of the listening field. signal fragments still visible if you stay quiet.', mood: 'nocturne', resonance: 72, anonymous: true, duration: '0:29', type: 'dead_zone', status: 'drifting', emotionalBand: 'void-edge', waveformSeed: 53 },
  { id: 'f7', handle: 'drift_channel', timeAgo: '31m ago', content: 'something about 3am feels like the only honest hour. this is a voice note from inside that.', mood: 'drift', resonance: 85, anonymous: false, duration: '1:12', type: 'voice_note', status: 'live', emotionalBand: 'drift-honest', waveformSeed: 76 },
  { id: 'f8', handle: 'corrupted_band_∅', timeAgo: '???', content: '̸̱͊s̶̯͌ì̸̲g̶̞̓n̴̬͑a̸͔̔l̷͈̑ ̶̰͝d̵̗̿e̷͚͒g̶͈͑r̶̞͐a̵̰͋d̶͙̃e̵̘̚d̷̝̈́...̵͓̂ ̸̯͊c̸͔̅o̸̰͊r̵̮̒r̴̲̐u̷͓͐p̵͉͑t̵̹̄ī̷̬o̷̮̓n̵̟͊ ̴͔̇a̸̩͗c̶͓̅t̶̼͋ī̷̭v̴̙͑e̴̼̓', mood: 'static', resonance: 33, anonymous: true, duration: '0:07', type: 'unresolved_echo', status: 'corrupted', emotionalBand: 'corrupted', waveformSeed: 99 },
]

const ECOSYSTEM_EVENTS = [
  'a dormant carrier has returned',
  'quiet frequency spike detected',
  'multiple users replaying this signal',
  'ecosystem interference detected',
  'signal bloom opened nearby',
  'carrier wave collapsed and reformed',
  'deep frequency breach at 3:17am',
  'a memory fragment surfaced from archive',
  'new signal entering the drift field',
  'emotional resonance peak: nocturne band',
]

const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  voice_note: 'voice note',
  drifting_thought: 'drifting thought',
  unresolved_echo: 'unresolved echo',
  static_bloom: 'static bloom',
  dead_zone: 'dead zone discovery',
  memory_fragment: 'memory fragment',
  nocturne_broadcast: 'nocturne broadcast',
  abandoned_carrier: 'abandoned carrier',
}

const MOOD_COLORS: Record<Mood, { primary: string; glow: string; dim: string }> = {
  nocturne: { primary: '#c084fc', glow: 'rgba(192,132,252,0.4)', dim: 'rgba(192,132,252,0.1)' },
  bloom:    { primary: '#f472b6', glow: 'rgba(244,114,182,0.4)', dim: 'rgba(244,114,182,0.1)' },
  drift:    { primary: '#22d3ee', glow: 'rgba(34,211,238,0.4)',  dim: 'rgba(34,211,238,0.1)'  },
  static:   { primary: '#a78bfa', glow: 'rgba(167,139,250,0.4)', dim: 'rgba(167,139,250,0.1)' },
  lost:     { primary: '#64748b', glow: 'rgba(100,116,139,0.4)', dim: 'rgba(100,116,139,0.1)' },
}

const STATUS_LABELS: Record<SignalStatus, string> = {
  live:       'currently resonating',
  fading:     'fading',
  drifting:   'drifting',
  archiving:  'archiving soon',
  corrupted:  'corrupted',
  resonating: 'resonating',
}
// ─── Waveform Generator ───────────────────────────────────────────────────────
function generateWaveform(seed: number, bars: number = 32): number[] {
  const waveform: number[] = []
  let s = seed
  for (let i = 0; i < bars; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const val = Math.abs(s) / 0x7fffffff
    // Create organic shape with peaks and valleys
    const shape = Math.sin(i * 0.4 + seed * 0.1) * 0.3 + 0.5
    waveform.push(Math.max(0.05, Math.min(1, val * shape + 0.1)))
  }
  return waveform
}

// ─── Particle System ──────────────────────────────────────────────────────────
function generateParticles(count: number = 40): Particle[] {
  const colors = ['#f472b6', '#22d3ee', '#c084fc', '#a78bfa', '#ffffff']
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.4 + 0.05,
    speedX: (Math.random() - 0.5) * 0.015,
    speedY: (Math.random() - 0.5) * 0.015 - 0.005,
    color: colors[Math.floor(Math.random() * colors.length)],
  }))
}

// ─── Typewriter Hook ──────────────────────────────────────────────────────────
function useTypewriter(text: string, enabled: boolean, speed: number = 28): string {
  const [displayed, setDisplayed] = useState(enabled ? '' : text)
  const [done, setDone] = useState(!enabled)
  useEffect(() => {
    if (!enabled || done) return
    if (displayed.length >= text.length) { setDone(true); return }
    const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), speed + Math.random() * 20)
    return () => clearTimeout(t)
  }, [displayed, text, enabled, done, speed])
  return displayed
}

// ─── Waveform Card Component ──────────────────────────────────────────────────
function WaveformBar({ height, active, color, animated, index }: {
  height: number; active: boolean; color: string; animated: boolean; index: number
}) {
  const baseH = Math.round(height * 40) + 4
  const animClass = animated ? 'waveform-animate' : ''
  return (
    <div
      className={`waveform-bar ${animClass}`}
      style={{
        height: `${baseH}px`,
        width: '3px',
        borderRadius: '2px',
        backgroundColor: active ? color : `${color}55`,
        transition: 'height 0.3s ease, background-color 0.2s ease',
        animationDelay: `${index * 0.04}s`,
        flexShrink: 0,
      }}
    />
  )
}

// ─── Export Modal ─────────────────────────────────────────────────────────────
function ExportModal({ signal, onClose }: { signal: FeedSignal; onClose: () => void }) {
  const [exporting, setExporting] = useState<ExportType | null>(null)
  const [done, setDone] = useState(false)
  const colors = MOOD_COLORS[signal.mood]
  const waveform = generateWaveform(signal.waveformSeed, 20)

  const handleExport = (type: ExportType) => {
    setExporting(type)
    setTimeout(() => { setDone(true) }, 2200)
  }

  const exports: { type: ExportType; label: string; icon: string }[] = [
    { type: 'tiktok', label: 'Export to TikTok', icon: '▶' },
    { type: 'story',  label: 'Export as Story',  icon: '◎' },
    { type: 'relic',  label: 'Save to Relic',    icon: '◈' },
    { type: 'drift',  label: 'Drift Signal',      icon: '∿' },
    { type: 'remix',  label: 'Remix Frequency',   icon: '≋' },
  ]

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal" style={{ '--mood-glow': colors.glow, '--mood-color': colors.primary } as React.CSSProperties} onClick={e => e.stopPropagation()}>
        {!exporting ? (
          <>
            <div className="export-preview">
              <div className="export-tiktok-preview" style={{ background: `linear-gradient(180deg, #000 0%, ${colors.dim} 50%, #000 100%)` }}>
                <div className="export-preview-handle">@{signal.handle}</div>
                <div className="export-preview-waveform">
                  {waveform.map((h, i) => (
                    <div key={i} className="export-wave-bar" style={{ height: `${h * 50 + 4}px`, backgroundColor: colors.primary, opacity: 0.8 }} />
                  ))}
                </div>
                <div className="export-preview-text">{signal.content.substring(0, 60)}...</div>
                <div className="export-preview-band" style={{ color: colors.primary }}>{signal.emotionalBand}</div>
                <div className="export-ecosphere-watermark">◈ ecosphere</div>
              </div>
            </div>
            <div className="export-title">package this signal</div>
            <div className="export-buttons">
              {exports.map(ex => (
                <button key={ex.type} className="export-btn" style={{ '--btn-color': colors.primary } as React.CSSProperties} onClick={() => handleExport(ex.type)}>
                  <span className="export-btn-icon">{ex.icon}</span>
                  {ex.label}
                </button>
              ))}
            </div>
          </>
        ) : !done ? (
          <div className="export-loading">
            <div className="export-pulse" style={{ backgroundColor: colors.primary }} />
            <div className="export-loading-text">packaging signal</div>
            <div className="export-loading-sub" style={{ color: colors.primary }}>{exporting === 'tiktok' ? 'generating vertical preview...' : 'compressing signal data...'}</div>
          </div>
        ) : (
          <div className="export-success">
            <div className="export-success-icon" style={{ color: colors.primary }}>◈</div>
            <div className="export-success-text">signal packaged successfully</div>
            <div className="export-success-sub">ready for transmission</div>
            <button className="export-close-btn" onClick={onClose}>close</button>
          </div>
        )}
        <button className="export-modal-close" onClick={onClose}>✕</button>
      </div>
    </div>
  )
}
// ─── Reaction Config ─────────────────────────────────────────────────────────
const REACTIONS: { type: ReactionType; symbol: string; label: string }[] = [
  { type: 'drift',    symbol: '∿', label: 'drift'    },
  { type: 'bloom',    symbol: '✦', label: 'bloom'    },
  { type: 'echo',     symbol: '◌', label: 'echo'     },
  { type: 'static',   symbol: '⋯', label: 'static'   },
  { type: 'nocturne', symbol: '◑', label: 'nocturne' },
  { type: 'fracture', symbol: '⌁', label: 'fracture' },
]

// ─── Signal Reaction Bar ──────────────────────────────────────────────────────
function SignalReactionBar({ signalId, reactions, setReactions, reactionPop, setReactionPop, moodColor }: {
  signalId: string
  reactions: SignalReactions
  setReactions: React.Dispatch<React.SetStateAction<SignalReactions>>
  reactionPop: ReactionType | null
  setReactionPop: React.Dispatch<React.SetStateAction<ReactionType | null>>
  moodColor: string
}) {
  const toggle = (type: ReactionType) => {
    setReactions(prev => {
      const next = { ...prev, [type]: !prev[type] }
      try { localStorage.setItem('ecosphere_reactions_' + signalId, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
    setReactionPop(type)
    setTimeout(() => setReactionPop(null), 600)
  }

  return (
    <div className="signal-reaction-bar">
      {REACTIONS.map(r => (
        <button
          key={r.type}
          className={`reaction-btn reaction-btn--${r.type} ${reactions[r.type] ? 'reaction-btn--active' : ''} ${reactionPop === r.type ? 'reaction-btn--pop' : ''}`}
          style={{ '--reaction-color': moodColor } as React.CSSProperties}
          onClick={() => toggle(r.type)}
          title={r.label}
        >
          <span className="reaction-symbol">{r.symbol}</span>
          <span className="reaction-label">{r.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Signal Card Component ────────────────────────────────────────────────────
function SignalCard({ signal, index }: { signal: FeedSignal; index: number }) {
  const [visible, setVisible] = useState(false)
  const [waveformVisible, setWaveformVisible] = useState(false)
  const [textVisible, setTextVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [reactions, setReactions] = useState<SignalReactions>(() => {
    try {
      const stored = localStorage.getItem('ecosphere_reactions_' + signal.id)
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })
  const [reactionPop, setReactionPop] = useState<ReactionType | null>(null)
  const colors = MOOD_COLORS[signal.mood]
  const waveform = generateWaveform(signal.waveformSeed)
  const displayText = useTypewriter(signal.content, !!(signal.typewriterEffect && textVisible))

  useEffect(() => {
    const baseDelay = index * 350 + 200
    const t1 = setTimeout(() => setVisible(true), baseDelay)
    const t2 = setTimeout(() => setWaveformVisible(true), baseDelay + 300)
    const t3 = setTimeout(() => setTextVisible(true), baseDelay + 700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [index])

  const isCorrupted = signal.status === 'corrupted'
  const isFading = signal.status === 'fading' || signal.status === 'archiving'

  return (
    <>
      <div
        className={`signal-card ${visible ? 'signal-card--visible' : ''} ${hovered ? 'signal-card--hovered' : ''} ${isCorrupted ? 'signal-card--corrupted' : ''} ${isFading ? 'signal-card--fading' : ''}`}
        style={{ '--mood-color': colors.primary, '--mood-glow': colors.glow, '--mood-dim': colors.dim, '--entry-delay': `${index * 350}ms` } as React.CSSProperties}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Breathing neon edge */}
        <div className="card-neon-edge" style={{ boxShadow: `inset 0 0 0 1px ${hovered ? colors.glow : colors.dim}, 0 0 ${hovered ? '24px' : '8px'} ${hovered ? colors.glow : 'transparent'}` }} />

        {/* Card Header */}
        <div className="card-header">
          <div className="card-handle-row">
            <div className="card-handle" style={{ color: isCorrupted ? '#ff3366' : colors.primary }}>
              {signal.anonymous ? '⬡' : '◈'} {signal.handle}
            </div>
            <div className="card-status" style={{ color: colors.primary, opacity: 0.7 }}>
              {STATUS_LABELS[signal.status]}
            </div>
          </div>
          <div className="card-meta-row">
            <span className="card-type-label">{SIGNAL_TYPE_LABELS[signal.type]}</span>
            <span className="card-band" style={{ color: colors.primary }}>{signal.emotionalBand}</span>
            <span className="card-time">{signal.timeAgo}</span>
          </div>
        </div>

        {/* Waveform Player */}
        <div className={`card-waveform-section ${waveformVisible ? 'card-waveform--visible' : ''} ${hovered ? 'card-waveform--expanded' : ''}`}>
          <button
            className={`waveform-play-btn ${playing ? 'waveform-play-btn--active' : ''}`}
            style={{ borderColor: colors.primary, color: colors.primary }}
            onClick={() => setPlaying(p => !p)}
          >
            {playing ? '▐▐' : '▶'}
          </button>
          <div className="waveform-bars">
            {waveform.map((h, i) => (
              <WaveformBar key={i} height={h} active={playing && i < (waveform.length * 0.4)} color={colors.primary} animated={playing || hovered} index={i} />
            ))}
          </div>
          <div className="waveform-right">
            <span className="waveform-duration">{signal.duration}</span>
            <span className="waveform-resonance" style={{ color: colors.primary }}>{signal.resonance}%</span>
          </div>
        </div>

        {/* Resonance bars */}
        <div className="card-resonance-bars">
          <div className="resonance-track">
            <div className="resonance-fill" style={{ width: `${signal.resonance}%`, background: `linear-gradient(90deg, ${colors.dim}, ${colors.primary})` }} />
          </div>
          <span className="resonance-label" style={{ color: colors.primary }}>resonance</span>
        </div>

        {/* Signal content text */}
        <div className={`card-content ${textVisible ? 'card-content--visible' : ''}`}>
          {isCorrupted ? (
            <span className="corrupted-text">{signal.content}</span>
          ) : (
            <span>{displayText}</span>
          )}
        </div>

        {/* Reaction Row */}
        <SignalReactionBar
          signalId={signal.id}
          reactions={reactions}
          setReactions={setReactions}
          reactionPop={reactionPop}
          setReactionPop={setReactionPop}
          moodColor={colors.primary}
        />

        {/* Export action */}
        <div className={`card-export-row ${hovered ? 'card-export-row--visible' : ''}`}>
          <button className="action-btn action-btn--export" style={{ '--btn-color': colors.primary } as React.CSSProperties} onClick={() => setShowExport(true)}>
            <span>⬡</span> export signal
          </button>
        </div>

        {/* Ambient glow pulse */}
        {hovered && (
          <div className="card-glow-pulse" style={{ background: `radial-gradient(ellipse at 50% 50%, ${colors.dim} 0%, transparent 70%)` }} />
        )}
      </div>
      {showExport && <ExportModal signal={signal} onClose={() => setShowExport(false)} />}
    </>
  )
}
// ─── Particle Canvas ──────────────────────────────────────────────────────────
function ParticleLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>(generateParticles(50))
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particlesRef.current.forEach(p => {
        p.x += p.speedX
        p.y += p.speedY
        if (p.x < -2) p.x = 102
        if (p.x > 102) p.x = -2
        if (p.y < -2) p.y = 102
        if (p.y > 102) p.y = -2

        const x = (p.x / 100) * canvas.width
        const y = (p.y / 100) * canvas.height

        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, '0')
        ctx.fill()
      })
      animRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  return <canvas ref={canvasRef} className="feed-particle-canvas" />
}

// ─── Scan Lines Overlay ───────────────────────────────────────────────────────
function ScanLines() {
  return <div className="feed-scan-lines" aria-hidden="true" />
}

// ─── Grain Overlay ────────────────────────────────────────────────────────────
function GrainOverlay() {
  return <div className="feed-grain" aria-hidden="true" />
}

// ─── Ecosystem Event Banner ───────────────────────────────────────────────────
function EcosystemEventBanner({ event, onDismiss }: { event: EcosystemEvent; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5500)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="ecosystem-event-banner">
      <span className="ecosystem-event-icon">◈</span>
      <span className="ecosystem-event-text">{event.message}</span>
      <button className="ecosystem-event-dismiss" onClick={onDismiss}>✕</button>
    </div>
  )
}

// ─── Feed Header ──────────────────────────────────────────────────────────────
function FeedHeader() {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="feed-header">
      <div className="feed-header-left">
        <div className={`feed-live-dot ${pulse ? 'feed-live-dot--pulse' : ''}`} />
        <span className="feed-header-title">signal feed</span>
      </div>
      <div className="feed-header-right">
        <span className="feed-header-sub">emotional ecosystem · live</span>
      </div>
    </div>
  )
}
// ─── Main FeedScreen ──────────────────────────────────────────────────────────
export default function FeedScreen() {
  const [activeEvent, setActiveEvent] = useState<EcosystemEvent | null>(null)
  const [signals, setSignals] = useState<FeedSignal[]>([])
  const [ambientEnabled, setAmbientEnabled] = useState(false)
  const eventIndexRef = useRef(0)

  // Stagger signal entry
  useEffect(() => {
    setSignals(FEED_SIGNALS)
  }, [])

  // Ecosystem events
  useEffect(() => {
    const scheduleNext = () => {
      const delay = Math.random() * 18000 + 12000
      return setTimeout(() => {
        const msg = ECOSYSTEM_EVENTS[eventIndexRef.current % ECOSYSTEM_EVENTS.length]
        eventIndexRef.current++
        setActiveEvent({ id: Date.now().toString(), message: msg, visible: true })
        scheduleNext()
      }, delay)
    }
    // First event after a short delay
    const t = setTimeout(() => {
      setActiveEvent({ id: '0', message: ECOSYSTEM_EVENTS[0], visible: true })
    }, 6000)
    const recurring = scheduleNext()
    return () => { clearTimeout(t); clearTimeout(recurring) }
  }, [])

  const dismissEvent = useCallback(() => setActiveEvent(null), [])

  return (
    <div className="feed-screen">
      {/* Background atmosphere layers */}
      <div className="feed-atmosphere">
        <div className="feed-fog-layer feed-fog-1" />
        <div className="feed-fog-layer feed-fog-2" />
        <div className="feed-fog-layer feed-fog-3" />
      </div>

      {/* Drifting waveform shards */}
      <div className="feed-waveform-shards" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      {/* Depth vignette */}
      <div className="feed-depth-vignette" aria-hidden="true" />

      {/* Particle system */}
      <ParticleLayer />

      {/* Scan lines */}
      <ScanLines />

      {/* Film grain */}
      <GrainOverlay />

      {/* Ambient glow orbs */}
      <div className="feed-glow-orb feed-glow-orb--pink" />
      <div className="feed-glow-orb feed-glow-orb--cyan" />
      <div className="feed-glow-orb feed-glow-orb--purple" />

      {/* Main content */}
      <div className="feed-content">
        {/* Header */}
        <FeedHeader />

        {/* Ambient toggle */}
        <div className="feed-ambient-row">
          <button
            className={`ambient-toggle ${ambientEnabled ? 'ambient-toggle--active' : ''}`}
            onClick={() => setAmbientEnabled(a => !a)}
          >
            <span className="ambient-icon">{ambientEnabled ? '◉' : '○'}</span>
            ambient layer {ambientEnabled ? 'on' : 'off'}
          </button>
          <span className="feed-signal-count">{signals.length} signals active</span>
        </div>

        {/* Signal cards */}
        <div className="feed-cards">
          {signals.map((signal, i) => (
            <SignalCard key={signal.id} signal={signal} index={i} />
          ))}
        </div>

        {/* Bottom drift zone */}
        <div className="feed-drift-zone">
          <div className="drift-zone-line" />
          <span className="drift-zone-text">signals drift beyond this point</span>
          <div className="drift-zone-line" />
        </div>
      </div>

      {/* Ecosystem event */}
      {activeEvent && (
        <EcosystemEventBanner event={activeEvent} onDismiss={dismissEvent} />
      )}
    </div>
  )
}
