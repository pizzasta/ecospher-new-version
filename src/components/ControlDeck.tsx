import { useEffect, useMemo, useState } from 'react'
import './control-deck.css'

// ───────────────────────────────────────────────────────────────────────────
// THE CONTROL DECK — the dashboard / central hub of the ecosystem.
// A high-level, actionable overview that consolidates the live ecosystem:
//   • Resonance Feed     — real-time activity log of how others touch your signal
//   • Live Band Navigator — active rooms with quick-join metrics + pressure
//   • Signal Analytics   — dark-mode charts: weekly active-hours heatmap +
//                          listening-pattern breakdown
//   • Quick Actions Panel — a dock of hotkeys: broadcast, 10s rapid record,
//                          scan for fading frequencies
//
// Self-contained + defensive: reads are wrapped so a malformed localStorage
// shape can never strand the user on the crash screen. When there is no real
// data yet, gentle generated values keep the deck feeling alive.
// ───────────────────────────────────────────────────────────────────────────

type NavTarget =
  | 'home' | 'signals' | 'drift' | 'rooms' | 'unsent' | 'capsules'
  | 'relics' | 'pod' | 'dashboard' | 'zones' | 'frequencies'
  | 'anomalies' | 'settings' | 'chains' | 'transmit'

type ControlDeckProps = {
  onNavigate?: (screen: NavTarget) => void
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return min + 'm ago'
  const hr = Math.round(min / 60)
  if (hr < 24) return hr + 'h ago'
  return Math.round(hr / 24) + 'd ago'
}

// ── Resonance Feed ──────────────────────────────────────────────────────────
type EchoItem = { id: string; text: string; ts: number; kind: 'replay' | 'visit' | 'echo' | 'fade' }

const FEED_SEED: Omit<EchoItem, 'ts'>[] = [
  { id: 'r1', text: '7 carriers replayed your signal tonight', kind: 'replay' },
  { id: 'r2', text: 'an anonymous listener lingered on 72.8 Hz', kind: 'visit' },
  { id: 'r3', text: 'someone left an ambient echo behind', kind: 'echo' },
  { id: 'r4', text: 'your oldest signal is beginning to fade', kind: 'fade' },
  { id: 'r5', text: '3 visitors passed through your frequency', kind: 'visit' },
]

const KIND_GLYPH: Record<EchoItem['kind'], string> = {
  replay: '∿', visit: '◉', echo: '≋', fade: '✕',
}

// ── Live Band Navigator ─────────────────────────────────────────────────────
type BandRoom = { id: string; name: string; listeners: number; pressure: number }

const BAND_SEED: BandRoom[] = [
  { id: 'venting', name: 'People Venting', listeners: 11, pressure: 0.74 },
  { id: 'oversharing', name: 'Oversharing Hour', listeners: 8, pressure: 0.91 },
  { id: 'deep', name: 'Deep Talks', listeners: 11, pressure: 0.42 },
  { id: 'ambient', name: 'Ambient Drift', listeners: 5, pressure: 0.21 },
]

function pressureLabel(p: number): string {
  if (p >= 0.8) return 'high'
  if (p >= 0.5) return 'building'
  if (p >= 0.25) return 'calm'
  return 'still'
}

// ── Signal Analytics ────────────────────────────────────────────────────────
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const HOUR_BANDS = ['00', '04', '08', '12', '16', '20']

// Deterministic-ish pseudo activity so the heatmap is stable within a session.
function buildHeatmap(): number[][] {
  const stored = safeRead<number[][] | null>('eco.activeHours', null)
  if (Array.isArray(stored) && stored.length === 7) return stored
  const grid: number[][] = []
  for (let d = 0; d < 7; d++) {
    const row: number[] = []
    for (let h = 0; h < 6; h++) {
      // Night-leaning ecosystem: evenings + late night run hotter.
      const night = h >= 4 || h === 0 ? 0.7 : 0.25
      const weekend = d >= 5 ? 0.2 : 0
      const v = Math.min(1, Math.max(0, night + weekend + (Math.sin(d * 3 + h * 7) + 1) * 0.18))
      row.push(Number(v.toFixed(2)))
    }
    grid.push(row)
  }
  return grid
}

