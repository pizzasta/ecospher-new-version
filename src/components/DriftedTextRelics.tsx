import { driftedTextRelics } from '../lib/castRelics'
import './DriftedTextRelics.css'

// Cast lines that travelled far enough to be remembered — text relics in the
// shelf, alongside the voice ones.

export default function DriftedTextRelics() {
  const relics = driftedTextRelics()
  if (relics.length === 0) return null
  return (
    <div className="drifted-relics">
      <span className="drifted-relics-kicker">DRIFTED TEXT · kept by the current</span>
      {relics.map(r => (
        <div key={r.id} className="drifted-relic">
          <span className="drifted-relic-mark" aria-hidden="true">∿</span>
          <div className="drifted-relic-body">
            <strong>“{r.text}”</strong>
            <em>{r.note} · {r.passes} passes</em>
          </div>
        </div>
      ))}
    </div>
  )
}
