import { useEffect, useMemo, useRef, useState } from 'react'
import './EcosphereAmbience.css'

// ─── Signal Weather ───────────────────────────────────────────────────────────
// Global atmosphere that shifts every few hours. The active weather is applied
// as an overlay layer and exposed on <body data-signal-weather> so any page
// can react to it.

type SignalWeather = {
  id: string
  label: string
  announce: string
}

const WEATHER_STATES: SignalWeather[] = [
  { id: 'static-rain', label: 'static rain', announce: 'static rain moving through the band' },
  { id: 'low-resonance', label: 'low resonance', announce: 'resonance running low across the ecosystem' },
  { id: 'echo-fog', label: 'echo fog', announce: 'echo fog settling over the drift field' },
  { id: 'unstable-bloom', label: 'unstable bloom', announce: 'an unstable bloom is opening nearby' },
  { id: 'memory-haze', label: 'memory haze', announce: 'memory haze thickening — replays carry further' },
  { id: 'silent-night', label: 'silent night', announce: 'silent night. the quiet hours are holding' },
]

// Deterministic weather per 3-hour block so every visitor shares the sky.
function currentWeather(): SignalWeather {
  const now = new Date()
  const block = Math.floor(now.getHours() / 3) + now.getDate() * 8 + now.getMonth() * 248
  return WEATHER_STATES[block % WEATHER_STATES.length]
}

// ─── Live presence (local simulation, realtime-ready shape) ──────────────────
const PRESENCE_EVENTS = [
  'someone tuned in',
  '3 carriers entered drift',
  'a listener resurfaced in rooms',
  'someone is replaying a fading signal',
  'two carriers crossed in the echo fields',
  'a capsule was almost opened',
  'someone archived a voice at low volume',
  'new presence on the nocturne band',
] as const

export default function EcosphereAmbience() {
  const [weather, setWeather] = useState<SignalWeather>(() => currentWeather())
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [presencePulse, setPresencePulse] = useState<string | null>(null)
  const [listeners, setListeners] = useState(() => 14 + Math.floor(Math.random() * 23))
  const announcedRef = useRef<string | null>(null)

  // weather check every minute; announce on change (and once on mount)
  useEffect(() => {
    const apply = () => {
      const next = currentWeather()
      setWeather(next)
      document.body.dataset.signalWeather = next.id
      if (announcedRef.current !== next.id) {
        announcedRef.current = next.id
        setAnnouncement(next.announce)
        window.setTimeout(() => setAnnouncement(null), 7000)
      }
    }
    apply()
    const t = window.setInterval(apply, 60000)
    return () => {
      window.clearInterval(t)
      delete document.body.dataset.signalWeather
    }
  }, [])

  // presence pulses on a soft random cadence
  useEffect(() => {
    let timeout: number
    const schedule = () => {
      timeout = window.setTimeout(() => {
        setPresencePulse(PRESENCE_EVENTS[Math.floor(Math.random() * PRESENCE_EVENTS.length)])
        window.setTimeout(() => setPresencePulse(null), 5200)
        schedule()
      }, 14000 + Math.random() * 22000)
    }
    schedule()
    return () => window.clearTimeout(timeout)
  }, [])

  // active listener count drifts gently
  useEffect(() => {
    const t = window.setInterval(() => {
      setListeners(n => Math.max(6, Math.min(64, n + Math.round((Math.random() - 0.48) * 4))))
    }, 8000)
    return () => window.clearInterval(t)
  }, [])

  // click resonance ripples — direct DOM so taps never trigger React renders
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let live = 0
    const spawn = (event: PointerEvent) => {
      if (live >= 5) return
      live += 1
      const ripple = document.createElement('span')
      ripple.className = 'eco-click-ripple'
      ripple.style.left = `${event.clientX}px`
      ripple.style.top = `${event.clientY}px`
      document.body.appendChild(ripple)
      window.setTimeout(() => {
        ripple.remove()
        live -= 1
      }, 720)
    }
    document.addEventListener('pointerdown', spawn, { passive: true })
    return () => document.removeEventListener('pointerdown', spawn)
  }, [])

  const weatherClass = useMemo(() => `eco-weather eco-weather--${weather.id}`, [weather.id])

  return (
    <>
      <div className={weatherClass} aria-hidden="true">
        <span className="eco-weather-layer eco-weather-layer-a" />
        <span className="eco-weather-layer eco-weather-layer-b" />
      </div>

      <div className="eco-presence-chip" title={`signal weather: ${weather.label}`}>
        <span className="eco-presence-dot" aria-hidden="true" />
        <span className="eco-presence-count">{listeners}</span>
        <span className="eco-presence-label">listening · {weather.label}</span>
      </div>

      {announcement && (
        <div className="eco-ambient-toast eco-ambient-toast--weather" role="status" key={announcement}>
          ◍ {announcement}
        </div>
      )}

      {presencePulse && !announcement && (
        <div className="eco-ambient-toast" role="status" key={presencePulse}>
          <span className="eco-presence-dot" aria-hidden="true" /> {presencePulse}
        </div>
      )}
    </>
  )
}
