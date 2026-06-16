import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useLivePresence } from '../hooks/useLivePresence'
import type { LiveEvent } from '../lib/liveBus'
import {
  nightlyWave, bandNow, bandPhase, signalWeather, collectiveMood, bandIndicators, bandAlmanac, MOOD_SPECTRUM,
} from '../lib/observatory'
import { castsToday } from '../lib/castMetrics'
import './NocturneObservatory.css'

// The Nocturne Band as a living entity: a nightly activity wave that breathes
// from dusk to dawn, the band's "weather", its collective mood, and a grid of
// live readings. All aggregate + deterministic or driven by anonymous presence.

const PHASE_LINE: Record<ReturnType<typeof bandPhase>, string> = {
  rising: 'the band is rising',
  peaking: 'the band is at its deepest',
  fading: 'the band is fading toward dawn',
  resting: 'the band is mostly resting',
}

function wavePath(values: number[], w: number, h: number): string {
  const n = values.length
  const pts = values.map((v, i) => [(i / (n - 1)) * w, h - v * (h - 6) - 3] as const)
  // smooth-ish polyline
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
}

export default function NocturneObservatory({ onTune }: { onTune?: () => void }) {
  const presence = useLivePresence()
  const carriers = presence.total
  const [now, setNow] = useState(() => Date.now())
  const [stormy, setStormy] = useState(false)
  const [almanacOpen, setAlmanacOpen] = useState(false)

  // re-read the band every 30s so the wave + readings drift over the night
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(t)
  }, [])

  // a live replay storm turns the weather stormy for a moment
  useEffect(() => {
    let stormTimer = 0
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<LiveEvent>).detail
      if (detail?.type === 'storm') {
        setStormy(true)
        window.clearTimeout(stormTimer)
        stormTimer = window.setTimeout(() => setStormy(false), 12000)
      }
    }
    window.addEventListener('ecosphere:live', onLive)
    return () => {
      window.removeEventListener('ecosphere:live', onLive)
      window.clearTimeout(stormTimer)
    }
  }, [])

  const wave = useMemo(() => nightlyWave(now), [now])
  const nowVal = bandNow(now)
  const phase = bandPhase(now)
  const weather = signalWeather(now, stormy)
  const mood = collectiveMood(now)
  const indicators = bandIndicators(now, { carriers, stormy })
  const casts = castsToday(now)
  const almanac = useMemo(() => bandAlmanac(now), [now])
  const nowHour = new Date(now).getHours() + new Date(now).getMinutes() / 60

  const W = 300, H = 64
  const path = wavePath(wave.map(p => p.value), W, H)
  const nowX = (nowHour / 23) * W
  const nowY = H - nowVal * (H - 6) - 3

  return (
    <section className={`nocturne-obs glass${stormy ? ' nocturne-obs--storm' : ''}`} aria-label="The nocturne band">
      <div className="nocturne-obs-head">
        <span className="nocturne-obs-kicker">THE NOCTURNE BAND</span>
        <span className="nocturne-obs-phase">{PHASE_LINE[phase]}</span>
      </div>

      {/* nightly activity wave — the band breathing dusk → dawn; tap to drop into what's loudest */}
      {onTune ? (
        <button type="button" className="nocturne-wave-shell nocturne-wave-shell--tappable" onClick={onTune} aria-label="drop into what's loudest on the band right now">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="nocturne-wave" aria-hidden="true">
            <defs>
              <linearGradient id="nocturneFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,45,120,0.28)" />
                <stop offset="100%" stopColor="rgba(0,212,255,0.02)" />
              </linearGradient>
            </defs>
            <path d={`${path} L${W} ${H} L0 ${H} Z`} fill="url(#nocturneFill)" />
            <path d={path} fill="none" stroke="rgba(180,210,255,0.55)" strokeWidth="1.4" />
            <line x1={nowX} y1="0" x2={nowX} y2={H} stroke="rgba(255,45,120,0.4)" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={nowX} cy={nowY} r="3.2" fill="#ff6aa0" className="nocturne-now-dot" />
          </svg>
          <div className="nocturne-wave-axis" aria-hidden="true"><span>dusk</span><span>3am</span><span>dawn</span></div>
          <span className="nocturne-wave-hint">tap the band → drop into what's loudest</span>
        </button>
      ) : (
      <div className="nocturne-wave-shell">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="nocturne-wave" aria-hidden="true">
          <defs>
            <linearGradient id="nocturneFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,45,120,0.28)" />
              <stop offset="100%" stopColor="rgba(0,212,255,0.02)" />
            </linearGradient>
          </defs>
          <path d={`${path} L${W} ${H} L0 ${H} Z`} fill="url(#nocturneFill)" />
          <path d={path} fill="none" stroke="rgba(180,210,255,0.55)" strokeWidth="1.4" />
          <line x1={nowX} y1="0" x2={nowX} y2={H} stroke="rgba(255,45,120,0.4)" strokeWidth="1" strokeDasharray="2 3" />
          <circle cx={nowX} cy={nowY} r="3.2" fill="#ff6aa0" className="nocturne-now-dot" />
        </svg>
        <div className="nocturne-wave-axis" aria-hidden="true"><span>dusk</span><span>3am</span><span>dawn</span></div>
      </div>
      )}

      {/* weather + collective mood */}
      <div className="nocturne-readout">
        <div className="nocturne-weather" title={weather.note}>
          <span className="nocturne-weather-glyph" aria-hidden="true">{weather.glyph}</span>
          <div>
            <strong>{weather.label}</strong>
            <em>{weather.note}</em>
          </div>
        </div>
        <div className="nocturne-mood">
          <span className="nocturne-mood-label">collective mood · <strong>{mood.label}</strong></span>
          <div className="nocturne-mood-bar" style={{ '--mood-pos': `${(mood.value * 100).toFixed(0)}%` } as CSSProperties}>
            <i className="nocturne-mood-marker" />
          </div>
          <div className="nocturne-mood-scale">
            {MOOD_SPECTRUM.map(m => <span key={m} className={m === mood.label ? 'on' : ''}>{m}</span>)}
          </div>
        </div>
      </div>

      {/* live readings */}
      <div className="nocturne-indicators">
        {indicators.map(ind => (
          <div key={ind.id} className="nocturne-ind">
            <span className="nocturne-ind-value">{ind.value}</span>
            <span className="nocturne-ind-label">{ind.label}</span>
            {ind.sub && <span className="nocturne-ind-sub">{ind.sub}</span>}
          </div>
        ))}
        {casts > 0 && (
          <div className="nocturne-ind">
            <span className="nocturne-ind-value">{casts}</span>
            <span className="nocturne-ind-label">lines cast</span>
            <span className="nocturne-ind-sub">into the sea tonight</span>
          </div>
        )}
      </div>

      {/* almanac: how tonight compares to last night */}
      <button
        type="button"
        className="nocturne-almanac-toggle"
        onClick={() => setAlmanacOpen(o => !o)}
        aria-expanded={almanacOpen}
      >
        {almanacOpen ? '▴ hide last night' : '▾ last night vs tonight'}
      </button>
      {almanacOpen && (
        <div className="nocturne-almanac">
          <p className="nocturne-almanac-line">{almanac.line}</p>
          <div className="nocturne-almanac-grid">
            <div className="nocturne-almanac-side">
              <span>last night</span>
              <strong>{almanac.lastNight.weather}</strong>
              <em>{almanac.lastNight.mood} · {almanac.lastNight.pressure}% peak</em>
            </div>
            <div className="nocturne-almanac-side nocturne-almanac-side--now">
              <span>tonight</span>
              <strong>{almanac.tonight.weather}</strong>
              <em>{almanac.tonight.mood} · {almanac.tonight.pressure}% peak</em>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
