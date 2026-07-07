import { useEffect, useRef, useState } from 'react'
import {
  descend, descendedTonight, surfacedTonight, msUntilDawn, scanDepth,
  carriedArtifacts, isCarried, carry, setDown, CARRY_LIMIT,
} from '../lib/deepArchive'
import type { Artifact } from '../lib/deepArchive'
import { playSampleBuffer, stopPreviewBuffer } from '../lib/sampleAudio'
import { speakSignal, speechSupported, cancelSpeech } from '../lib/speech'
import './DeepArchive.css'

// The Deep Archive — far-future archaeology for feelings. One artifact
// resolves out of the static per night, audible only until dawn. You can
// carry three. That's the whole system; the weight is emotional.

type Phase = 'sealed' | 'descending' | 'surfaced' | 'resealed'

function dawnLabel(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function DeepArchive() {
  const already = descendedTonight()
  const [phase, setPhase] = useState<Phase>(already ? 'surfaced' : 'sealed')
  const [artifact, setArtifact] = useState<Artifact | null>(() => surfacedTonight())
  const [depth, setDepth] = useState(0)
  const [dawnMs, setDawnMs] = useState(() => msUntilDawn())
  const [carried, setCarried] = useState<Artifact[]>(() => carriedArtifacts())
  const [note, setNote] = useState<string | null>(null)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    const t = window.setInterval(() => setDawnMs(msUntilDawn()), 30_000)
    const timers = timersRef.current
    return () => {
      window.clearInterval(t)
      timers.forEach(id => window.clearTimeout(id))
      stopPreviewBuffer()
      cancelSpeech()
    }
  }, [])

  const flash = (text: string) => {
    setNote(text)
    timersRef.current.push(window.setTimeout(() => setNote(n => (n === text ? null : n)), 4200))
  }

  const beginDescent = () => {
    if (phase !== 'sealed') return
    setPhase('descending')
    const target = scanDepth()
    // static while the scan drops — signal resolving out of noise
    void playSampleBuffer('static', target, 3200, 0.18)
    const started = Date.now()
    const tick = () => {
      const p = Math.min(1, (Date.now() - started) / 3000)
      setDepth(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) { timersRef.current.push(window.setTimeout(tick, 50)) }
      else {
        const found = descend()
        setArtifact(found)
        setPhase('surfaced')
        // the artifact resolves: its tone, then its voice
        void playSampleBuffer('tone', found.seed, 2600, 0.22)
        if (speechSupported()) {
          timersRef.current.push(window.setTimeout(() => speakSignal(found.line, found.seed), 2400))
        }
      }
    }
    tick()
  }

  const hearAgain = (a: Artifact) => {
    void playSampleBuffer('tone', a.seed, 2200, 0.2)
    if (speechSupported()) {
      timersRef.current.push(window.setTimeout(() => speakSignal(a.line, a.seed), 2000))
    }
  }

  const carryTonight = () => {
    if (!artifact) return
    if (isCarried(artifact.id)) return
    if (!carry(artifact.id)) {
      flash('your hands are full — set something down first')
      return
    }
    setCarried(carriedArtifacts())
    flash(`you carry "${artifact.name}" now`)
  }

  const putDown = (a: Artifact) => {
    setDown(a.id)
    setCarried(carriedArtifacts())
    flash(`"${a.name}" returns to the sediment. it isn't gone — it's below.`)
  }

  return (
    <section className="darch" aria-label="The deep archive">
      <header className="darch-head">
        <span className="darch-kicker">THE DEEP ARCHIVE</span>
        <span className="darch-readout" aria-hidden="true">
          {phase === 'descending' ? `▼ -${depth}m` : phase === 'surfaced' ? `▲ holding at -${scanDepth()}m` : '■ scan idle'}
        </span>
      </header>
      <p className="darch-sub">
        one artifact resolves per night. whatever surfaces is audible until dawn, then the sediment closes over it.
      </p>

      {phase === 'sealed' && (
        <div className="darch-chamber darch-chamber--sealed">
          <div className="darch-strata" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <button type="button" className="darch-descend" onClick={beginDescent}>
            ◉ begin tonight's descent
          </button>
          <span className="darch-hint">the scan chooses. you only listen.</span>
        </div>
      )}

      {phase === 'descending' && (
        <div className="darch-chamber darch-chamber--descending">
          <div className="darch-strata darch-strata--moving" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <div className="darch-scanline" aria-hidden="true" />
          <span className="darch-status" role="status">resolving signal out of sediment…</span>
        </div>
      )}

      {phase === 'surfaced' && artifact && (
        <div className="darch-artifact" role="status">
          <div className="darch-artifact-glow" aria-hidden="true" />
          <span className="darch-artifact-glyph" aria-hidden="true">{artifact.glyph}</span>
          <div className="darch-artifact-body">
            <span className="darch-artifact-era">{artifact.era}</span>
            <strong className="darch-artifact-name">{artifact.name}</strong>
            <p className="darch-artifact-line">"{artifact.line}"</p>
          </div>
          <div className="darch-artifact-actions">
            <button type="button" onClick={() => hearAgain(artifact)}>▶ hear it again</button>
            <button
              type="button"
              className={isCarried(artifact.id) ? 'darch-carried' : ''}
              disabled={isCarried(artifact.id)}
              onClick={carryTonight}
            >
              {isCarried(artifact.id) ? '☾ you carry this' : '☾ carry it with you'}
            </button>
          </div>
          <span className="darch-reseal">reseals at dawn · {dawnLabel(dawnMs)}</span>
        </div>
      )}

      {note && <p className="darch-note" role="status">{note}</p>}

      <footer className="darch-carried">
        <span className="darch-carried-label">
          what you carry · {carried.length}/{CARRY_LIMIT}
        </span>
        {carried.length === 0 ? (
          <span className="darch-carried-empty">nothing yet. three pockets, a whole archive below.</span>
        ) : (
          <div className="darch-carried-row">
            {carried.map(a => (
              <span key={a.id} className="darch-carried-chip">
                <button type="button" className="darch-carried-play" onClick={() => hearAgain(a)} title={a.line}>
                  {a.glyph} {a.name}
                </button>
                <button type="button" className="darch-carried-down" onClick={() => putDown(a)} title="set it down — it returns to the sediment">↓</button>
              </span>
            ))}
          </div>
        )}
      </footer>
    </section>
  )
}
