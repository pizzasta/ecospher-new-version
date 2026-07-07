import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { relaySignal, relayState, distanceLine } from '../lib/relay'
import { playSignatureChime, readChime } from '../lib/signatureChime'
import './RelayButton.css'

// One tap: the signal travels further, and your frequency is in it now.
// The chorus swell you hear on relay is every carrier's Hz stacked into
// one chord — the crowd inside the sound.

const CHIME_CYCLE = ['pure', 'warm', 'crystal', 'deep'] as const

export default function RelayButton({ signalId, myHz, color = '#66ccff' }: {
  signalId: string
  myHz: number
  color?: string
}) {
  const [state, setState] = useState(() => relayState(signalId))
  const [surge, setSurge] = useState(false)
  const line = useMemo(() => distanceLine(state), [state])

  const relay = () => {
    if (state.relayedByMe) {
      // already yours — just hear the chorus again
      playChorus(state.carriers)
      return
    }
    const next = relaySignal(signalId, myHz)
    setState(next)
    setSurge(true)
    window.setTimeout(() => setSurge(false), 1400)
    playChorus(next.carriers)
  }

  const playChorus = (carriers: number[]) => {
    // every carrier's tone, staggered into a swell; yours rides last & loudest
    const voices = carriers.slice(-8)
    voices.forEach((hz, i) => {
      const style = CHIME_CYCLE[Math.round(hz * 10) % CHIME_CYCLE.length]
      const last = i === voices.length - 1
      playSignatureChime(hz, style, i * 0.14, 1.7, last ? 0.7 : 0.32)
    })
  }

  return (
    <div className={`relay${surge ? ' relay--surge' : ''}`} style={{ '--relay-color': color } as CSSProperties}>
      <button
        type="button"
        className={`relay-btn${state.relayedByMe ? ' relay-btn--done' : ''}`}
        onClick={relay}
        title={state.relayedByMe ? 'you carried this — hear the chorus' : 'push it further down the band — your frequency joins the chorus'}
      >
        <span className="relay-glyph" aria-hidden="true">∿∿</span>
        {state.relayedByMe ? 'carried' : 'relay'}
      </button>
      <span className="relay-line">{line}</span>
      <span className="relay-streak" aria-hidden="true" />
    </div>
  )
}
