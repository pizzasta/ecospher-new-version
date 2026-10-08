import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { readPresences, ambientPresences, roomMood, presenceLine } from '../lib/presence'
import type { Presence } from '../lib/presence'
import { formatRelativeTime } from '../lib/notifications'
import './PresenceRoom.css'

// The Presence Room — a dark frequency-space on your profile where everyone
// who's passed through drifts as an anonymous, emotion-colored soul. Live
// visitors pulse; past ones fade to afterglow. Refreshes on its own and
// blooms a fresh soul the instant someone interacts. No names, no counts.

const AMBIENT_SLOT_MS = 20 * 60 * 1000 // ambient drifters shift every 20 min

function ambientSeed(now: number): number {
  return Math.floor(now / AMBIENT_SLOT_MS)
}

export default function PresenceRoom({ accent = '#b9889b' }: { accent?: string }) {
  const [now, setNow] = useState(() => Date.now())
  const [real, setReal] = useState<Presence[]>(() => readPresences())
  const [selected, setSelected] = useState<string | null>(null)
  const roomRef = useRef<HTMLDivElement>(null)

  const refresh = () => { setNow(Date.now()); setReal(readPresences()) }

  useEffect(() => {
    // keep the room breathing: re-read on an interval, when someone interacts
    // (a new pass-through lands in the store, then fires this event), and
    // whenever the tab returns to the foreground
    const tick = window.setInterval(refresh, 30000)
    const onNote = () => refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('ecosphere:notification', onNote)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(tick)
      window.removeEventListener('ecosphere:notification', onNote)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // when the room is quiet, let the wider band drift faintly through it so an
  // empty profile still feels emotionally occupied — never a dead page
  const ambient = real.length < 3 ? ambientPresences(ambientSeed(now), 3 - real.length) : []
  const presences = [...real, ...ambient]
  const caption = roomMood(presences)
  const liveCount = real.filter(p => p.tier === 'live').length

  return (
    <div className="ph-card glass presence-card" style={{ '--presence-accent': accent } as CSSProperties}>
      <div className="ph-card-head">
        <span className="ph-card-kicker">YOUR FREQUENCY · WHO'S DRIFTING</span>
        {liveCount > 0 && <span className="presence-live-dot" aria-hidden="true" />}
      </div>

      <div
        className="presence-room"
        ref={roomRef}
        role="group"
        aria-label={`Presence room — ${caption}`}
        onClick={() => setSelected(null)}
      >
        <div className="presence-floor" aria-hidden="true" />
        {presences.map(p => {
          const relative = p.ambient ? '' : formatRelativeTime(now - p.ageMs, now)
          const line = presenceLine(p, relative)
          const isSel = selected === p.id
          return (
            <button
              key={p.id}
              type="button"
              className={`presence-orb presence-orb--${p.tier}${p.ambient ? ' presence-orb--ambient' : ''}${isSel ? ' is-selected' : ''}`}
              style={{
                '--orb-color': p.color,
                '--orb-size': `${p.size}px`,
                '--orb-x': `${p.x}%`,
                '--orb-y': `${p.y}%`,
                '--orb-dx': `${p.driftX}px`,
                '--orb-dy': `${p.driftY}px`,
                '--orb-dur': `${p.driftDur}s`,
                '--orb-delay': `${p.delay}s`,
              } as CSSProperties}
              aria-label={line}
              onClick={e => { e.stopPropagation(); setSelected(isSel ? null : p.id) }}
              onMouseEnter={() => setSelected(p.id)}
              onFocus={() => setSelected(p.id)}
            >
              <span className="presence-orb-core" aria-hidden="true" />
              {p.feeling === 'null' && <span className="presence-orb-glyph" aria-hidden="true">∅</span>}
            </button>
          )
        })}

        {/* the whisper for whichever soul you're near */}
        {selected && (() => {
          const p = presences.find(x => x.id === selected)
          if (!p) return null
          const relative = p.ambient ? '' : formatRelativeTime(now - p.ageMs, now)
          return (
            <div className="presence-whisper" style={{ '--orb-color': p.color } as CSSProperties} aria-live="polite">
              {presenceLine(p, relative)}
            </div>
          )
        })()}
      </div>

      <p className="presence-caption">{caption}</p>
      <p className="ph-hint presence-hint">no names, no counts — just who your frequency touched. tap a light.</p>
    </div>
  )
}
