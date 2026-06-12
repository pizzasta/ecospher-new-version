import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useGlobalAudio } from '../hooks/useGlobalAudio'
import { useEcoPref } from '../hooks/useEcoPrefs'
import './PodPresence.css'

// The live presence chamber: the top of the hub. One breathing orb that IS
// you tonight — fog, dust, frequency trails, drifting anonymous listeners,
// a status line that watches you kindly, and audio bars that move when the
// band does. Pure CSS motion, parallax from the pointer, reduced-motion safe.

interface PodPresenceProps {
  energy: number // 0..1
  stage: 'resting' | 'awake' | 'radiant'
  rippling: boolean
  streak: number
  identity: string | null
  hzColor?: string
  onTouch: () => void
}

const BASE_STATUSES = [
  'listening quietly',
  'replaying fragments',
  'drifting between rooms',
  'tuning into abandoned frequencies',
  'signal unstable',
  'holding still',
]

export default function PodPresence({ energy, stage, rippling, streak, identity, hzColor = '#00d4ff', onTouch }: PodPresenceProps) {
  const audio = useGlobalAudio()
  const lurker = useEcoPref('lurker', false)
  const hidden = useEcoPref('privateProfile', false)
  const [statusIdx, setStatusIdx] = useState(0)
  const [glitching, setGlitching] = useState(false)
  const shellRef = useRef<HTMLElement>(null)

  // the status line: real state wins, ambience fills the rest
  const status = useMemo(() => {
    if (hidden) return 'hidden from the band'
    if (lurker) return 'drifting invisibly'
    if (audio.playing) return 'replaying fragments'
    const hour = new Date().getHours()
    if (hour >= 0 && hour < 5) return statusIdx % 2 === 0 ? 'active after midnight' : BASE_STATUSES[statusIdx % BASE_STATUSES.length]
    return BASE_STATUSES[statusIdx % BASE_STATUSES.length]
  }, [hidden, lurker, audio.playing, statusIdx])

  useEffect(() => {
    const t = window.setInterval(() => setStatusIdx(n => n + 1), 11000)
    return () => window.clearInterval(t)
  }, [])

  // soft glitches, occasionally — never on a schedule you could predict
  useEffect(() => {
    let timer = 0
    let clear = 0
    const cycle = () => {
      timer = window.setTimeout(() => {
        setGlitching(true)
        clear = window.setTimeout(() => setGlitching(false), 380)
        cycle()
      }, 14000 + Math.random() * 26000)
    }
    cycle()
    return () => { window.clearTimeout(timer); window.clearTimeout(clear) }
  }, [])

  // parallax: the chamber leans toward your pointer
  const handlePointer = (event: React.PointerEvent) => {
    const shell = shellRef.current
    if (!shell) return
    const rect = shell.getBoundingClientRect()
    shell.style.setProperty('--px', (((event.clientX - rect.left) / rect.width) - 0.5).toFixed(3))
    shell.style.setProperty('--py', (((event.clientY - rect.top) / rect.height) - 0.5).toFixed(3))
  }

  const dust = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({
      id: i,
      left: (i * 61 + 11) % 100,
      dur: 11 + (i % 6) * 3.5,
      delay: -(i * 1.9),
      size: 1.5 + (i % 3),
    })),
    []
  )

  const trails = useMemo(
    () => Array.from({ length: 3 }, (_, i) => ({ id: i, top: 24 + i * 22, dur: 16 + i * 7, delay: -(i * 5) })),
    []
  )

  const listeners = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({
      id: i,
      dur: 34 + i * 9,
      delay: -(i * 11),
      size: 7 + (i % 3) * 3,
      tint: i % 3,
    })),
    []
  )

  return (
    <section
      ref={shellRef}
      className={`pod-presence pod-presence--${stage}${glitching ? ' glitching' : ''}${audio.playing ? ' hearing' : ''}`}
      style={{ '--presence-energy': energy.toFixed(3), '--presence-color': hzColor } as CSSProperties}
      onPointerMove={handlePointer}
      aria-label="Your live presence"
    >
      {/* layered atmosphere behind the orb */}
      <div className="pp-depth" aria-hidden="true">
        <div className="pp-fog pp-fog-a" />
        <div className="pp-fog pp-fog-b" />
        {trails.map(t => (
          <span key={t.id} className="pp-trail" style={{ top: `${t.top}%`, animationDuration: `${t.dur}s`, animationDelay: `${t.delay}s` }} />
        ))}
        {dust.map(d => (
          <i key={d.id} className="pp-dust" style={{ left: `${d.left}%`, width: d.size, height: d.size, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }} />
        ))}
      </div>

      {/* other live listeners: presence without names */}
      <div className="pp-listeners" aria-hidden="true">
        {listeners.map(l => (
          <span
            key={l.id}
            className={`pp-listener pp-listener--${l.tint}`}
            style={{ width: l.size, height: l.size, animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s` }}
            title="someone is here too"
          />
        ))}
      </div>

      <div className="pp-stage">
        <button
          type="button"
          className={`pp-orb${rippling ? ' rippling' : ''}`}
          onClick={onTouch}
          aria-label="touch your presence"
        >
          <span className="pp-orb-halo" aria-hidden="true" />
          <span className="pp-orb-core" aria-hidden="true" />
          <span className="pp-orb-ring pp-orb-ring-a" aria-hidden="true" />
          <span className="pp-orb-ring pp-orb-ring-b" aria-hidden="true" />
          <span className="pp-orb-glitch" aria-hidden="true" />
          <span className="pp-orb-particles" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </span>
        </button>

        <div className="pp-status" role="status">
          <i aria-hidden="true" />
          {status}
          {streak >= 2 && <em> · {streak} nights running</em>}
        </div>

        <div className="pp-bars" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <b key={i} style={{ '--b-delay': `${(i % 7) * 0.12}s`, '--b-scale': `${0.3 + ((i * 37) % 60) / 100}` } as CSSProperties} />
          ))}
        </div>

        <div className="pp-callsign">
          {identity ? `signal · ${identity}` : 'signal · unclaimed frequency'}
        </div>
      </div>

      <div className="pp-grain" aria-hidden="true" />
    </section>
  )
}