type ListenSlice = { label: string; value: number; color: string }
const LISTEN_SEED: ListenSlice[] = [
  { label: 'Deep Talks', value: 42, color: 'var(--eco-violet)' },
  { label: 'Ambient Rooms', value: 33, color: 'var(--eco-cyan)' },
  { label: 'Dead Zones', value: 25, color: 'var(--eco-magenta)' },
]

function heatColor(v: number): string {
  // cyan → violet → magenta as intensity rises, on a dark base.
  const a = 0.08 + v * 0.82
  if (v < 0.34) return 'rgba(103, 232, 249, ' + a.toFixed(2) + ')'
  if (v < 0.67) return 'rgba(167, 139, 250, ' + a.toFixed(2) + ')'
  return 'rgba(244, 114, 182, ' + a.toFixed(2) + ')'
}

export default function ControlDeck({ onNavigate }: ControlDeckProps) {
  const [now, setNow] = useState(() => Date.now())
  const [scan, setScan] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(t)
  }, [])

  const feed = useMemo<EchoItem[]>(() => {
    return FEED_SEED.map((item, i) => ({ ...item, ts: now - (i + 1) * 7 * 60000 }))
  }, [now])

  const rooms = useMemo<BandRoom[]>(() => {
    const stored = safeRead<BandRoom[] | null>('eco.liveRooms', null)
    return Array.isArray(stored) && stored.length ? stored : BAND_SEED
  }, [])

  const heat = useMemo(() => buildHeatmap(), [])
  const slices = LISTEN_SEED
  const sliceTotal = slices.reduce((s, x) => s + x.value, 0)

  const totalListeners = rooms.reduce((s, r) => s + r.listeners, 0)

  // 10-second rapid record — purely a visual primer; the real recorder lives
  // on the home/feed surface, so we route there after the countdown.
  const rapidRecord = () => {
    if (recording) return
    setRecording(true)
    let left = 10
    setScan('recording — ' + left + 's')
    const tick = window.setInterval(() => {
      left -= 1
      setScan(left > 0 ? 'recording — ' + left + 's' : null)
      if (left <= 0) {
        window.clearInterval(tick)
        setRecording(false)
        onNavigate?.('home')
      }
    }, 1000)
  }

  const scanFading = () => {
    setScan('scanning for fading frequencies…')
    window.setTimeout(() => {
      const fading = feed.filter((f) => f.kind === 'fade').length
      setScan(fading > 0 ? fading + ' fading signal nearby — open Dead Zones' : 'no fading frequencies in range')
    }, 1100)
  }

  const toggleBroadcast = () => {
    setBroadcasting((b) => !b)
    setScan(!broadcasting ? 'broadcasting your signal' : 'broadcast paused')
  }

  return (
    <section className="control-deck" aria-label="The Control Deck">
      <header className="cd-header glass">
        <div className="cd-header-left">
          <span className="cd-orb" aria-hidden="true" />
          <div>
            <p className="cd-eyebrow">the control deck</p>
            <h2 className="cd-title">Your live ecosystem, at a glance</h2>
          </div>
        </div>
        <div className="cd-header-stats">
          <span>{totalListeners} listening</span>
          <span className="cd-dot" aria-hidden="true">•</span>
          <span>{rooms.length} active bands</span>
        </div>
      </header>

      <div className="cd-grid">
        {/* ── Resonance Feed ── */}
        <article className="cd-card glass cd-resonance" aria-label="Resonance Feed">
          <div className="cd-card-head">
            <h3>∿ Resonance Feed</h3>
            <span className="cd-live">live</span>
          </div>
          <p className="cd-sub">how the band is touching your signal</p>
          <ul className="cd-feed">
            {feed.map((item) => (
              <li key={item.id} className={'cd-feed-row kind-' + item.kind}>
                <span className="cd-feed-glyph" aria-hidden="true">{KIND_GLYPH[item.kind]}</span>
                <span className="cd-feed-text">{item.text}</span>
                <span className="cd-feed-time">{relativeTime(item.ts)}</span>
              </li>
            ))}
          </ul>
        </article>

        {/* ── Live Band Navigator ── */}
        <article className="cd-card glass cd-bands" aria-label="Live Band Navigator">
          <div className="cd-card-head">
            <h3>≋ Live Band Navigator</h3>
            <button type="button" className="cd-mini-link" onClick={() => onNavigate?.('rooms')}>all rooms</button>
          </div>
          <p className="cd-sub">active rooms · atmospheric pressure</p>
          <ul className="cd-band-list">
            {rooms.map((room) => (
              <li key={room.id} className="cd-band-row">
                <div className="cd-band-main">
                  <span className="cd-band-name">{room.name}</span>
                  <span className="cd-band-meta">{room.listeners} listening · {pressureLabel(room.pressure)}</span>
                </div>
                <div className="cd-band-side">
                  <span className="cd-pressure" aria-hidden="true">
                    <span className="cd-pressure-fill" style={{ width: Math.round(room.pressure * 100) + '%' }} />
                  </span>
                  <button type="button" className="cd-join" onClick={() => onNavigate?.('rooms')}>join</button>
                </div>
              </li>
            ))}
          </ul>
        </article>

        {/* ── Signal Analytics: heatmap ── */}
        <article className="cd-card glass cd-heatmap" aria-label="Signal Analytics: active hours">
          <div className="cd-card-head">
            <h3>📊 Active Hours</h3>
            <span className="cd-sensed">sensed by the band</span>
          </div>
          <p className="cd-sub">when your frequency runs hottest</p>
          <div className="cd-heat-wrap">
            <div className="cd-heat-hours" aria-hidden="true">
              {HOUR_BANDS.map((h) => <span key={h}>{h}</span>)}
            </div>
            <div className="cd-heat-grid" role="img" aria-label="weekly activity heatmap">
              {heat.map((row, d) => (
                <div className="cd-heat-row" key={d}>
                  <span className="cd-heat-day" aria-hidden="true">{DAYS[d]}</span>
                  {row.map((v, h) => (
                    <span
                      key={h}
                      className="cd-heat-cell"
                      style={{ background: heatColor(v) }}
                      title={'intensity ' + Math.round(v * 100) + '%'}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* ── Signal Analytics: listening patterns ── */}
        <article className="cd-card glass cd-patterns" aria-label="Signal Analytics: listening patterns">
          <div className="cd-card-head">
            <h3>📈 Listening Patterns</h3>
            <span className="cd-sensed">sensed by the band</span>
          </div>
          <p className="cd-sub">where your hours drift</p>
          <div className="cd-pattern-body">
            <svg className="cd-donut" viewBox="0 0 42 42" role="img" aria-label="listening pattern breakdown">
              <circle className="cd-donut-base" cx="21" cy="21" r="15.915" />
              {(() => {
                let offset = 25
                return slices.map((s) => {
                  const pct = (s.value / sliceTotal) * 100
                  const el = (
                    <circle
                      key={s.label}
                      className="cd-donut-seg"
                      cx="21" cy="21" r="15.915"
                      stroke={s.color}
                      strokeDasharray={pct + ' ' + (100 - pct)}
                      strokeDashoffset={offset}
                    />
                  )
                  offset -= pct
                  return el
                })
              })()}
              <text x="21" y="20" className="cd-donut-num">{sliceTotal}</text>
              <text x="21" y="25" className="cd-donut-label">hrs / wk</text>
            </svg>
            <ul className="cd-legend">
              {slices.map((s) => (
                <li key={s.label}>
                  <span className="cd-legend-dot" style={{ background: s.color }} />
                  <span className="cd-legend-name">{s.label}</span>
                  <span className="cd-legend-val">{Math.round((s.value / sliceTotal) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>

      {/* ── Quick Actions Panel (floating dock) ── */}
      <div className="cd-dock glass" role="toolbar" aria-label="Quick Actions">
        {scan && <span className="cd-dock-status" aria-live="polite">{scan}</span>}
        <button
          type="button"
          className={'cd-dock-btn' + (broadcasting ? ' is-on' : '')}
          onClick={toggleBroadcast}
        >
          <span aria-hidden="true">⌁</span> {broadcasting ? 'broadcasting' : 'broadcast'}
        </button>
        <button
          type="button"
          className={'cd-dock-btn' + (recording ? ' is-rec' : '')}
          onClick={rapidRecord}
          disabled={recording}
        >
          <span aria-hidden="true">●</span> 10s record
        </button>
        <button type="button" className="cd-dock-btn" onClick={scanFading}>
          <span aria-hidden="true">⌖</span> scan fading
        </button>
      </div>
    </section>
  )
}
