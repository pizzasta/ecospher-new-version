import { useState, useEffect, useRef, useCallback } from 'react'
import '../rooms.css'

// ─── Room Types ────────────────────────────────────────────────
type RoomType = 'quiet' | 'nocturne' | 'static-bloom' | 'drift' | 'dead-zone' | 'pulse' | 'signal-storm'
type RoomState = 'stable' | 'signal-bloom' | 'quiet-hour' | 'resonance-spike' | 'frequency-storm' | 'dead-silence' | 'corrupted-broadcast'

interface RoomDef {
  id: string
  type: RoomType
  name: string
  tagline: string
  atmosphere: string
  emotionalTone: string
  frequency: string
  colorA: string
  colorB: string
  glowColor: string
  carriers: number
  activity: number
}

interface Carrier {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  hue: number
  orbitRadius: number
  orbitAngle: number
  orbitSpeed: number
  pulsePhase: number
}

interface Whisper {
  id: string
  text: string
  x: number
  y: number
  age: number
  maxAge: number
  opacity: number
  distort: number
}

interface RoomEvent {
  id: string
  message: string
  type: RoomState
  timestamp: number
}

// ─── Room Definitions ──────────────────────────────────────────
const ROOM_DEFS: RoomDef[] = [
  {
    id: 'quiet',
    type: 'quiet',
    name: 'Quiet Room',
    tagline: 'where silence becomes a shared frequency',
    atmosphere: 'still / breathable / low resonance',
    emotionalTone: 'calm',
    frequency: '28.4 Hz',
    colorA: '#0a1520',
    colorB: '#001830',
    glowColor: 'rgba(80,160,255,0.4)',
    carriers: 0,
    activity: 12
  },
  {
    id: 'nocturne',
    type: 'nocturne',
    name: 'Nocturne Room',
    tagline: 'for the ones still awake when everything quiets',
    atmosphere: 'warm dark / velvet low-end / slow pulse',
    emotionalTone: 'nocturne',
    frequency: '44.1 Hz',
    colorA: '#100820',
    colorB: '#200830',
    glowColor: 'rgba(180,80,255,0.45)',
    carriers: 0,
    activity: 47
  },
  {
    id: 'static-bloom',
    type: 'static-bloom',
    name: 'Static Bloom',
    tagline: 'restless signals becoming something warm',
    atmosphere: 'charged / flickering / electric warmth',
    emotionalTone: 'charged',
    frequency: '101.6 Hz',
    colorA: '#150510',
    colorB: '#2a0020',
    glowColor: 'rgba(255,20,147,0.5)',
    carriers: 0,
    activity: 78
  },
  {
    id: 'drift',
    type: 'drift',
    name: 'Drift Room',
    tagline: 'untethered carriers moving without direction',
    atmosphere: 'weightless / open / slow current',
    emotionalTone: 'drifting',
    frequency: '33.8 Hz',
    colorA: '#050d18',
    colorB: '#081520',
    glowColor: 'rgba(0,200,255,0.4)',
    carriers: 0,
    activity: 23
  },
  {
    id: 'dead-zone',
    type: 'dead-zone',
    name: 'Dead Zone',
    tagline: 'corrupted frequencies. unstable presence.',
    atmosphere: 'fractured / corrupted / falling apart',
    emotionalTone: 'corrupted',
    frequency: '???.? Hz',
    colorA: '#0d0d0d',
    colorB: '#111100',
    glowColor: 'rgba(100,255,80,0.3)',
    carriers: 0,
    activity: 6
  },
  {
    id: 'pulse',
    type: 'pulse',
    name: 'Pulse Room',
    tagline: 'synchronized heartbeats. collective resonance.',
    atmosphere: 'rhythmic / alive / synchronized',
    emotionalTone: 'pulse',
    frequency: '72.8 Hz',
    colorA: '#100005',
    colorB: '#200010',
    glowColor: 'rgba(255,60,120,0.5)',
    carriers: 0,
    activity: 94
  },
  {
    id: 'signal-storm',
    type: 'signal-storm',
    name: 'Signal Storm',
    tagline: 'chaos blooming into frequency',
    atmosphere: 'turbulent / overwhelming / electric',
    emotionalTone: 'storm',
    frequency: '188.2 Hz',
    colorA: '#0a0510',
    colorB: '#150520',
    glowColor: 'rgba(120,80,255,0.5)',
    carriers: 0,
    activity: 61
  },
]

