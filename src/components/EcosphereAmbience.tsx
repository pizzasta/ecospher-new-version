import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useEcosystemState } from '../hooks/useEcosystemState'
import { useGlobalAudio } from '../hooks/useGlobalAudio'
import { useEcoPref } from '../hooks/useEcoPrefs'
import { uiClick, uiPop, uiScrollHiss } from '../lib/uiSound'
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
  const { ecosystemState, setAtmosphere, setRareEvent } = useEcosystemState()
  const globalAudio = useGlobalAudio()
  const [weather, setWeather] = useState<SignalWeather>(() => currentWeather())
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [presencePulse, setPresencePulse] = useState<string | null>(null)
  const lurker = useEcoPref('lurker', false)
  const [listeners, setListeners] = useState(() => 14 + Math.floor(Math.random() * 23))
  const announcedRef = useRef<string | null>(null)

  // weather check every minute; announce on change (and once on mount)
  useEffect(() => {
    const apply = () => {
      const next = currentWeather()
      setWeather(next)
      setAtmosphere(next.id)
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
  }, [setAtmosphere])

  // ecosystem pulse: resonance + current page drive global CSS hooks
  const resonance = ecosystemState.resonanceLevel
  const currentPage = ecosystemState.currentPage
  useEffect(() => {
    document.body.style.setProperty('--eco-resonance', (resonance / 100).toFixed(3))
    document.body.dataset.ecoPage = currentPage
    return () => {
      document.body.style.removeProperty('--eco-resonance')
      delete document.body.dataset.ecoPage
    }
  }, [resonance, currentPage])

  // rare ecosystem events surface globally, then fade
  const rareEvent = ecosystemState.rareEvent
  useEffect(() => {
    if (!rareEvent) return
    const t = window.setTimeout(() => setRareEvent(null), 8000)
    return () => window.clearTimeout(t)
  }, [rareEvent, setRareEvent])

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

  // user preferences: night protocol, motion intensity, haptics
  useEffect(() => {
    const apply = (prefs: { nightMode?: boolean; driftSensitivity?: number } | null) => {
      if (!prefs) return
      if (prefs.nightMode) document.body.dataset.ecoNight = 'on'
      else delete document.body.dataset.ecoNight
      const sensitivity = Number(prefs.driftSensitivity)
      document.body.style.setProperty('--eco-motion', Number.isFinite(sensitivity) ? (sensitivity / 100).toFixed(2) : '0.6')
    }
    try {
      const raw = window.localStorage.getItem('ecosphere:settings')
      if (raw) apply(JSON.parse(raw))
    } catch { /* defaults apply */ }
    const onPrefs = (event: Event) => apply((event as CustomEvent).detail)
    window.addEventListener('ecosphere:prefs', onPrefs)
    return () => {
      window.removeEventListener('ecosphere:prefs', onPrefs)
      delete document.body.dataset.ecoNight
      document.body.style.removeProperty('--eco-motion')
    }
  }, [])

  // sound-responsive UI: radio click on taps, pop on sends, hiss on scroll
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const interactive = target.closest('button, [role="button"], a, .toggle')
      if (!interactive) return
      if (interactive.classList.contains('eco-recorder-btn--send')) uiPop()
      else uiClick()
    }

    let lastScrollY = window.scrollY
    let lastTime = performance.now()
    let scrollFrame: number | null = null
    const onScroll = () => {
      if (scrollFrame !== null) return
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null
        const now = performance.now()
        const dt = Math.max(16, now - lastTime)
        const speed = (Math.abs(window.scrollY - lastScrollY) / dt) * 1000
        lastScrollY = window.scrollY
        lastTime = now
        uiScrollHiss(speed)
      })
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('scroll', onScroll)
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
    }
  }, [])

  // click resonance ripples — direct DOM so taps never trigger React renders
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let live = 0
    const spawn = (event: PointerEvent) => {
      if (live >= 5) return
      live += 1
      try {
        const raw = window.localStorage.getItem('ecosphere:settings')
        if (raw && JSON.parse(raw)?.vibrate && 'vibrate' in navigator) navigator.vibrate(6)
      } catch { /* haptics unavailable */ }
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

      <div className={`eco-presence-chip${lurker ? ' eco-presence-chip--lurking' : ''}`} title={`signal weather: ${weather.label}`}>
        <span className="eco-presence-dot" aria-hidden="true" />
        <span className="eco-presence-count">{listeners + Math.round(ecosystemState.roomActivity / 10)}</span>
        <span className="eco-presence-label">{lurker ? `lurking · unseen · ${weather.label}` : `listening · ${weather.label}`}</span>
      </div>

      {ecosystemState.activeAudio && (
        <div className="eco-now-playing" role="status">
          <span className="eco-now-playing-bars" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="eco-now-playing-label">{ecosystemState.activeAudio.label}</span>
          {globalAudio.progress > 0 && (
            <span className="eco-now-playing-progress" style={{ '--p': `${Math.round(globalAudio.progress * 100)}%` } as CSSProperties} />
          )}
        </div>
      )}

      {rareEvent && (
        <div className="eco-ambient-toast eco-ambient-toast--rare" role="status" key={rareEvent}>
          ✶ {rareEvent}
        </div>
      )}

      {announcement && !rareEvent && (
        <div className="eco-ambient-toast eco-ambient-toast--weather" role="status" key={announcement}>
          ◍ {announcement}
        </div>
      )}

      {presencePulse && !announcement && !rareEvent && (
        <div className="eco-ambient-toast" role="status" key={presencePulse}>
          <span className="eco-presence-dot" aria-hidden="true" /> {presencePulse}
        </div>
      )}

      {globalAudio.notice && (
        <div className="eco-ambient-toast eco-ambient-toast--notice" role="alert" key={globalAudio.notice}>
          ⌁ {globalAudio.notice}
        </div>
      )}
    </>
  )
}
