import { dormantRooms, quietFor } from '../lib/dormantRooms'
import type { DormantRoom } from '../lib/dormantRooms'
import './DormantFrequencies.css'

// Dead Zones for Rooms: frequencies that went quiet, with a "last spoken" trace.
// Reopen one to come back as the first carrier (muted) on a recovered frequency.

export default function DormantFrequencies({ onReopen }: { onReopen: (room: DormantRoom) => void }) {
  const rooms = dormantRooms()
  return (
    <section className="dormant-freqs" aria-label="Dormant frequencies">
      <div className="dormant-head">
        <span className="dormant-kicker">DORMANT FREQUENCIES</span>
        <small>rooms that went quiet. reopen one — you come back as the first carrier, muted.</small>
      </div>
      <div className="dormant-list">
        {rooms.map(r => (
          <button key={r.id} type="button" className="dormant-card" onClick={() => onReopen(r)}>
            <span className="dormant-sigil" style={{ color: r.lastColor }} title="last carrier on this frequency">{r.lastSigil}</span>
            <span className="dormant-body">
              <strong>{r.hz} · {r.label}</strong>
              <em>{r.line}</em>
              <span className="dormant-meta">◌ last carrier · {quietFor(r.quietMins).replace('quiet for ', '')} ago</span>
            </span>
            <span className="dormant-reopen">↺ reopen</span>
          </button>
        ))}
      </div>
    </section>
  )
}