const WHISPER_TEXTS = [
  'i left something here once.',
  'the resonance remembers.',
  'you found the quiet part.',
  'still here.',
  'someone else was here.',
  'the signal keeps returning.',
  'do you feel that?',
  'almost audible.',
  'fragments of something.',
  'not alone.',
  'the frequency knows you.',
  'drifting back.',
]

const EVENT_MESSAGES: Record<RoomState, string[]> = {
  stable: [],
  'signal-bloom': [
    'signal bloom detected — something is opening.',
    'bloom event in progress. stay still.',
    'frequencies converging.',
  ],
  'quiet-hour': [
    'quiet hour descending.',
    'all carriers entering stillness.',
    'the room is breathing slower now.',
  ],
  'resonance-spike': [
    'resonance spike detected.',
    'collective frequency rising.',
    'something is amplifying.',
  ],
  'frequency-storm': [
    'frequency storm forming.',
    'unstable carrier detected.',
    'the room is fracturing.',
  ],
  'dead-silence': [
    'dead silence event.',
    'all signals suspended.',
    'the room has gone still.',
  ],
  'corrupted-broadcast': [
    'corrupted broadcast detected.',
    'signal integrity failing.',
    'fragments only. proceed carefully.',
  ],
}

const RARE_MESSAGES = [
  '32 carriers synchronized.',
  'dead zone instability rising.',
  'quiet bloom detected.',
  'an abandoned carrier returned.',
  'signal echo from 3 cycles ago.',
  'the frequency has memory.',
  'collective resonance: maximum.',
  'something ancient is listening.',
]

// ─── Utility ───────────────────────────────────────────────────
function pseudoRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

function makeCarrier(i: number, cx: number, cy: number, glowHue: number): Carrier {
  const angle = pseudoRand(i * 7) * Math.PI * 2
  const radius = 60 + pseudoRand(i * 13) * 120
  return {
    id: String(i),
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
    vx: (pseudoRand(i * 3) - 0.5) * 0.4,
    vy: (pseudoRand(i * 5) - 0.5) * 0.4,
    size: 3 + pseudoRand(i * 11) * 8,
    opacity: 0.3 + pseudoRand(i * 17) * 0.5,
    hue: glowHue + (pseudoRand(i * 23) - 0.5) * 40,
    orbitRadius: radius,
    orbitAngle: angle,
    orbitSpeed: (pseudoRand(i * 29) - 0.5) * 0.008,
    pulsePhase: pseudoRand(i * 31) * Math.PI * 2,
  }
}

