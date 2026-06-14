import { useEffect, useMemo, useRef, useState } from 'react'
import { useEcosystemState } from '../hooks/useEcosystemState'
import { useGlobalAudio } from '../hooks/useGlobalAudio'
import { playSample } from '../lib/sampleAudio'
import { buildRecapScript, markRecapShown, recapAvailable } from '../lib/frequencyRecap'
import { readLastVoiceAt, silentDays } from '../lib/weightOfSilence'
import './FrequencyRecap.css'

type RecapPhase = 'idle' | 'playing' | 'done'

/**
 * Daily Frequency Summary: once per local day a banner offers a short,
 * synthesized audio recap of yesterday's drift. Plays segment by segment
 * through the global audio engine so the now-playing chip follows along.
 */
export default function FrequencyRecap() {
  const { ecosystemState } = useEcosystemState()
  const globalAudio = useGlobalAudio()
  const [available, setAvailable] = useState(() => recapAvailable())
  const [phase, setPhase] = useState<RecapPhase>('idle')
  const [segmentIndex, setSegmentIndex] = useState(0)
  const cancelledRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  const script = useMemo(() => {
    const personalCapsules = (() => {
      try { return (JSON.parse(window.localStorage.getItem('ecosphere:personalCapsules') ?? '[]') as unknown[]).length } catch { return 0 }
    })()
    return buildRecapScript({
      visitedPages: [...new Set(ecosystemState.recentInteractions.map(i => i.page).filter((p): p is NonNullable<typeof p> => Boolean(p)))],
      listenedLabels: ecosystemState.listeningHistory.slice(0, 3).map(e => e.label),
      streak: ecosystemState.streak.count,
      resonance: ecosystemState.resonanceLevel,
      silentDays: silentDays(readLastVoiceAt()),
      personalCapsules,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available])

  useEffect(() => () => {
    cancelledRef.current = true
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  const playRecap = () => {
    if (phase === 'playing') return
    cancelledRef.current = false
    setPhase('playing')
    setSegmentIndex(0)
    markRecapShown()

    const step = (index: number) => {
      if (cancelledRef.current) return
      if (index >= script.segments.length) {
        globalAudio.stop()
        setPhase('done')
        return
      }
      const segment = script.segments[index]
      setSegmentIndex(index)
      void playSample(
        globalAudio,
        { id: `recap-${segment.id}`, label: `frequency recap · ${segment.caption}`, source: 'home' },
        segment.kind,
        segment.seed,
        segment.durationMs,
      )
      timerRef.current = window.setTimeout(() => step(index + 1), segment.durationMs + 350)
    }
    step(0)
  }

  const dismiss = () => {
    cancelledRef.current = true
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    if (phase === 'playing') globalAudio.stop()
    markRecapShown()
    setAvailable(false)
    setPhase('idle')
  }

  if (!available && phase === 'idle') return null

  const current = script.segments[Math.min(segmentIndex, script.segments.length - 1)]

  return (
    <div className={`freq-recap glass freq-recap--${phase}`}>
      {phase === 'idle' && (
        <>
          <div className="freq-recap-head">
            <span className="freq-recap-dot" aria-hidden="true" />
            <span className="freq-recap-title">{script.greeting}</span>
          </div>
          <p className="freq-recap-sub">a short mix of where you drifted · {script.date}</p>
          <div className="freq-recap-actions">
            <button type="button" className="freq-recap-play" onClick={playRecap}>◉ play recap</button>
            <button type="button" className="freq-recap-skip" onClick={dismiss}>not tonight</button>
          </div>
        </>
      )}

      {phase === 'playing' && (
        <>
          <div className="freq-recap-head">
            <span className="freq-recap-dot freq-recap-dot--live" aria-hidden="true" />
            <span className="freq-recap-title">{current.caption}</span>
          </div>
          <p className="freq-recap-line">{current.line}</p>
          <div className="freq-recap-steps" aria-hidden="true">
            {script.segments.map((segment, index) => (
              <i key={segment.id} className={index <= segmentIndex ? 'done' : ''} />
            ))}
          </div>
          <button type="button" className="freq-recap-skip" onClick={dismiss}>stop</button>
        </>
      )}

      {phase === 'done' && (
        <>
          <p className="freq-recap-line">{script.closing}</p>
          <button type="button" className="freq-recap-skip" onClick={dismiss}>close</button>
        </>
      )}
    </div>
  )
}
