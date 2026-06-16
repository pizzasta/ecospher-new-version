import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './RoomAtmosphere.css'

// A reusable cinematic backdrop for room surfaces: drifting particles, an
// audio-reactive aura, CRT texture, and ambient whispers that surface and fade.
// Purely atmospheric — no interaction, no layout. Parents set the accent and
// (optionally) feed it a live level so the glow breathes with the room.

interface Whisper { id: number; text: string; top: number; left: number; dur: number }

interface RoomAtmosphereProps {
  /** any CSS color; the whole field tints to this */
  accent?: string
  /** 0..1 activity/audio level — drives the reactive aura */
  level?: number
  /** lines that drift up through the field occasionally; omit for a silent field */
  whisperLines?: readonly string[]
  /** denser field for full-bleed in-room views, sparse for cards/sections */
  density?: 'sparse' | 'full'
  className?: string
}

const PARTICLE_COUNT = { sparse: 16, full: 34 } as const

// deterministic-ish jitter so a remount doesn't reshuffle wildly
function seeded(i: number, salt: number): number {
  let x = (i + 1) * 374761393 + salt * 668265263
  x = (x ^ (x >> 13)) * 1274126177
  return (Math.abs(x ^ (x >> 16)) % 1000) / 1000
}

export default function RoomAtmosphere({
  accent,
  level = 0,
  whisperLines,
  density = 'full',
  className = '',
}: RoomAtmosphereProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)
  const [whispers, setWhispers] = useState<Whisper[]>([])

  // push the live level into a CSS var; the aura CSS transitions it smoothly
  useEffect(() => {
    rootRef.current?.style.setProperty('--atm-level', Math.max(0, Math.min(1, level)).toFixed(3))
  }, [level])

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT[density] }, (_, i) => ({
        id: i,
        left: seeded(i, 11) * 100,
        top: seeded(i, 29) * 100,
        size: 1.4 + seeded(i, 53) * 3.2,
        dur: 16 + seeded(i, 71) * 20,
        delay: -seeded(i, 97) * 28,
        alpha: 0.12 + seeded(i, 131) * 0.4,
      })),
    [density]
  )

  // ambient whispers surface every so often, then drift off and fade
  useEffect(() => {
    if (!whisperLines || whisperLines.length === 0) return
    let alive = true
    let timer = 0
    const tick = () => {
      if (!alive) return
      if (Math.random() < 0.6) {
        const id = ++idRef.current
        const w: Whisper = {
          id,
          text: whisperLines[Math.floor(Math.random() * whisperLines.length)],
          top: 18 + Math.random() * 60,
          left: 6 + Math.random() * 50,
          dur: 12 + Math.random() * 7,
        }
        setWhispers(prev => [...prev.slice(-5), w])
        window.setTimeout(() => setWhispers(prev => prev.filter(x => x.id !== id)), w.dur * 1000)
      }
      timer = window.setTimeout(tick, 5200 + Math.random() * 4200)
    }
    timer = window.setTimeout(tick, 2400 + Math.random() * 2600)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [whisperLines])

  return (
    <div
      ref={rootRef}
      className={`room-atmosphere room-atmosphere--${density} ${className}`}
      style={accent ? ({ '--atm-accent': accent } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      <div className="atm-aura" />
      <div className="atm-field">
        {particles.map(p => (
          <span
            key={p.id}
            className="atm-particle"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              opacity: p.alpha,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
      {whispers.length > 0 && (
        <div className="atm-whispers">
          {whispers.map(w => (
            <span
              key={w.id}
              className="atm-whisper"
              style={{ top: `${w.top}%`, left: `${w.left}%`, animationDuration: `${w.dur}s` }}
            >
              {w.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