// ─── Room Canvas Component ─────────────────────────────────────
function RoomCanvas({ room, roomState, carrierCount }: { room: RoomDef; roomState: RoomState; carrierCount: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const carriersRef = useRef<Carrier[]>([])
  const frameRef = useRef<number>(0)
  const timeRef = useRef<number>(0)

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

    // Parse glow color to hue
    const hueMatch = room.glowColor.match(/rgba?\((\d+),(\d+),(\d+)/)
    const glowR = hueMatch ? parseInt(hueMatch[1]) : 255
    const glowG = hueMatch ? parseInt(hueMatch[2]) : 20
    const glowB = hueMatch ? parseInt(hueMatch[3]) : 147

    // Init carriers
    const count = Math.max(4, Math.min(24, carrierCount + 4))
    carriersRef.current = Array.from({ length: count }, (_, i) =>
      makeCarrier(i, canvas.width / 2, canvas.height / 2, glowR)
    )

    let animId = 0
    const draw = () => {
      timeRef.current += 0.016
      const t = timeRef.current
      const W = canvas.width
      const H = canvas.height

      ctx.clearRect(0, 0, W, H)

      // Atmosphere glow
      const isStorm = roomState === 'frequency-storm' || room.type === 'signal-storm'
      const isCorrupt = roomState === 'corrupted-broadcast' || room.type === 'dead-zone'
      const isQuiet = roomState === 'quiet-hour' || room.type === 'quiet'
      const isPulse = room.type === 'pulse'

      // Background radial glow
      const pulseIntensity = isPulse ? 0.5 + Math.sin(t * 3) * 0.3 : 1
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7)
      bg.addColorStop(0, isCorrupt
        ? `rgba(${Math.floor(glowR * 0.3)},${Math.floor(glowG * 1.5)},${Math.floor(glowB * 0.2)},${0.12 * pulseIntensity})`
        : `rgba(${glowR},${glowG},${glowB},${0.1 * pulseIntensity})`
      )
      bg.addColorStop(1, 'transparent')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Fog layers
      if (!isQuiet) {
        for (let f = 0; f < 3; f++) {
          const fx = W * (0.2 + f * 0.3) + Math.sin(t * 0.2 + f) * 30
          const fy = H * (0.3 + f * 0.2) + Math.cos(t * 0.15 + f) * 20
          const fogGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, 80 + f * 40)
          fogGrad.addColorStop(0, `rgba(${glowR},${glowG},${glowB},${isStorm ? 0.04 + Math.sin(t + f) * 0.02 : 0.025})`)
          fogGrad.addColorStop(1, 'transparent')
          ctx.fillStyle = fogGrad
          ctx.fillRect(0, 0, W, H)
        }
      }

      // Storm lightning
      if (isStorm && Math.random() < 0.02) {
        ctx.strokeStyle = `rgba(${glowR},${glowG},${glowB},0.3)`
        ctx.lineWidth = 1
        ctx.beginPath()
        const lx = Math.random() * W
        ctx.moveTo(lx, 0)
        ctx.lineTo(lx + (Math.random() - 0.5) * 40, H * 0.4)
        ctx.lineTo(lx + (Math.random() - 0.5) * 60, H)
        ctx.stroke()
      }

      // Carriers
      carriersRef.current.forEach((c, i) => {
        // Orbit movement
        c.orbitAngle += c.orbitSpeed * (isStorm ? 3 : isPulse ? 1.5 : 1)
        const baseX = W / 2 + Math.cos(c.orbitAngle) * c.orbitRadius
        const baseY = H / 2 + Math.sin(c.orbitAngle) * c.orbitRadius
        c.x += (baseX - c.x) * 0.02
        c.y += (baseY - c.y) * 0.02

        const pulse = Math.sin(t * 2 + c.pulsePhase + i * 0.5)
        const glowSize = c.size * (2 + pulse * (isPulse ? 2 : 1))
        const opacity = c.opacity * (isQuiet ? 0.5 : 1) * (isCorrupt ? (0.3 + Math.random() * 0.7) : 1)

        // Carrier glow
        const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, glowSize * 3)
        grad.addColorStop(0, `rgba(${glowR},${glowG},${glowB},${opacity})`)
        grad.addColorStop(0.4, `rgba(${glowR},${glowG},${glowB},${opacity * 0.3})`)
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(c.x, c.y, glowSize * 3, 0, Math.PI * 2)
        ctx.fill()

        // Core dot
        ctx.fillStyle = `rgba(${glowR},${glowG},${glowB},${Math.min(1, opacity * 1.5)})`
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.size * 0.5 + pulse * 1, 0, Math.PI * 2)
        ctx.fill()

        // Resonance lines between close carriers
        for (let j = i + 1; j < carriersRef.current.length; j++) {
          const other = carriersRef.current[j]
          const dist = Math.hypot(c.x - other.x, c.y - other.y)
          if (dist < 80) {
            ctx.strokeStyle = `rgba(${glowR},${glowG},${glowB},${(1 - dist / 80) * 0.15})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(c.x, c.y)
            ctx.lineTo(other.x, other.y)
            ctx.stroke()
          }
        }
      })

      // Pulse room concentric rings
      if (isPulse || roomState === 'resonance-spike') {
        const ringCount = 3
        for (let r = 0; r < ringCount; r++) {
          const phase = (t * 0.5 + r / ringCount) % 1
          const radius = phase * Math.max(W, H) * 0.6
          const alpha = (1 - phase) * 0.12
          ctx.strokeStyle = `rgba(${glowR},${glowG},${glowB},${alpha})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(W / 2, H / 2, radius, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      // Dead zone glitch
      if (isCorrupt) {
        for (let g = 0; g < 3; g++) {
          if (Math.random() < 0.15) {
            const gy = Math.random() * H
            const gh = 1 + Math.random() * 3
            ctx.fillStyle = `rgba(${glowR},${glowG},${glowB},0.08)`
            ctx.fillRect(0, gy, W, gh)
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    frameRef.current = animId

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [room, roomState, carrierCount])

  return <canvas ref={canvasRef} className="room-canvas" />
}

// ─── Whisper Feed ──────────────────────────────────────────────
function WhisperFeed({ whispers }: { whispers: Whisper[] }) {
  return (
    <div className="room-whisper-feed">
      {whispers.map(w => (
        <div
          key={w.id}
          className="room-whisper-item"
          style={{
            opacity: w.opacity,
            filter: w.distort > 0.5 ? `blur(${w.distort * 1.5}px)` : undefined,
            transform: `translateY(${w.distort * 4}px)`,
          }}
        >
          <span className="room-whisper-text">{w.text}</span>
          <span className="room-whisper-age">{Math.round((Date.now() - w.age) / 1000)}s ago</span>
        </div>
      ))}
    </div>
  )
}

// ─── Room View ─────────────────────────────────────────────────
function RoomView({ room, onBack }: { room: RoomDef; onBack: () => void }) {
  const [carriers, setCarriers] = useState<number>(room.activity)
  const [roomState, setRoomState] = useState<RoomState>('stable')
  const [whispers, setWhispers] = useState<Whisper[]>([])
  const [events, setEvents] = useState<RoomEvent[]>([])
  const [isContributing, setIsContributing] = useState(false)
  const [contributionText, setContributionText] = useState('')
  const [showContrib, setShowContrib] = useState(false)
  const whisperIdRef = useRef(0)
  const eventIdRef = useRef(0)
  const contribTypes = ['whisper', 'hum', 'fragment', 'loop', 'pulse']

  // Simulate carrier drift
  useEffect(() => {
    const drift = setInterval(() => {
      setCarriers(prev => {
        const delta = Math.floor(Math.random() * 5) - 2
        return Math.max(1, Math.min(200, prev + delta))
      })
    }, 3000)
    return () => clearInterval(drift)
  }, [])

  // Random ecosystem events
  useEffect(() => {
    const events: RoomState[] = ['signal-bloom', 'quiet-hour', 'resonance-spike', 'frequency-storm', 'dead-silence', 'corrupted-broadcast']
    const eventTimer = setInterval(() => {
      if (Math.random() < 0.2) {
        const evType = events[Math.floor(Math.random() * events.length)]
        const msgs = EVENT_MESSAGES[evType]
        const msg = msgs[Math.floor(Math.random() * msgs.length)]
        setRoomState(evType)
        setEvents(prev => [{
          id: String(eventIdRef.current++),
          message: msg,
          type: evType,
          timestamp: Date.now(),
        }, ...prev].slice(0, 5))
        setTimeout(() => setRoomState('stable'), 8000 + Math.random() * 12000)
      } else if (Math.random() < 0.15) {
        const msg = RARE_MESSAGES[Math.floor(Math.random() * RARE_MESSAGES.length)]
        setEvents(prev => [{
          id: String(eventIdRef.current++),
          message: msg,
          type: 'stable' as RoomState,
          timestamp: Date.now(),
        }, ...prev].slice(0, 5))
      }
    }, 6000)
    return () => clearInterval(eventTimer)
  }, [])

  // Ambient whispers
  useEffect(() => {
    const wTimer = setInterval(() => {
      if (Math.random() < 0.35) {
        const text = WHISPER_TEXTS[Math.floor(Math.random() * WHISPER_TEXTS.length)]
        const id = String(whisperIdRef.current++)
        const newWhisper: Whisper = {
          id,
          text,
          x: Math.random() * 80 + 10,
          y: Math.random() * 60 + 20,
          age: Date.now(),
          maxAge: 12000 + Math.random() * 8000,
          opacity: 0.6 + Math.random() * 0.3,
          distort: 0,
        }
        setWhispers(prev => [newWhisper, ...prev].slice(0, 6))
        // Fade and age
        const fadeInterval = setInterval(() => {
          setWhispers(prev => prev.map(w => {
            if (w.id !== id) return w
            const age = Date.now() - w.age
            const ratio = age / w.maxAge
            return { ...w, opacity: Math.max(0, 0.9 - ratio), distort: ratio * 0.8 }
          }).filter(w => w.opacity > 0.05))
          if (Date.now() - newWhisper.age > newWhisper.maxAge) clearInterval(fadeInterval)
        }, 1000)
      }
    }, 4000)
    return () => clearInterval(wTimer)
  }, [])

  const handleContribute = () => {
    if (!contributionText.trim()) return
    const text = contributionText.trim()
    setIsContributing(true)
    const id = String(whisperIdRef.current++)
    const newWhisper: Whisper = {
      id,
      text: `"${text}"`,
      x: 30 + Math.random() * 40,
      y: 30 + Math.random() * 40,
      age: Date.now(),
      maxAge: 20000,
      opacity: 1,
      distort: 0,
    }
    setWhispers(prev => [newWhisper, ...prev].slice(0, 8))
    setContributionText('')
    setShowContrib(false)
    setTimeout(() => setIsContributing(false), 1500)
  }

  const carrierLabel = carriers === 1 ? '1 carrier present' : `${carriers} carriers present`
  const activityClass = carriers > 80 ? 'high' : carriers > 30 ? 'medium' : 'low'

  return (
    <div className={`room-view room-view--${room.type}`}>
      {/* Canvas atmosphere */}
      <RoomCanvas room={room} roomState={roomState} carrierCount={carriers} />

      {/* Ambient whisper layer */}
      <div className="room-ambient-whispers">
        {whispers.map(w => (
          <div
            key={w.id}
            className="room-ambient-whisper"
            style={{
              left: `${w.x}%`,
              top: `${w.y}%`,
              opacity: w.opacity,
              filter: w.distort > 0.3 ? `blur(${w.distort}px)` : undefined,
            }}
          >
            {w.text}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="room-view-header">
        <button className="room-view-back" onClick={onBack}>← back</button>
        <div className="room-view-title-group">
          <div className="room-view-type">{room.type.replace('-', ' ')}</div>
          <h2 className="room-view-name">{room.name}</h2>
          <p className="room-view-tagline">{room.tagline}</p>
        </div>
        <div className="room-view-meta">
          <span className="room-freq">{room.frequency}</span>
        </div>
      </div>

      {/* Presence bar */}
      <div className="room-presence-bar">
        <div className={`room-presence-count room-presence-count--${activityClass}`}>
          <span className="room-presence-dot" />
          {carrierLabel}
        </div>
        <div className="room-presence-tone">{room.emotionalTone}</div>
      </div>

      {/* Event log */}
      {events.length > 0 && (
        <div className="room-event-log">
          {events.slice(0, 3).map(e => (
            <div key={e.id} className={`room-event-item room-event-item--${e.type}`}>
              <span className="room-event-dot" />
              {e.message}
            </div>
          ))}
        </div>
      )}

      {/* Room state overlay */}
      {roomState !== 'stable' && (
        <div className={`room-state-overlay room-state-overlay--${roomState}`}>
          <span className="room-state-label">{roomState.replace(/-/g, ' ')}</span>
        </div>
      )}

      {/* Contribution panel */}
      <div className="room-contribution-area">
        {!showContrib ? (
          <div className="room-contrib-actions">
            {contribTypes.map(type => (
              <button
                key={type}
                className="room-contrib-btn"
                onClick={() => { setShowContrib(true); setContributionText('') }}
              >
                {type}
              </button>
            ))}
          </div>
        ) : (
          <div className="room-contrib-form">
            <input
              type="text"
              className="room-contrib-input"
              placeholder="leave a fragment..."
              value={contributionText}
              onChange={e => setContributionText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleContribute()}
              maxLength={80}
              autoFocus
            />
            <div className="room-contrib-btns">
              <button className="room-contrib-submit" onClick={handleContribute} disabled={isContributing}>
                {isContributing ? 'releasing...' : 'release into room'}
              </button>
              <button className="room-contrib-cancel" onClick={() => setShowContrib(false)}>cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Whisper feed */}
      <WhisperFeed whispers={whispers.filter(w => w.opacity > 0.3)} />
    </div>
  )
}

// ─── Room Card ─────────────────────────────────────────────────
function RoomCard({ room, onEnter }: { room: RoomDef; onEnter: () => void }) {
  const [localCarriers, setLocalCarriers] = useState(room.activity)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    const t = setInterval(() => {
      setLocalCarriers(p => Math.max(1, p + Math.floor(Math.random() * 3) - 1))
      setPulse(true)
      setTimeout(() => setPulse(false), 600)
    }, 4000 + Math.random() * 3000)
    return () => clearInterval(t)
  }, [])

  const activityBar = Math.min(100, (localCarriers / 200) * 100)

  return (
    <div
      className={`room-card-new room-card-new--${room.type} ${pulse ? 'room-card-new--pulse' : ''}`}
      onClick={onEnter}
      style={{ '--room-glow': room.glowColor } as React.CSSProperties}
    >
      <div className="room-card-atmosphere" />
      <div className="room-card-header">
        <div className="room-card-type-badge">{room.type.replace('-', ' ')}</div>
        <div className="room-card-freq">{room.frequency}</div>
      </div>
      <div className="room-card-body">
        <h3 className="room-card-name">{room.name}</h3>
        <p className="room-card-tagline">{room.tagline}</p>
        <p className="room-card-atmosphere-text">{room.atmosphere}</p>
      </div>
      <div className="room-card-footer">
        <div className="room-activity-bar">
          <div className="room-activity-fill" style={{ width: `${activityBar}%` }} />
        </div>
        <div className="room-carriers">
          <span className="room-carriers-dot" />
          {localCarriers} carriers
        </div>
      </div>
    </div>
  )
}

// ─── Main RoomsScreen ──────────────────────────────────────────
export default function RoomsScreen() {
  const [activeRoom, setActiveRoom] = useState<RoomDef | null>(null)
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | RoomType>('all')

  const rooms = ROOM_DEFS.map(r => ({
    ...r,
    carriers: r.activity + Math.floor(Math.random() * 10),
  }))

  const filteredRooms = filter === 'all' ? rooms : rooms.filter(r => r.type === filter)

  if (activeRoom) {
    return (
      <div className="rooms-screen-outer">
        <RoomView room={activeRoom} onBack={() => setActiveRoom(null)} />
      </div>
    )
  }

  return (
    <div className="rooms-screen-outer">
      <div className="rooms-screen-shell">
        {/* Header */}
        <div className="rooms-screen-header">
          <div className="rooms-kicker">FREQUENCY SPACES</div>
          <h1 className="rooms-title">Rooms</h1>
          <p className="rooms-subtitle">temporary emotional frequencies. drift through together.</p>
        </div>

        {/* Filter */}
        <div className="rooms-filter-bar">
          <button
            className={`rooms-filter-btn ${filter === 'all' ? 'rooms-filter-btn--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            all
          </button>
          {ROOM_DEFS.map(r => (
            <button
              key={r.id}
              className={`rooms-filter-btn ${filter === r.type ? 'rooms-filter-btn--active' : ''}`}
              onClick={() => setFilter(r.type)}
            >
              {r.type.replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* Room grid */}
        <div className="rooms-grid-new">
          {filteredRooms.map(room => (
            <div
              key={room.id}
              onMouseEnter={() => setHoveredRoom(room.id)}
              onMouseLeave={() => setHoveredRoom(null)}
              className={`rooms-card-wrapper ${hoveredRoom === room.id ? 'rooms-card-wrapper--hovered' : ''}`}
            >
              <RoomCard room={room} onEnter={() => setActiveRoom(room)} />
            </div>
          ))}
        </div>

        {/* Atmospheric hint */}
        <div className="rooms-ambient-hint">
          <p>rooms are temporary. carriers drift through. nothing stays forever.</p>
        </div>
      </div>
    </div>
  )
}
