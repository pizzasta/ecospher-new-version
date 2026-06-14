import { useState } from 'react'
import { useRecordingSession } from '../hooks/useRecordingSession'
import './QuickCreate.css'

// Quick Create — one floating dial, everywhere. Expands into the five
// things you can put into the world, plus search. Tactile, glowing,
// never in the way.

const ACTIONS: Array<{ id: string; glyph: string; label: string; page: string }> = [
  { id: 'record', glyph: '●', label: 'record a signal', page: 'unsent' },
  { id: 'chain', glyph: '∞', label: 'join a signal chain', page: 'chains' },
  { id: 'capsule', glyph: '◬', label: 'seal a capsule', page: 'capsules' },
  { id: 'sea', glyph: '∿', label: 'drift a voice into the sea', page: 'frequencies' },
  { id: 'trace', glyph: '◌', label: 'leave a trace on the feed', page: 'signals' },
]

export default function QuickCreate({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [openDial, setOpenDial] = useState(false)
  const { recordingActive } = useRecordingSession()

  if (recordingActive) return null

  return (
    <div className={`quick-create${openDial ? ' open' : ''}`}>
      {openDial && (
        <div className="qc-actions" role="menu" aria-label="quick create">
          <button
            type="button"
            className="qc-action qc-action--search"
            style={{ '--qc-idx': 0 } as React.CSSProperties}
            onClick={() => { setOpenDial(false); window.dispatchEvent(new CustomEvent('ecosphere:search')) }}
          >
            <i aria-hidden="true">⌖</i>
            <span>search the band</span>
          </button>
          {ACTIONS.map((action, i) => (
            <button
              key={action.id}
              type="button"
              className="qc-action"
              style={{ '--qc-idx': i + 1 } as React.CSSProperties}
              onClick={() => { setOpenDial(false); onNavigate(action.page) }}
            >
              <i aria-hidden="true">{action.glyph}</i>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="qc-dial"
        aria-label={openDial ? 'close quick create' : 'open quick create'}
        aria-expanded={openDial}
        onClick={() => setOpenDial(o => !o)}
      >
        {openDial ? '✕' : '◉'}
      </button>
    </div>
  )
}
