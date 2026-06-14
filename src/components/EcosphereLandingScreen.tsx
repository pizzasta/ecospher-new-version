import './EcosphereLandingScreen.css'
import type { CSSProperties } from 'react'
import { useCallback, useState } from 'react'
import { usePointerParallax } from '../hooks/usePointerParallax'
import { AnimatePresence, motion } from 'framer-motion'
import ColorWave from './ColorWave'

const particleCount = 26

type EcosphereLandingScreenProps = {
  onEnterComplete?: () => void
}

const liveIndicators = [
  { label: 'signal · 88.1 detected', x: '12%', y: '22%', delay: '0s' },
  { label: '3 carriers drifting', x: '74%', y: '16%', delay: '1.2s' },
  { label: 'nocturne band open', x: '16%', y: '72%', delay: '2.4s' },
  { label: 'resonance 67%', x: '78%', y: '68%', delay: '3.4s' },
]

export default function EcosphereLandingScreen({ onEnterComplete }: EcosphereLandingScreenProps) {
  const [isEntering, setIsEntering] = useState(false)
  const parallaxRef = usePointerParallax<HTMLElement>()

  const beginTransition = useCallback(() => {
    if (isEntering) return

    setIsEntering(true)
  }, [isEntering])

  return (
    <motion.section
      animate={isEntering ? { filter: 'blur(18px)', opacity: 0, scale: 1.035 } : { filter: 'blur(0px)', opacity: 1, scale: 1 }}
      aria-label="Ecosphere landing screen"
      className={`ecosphere-landing ${isEntering ? 'is-entering' : ''}`}
      ref={parallaxRef}
      exit={{ filter: 'blur(18px)', opacity: 0, scale: 1.035 }}
      initial={{ filter: 'blur(10px)', opacity: 0, scale: 1.02 }}
      onAnimationComplete={() => {
        if (isEntering) onEnterComplete?.()
      }}
      transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <ColorWave />
      <div className="ecosphere-landing__grid" aria-hidden="true" />
      <div className="ecosphere-landing__glow ecosphere-landing__glow--pink" aria-hidden="true" />
      <div className="ecosphere-landing__glow ecosphere-landing__glow--cyan" aria-hidden="true" />
      <div className="ecosphere-landing__noise" aria-hidden="true" />

      <div className="ecosphere-landing__particles" aria-hidden="true">
        {Array.from({ length: particleCount }, (_, index) => (
          <span
            key={index}
            style={{
              '--particle-delay': `${index * 210}ms`,
              '--particle-left': `${(index * 17 + 9) % 100}%`,
              '--particle-top': `${(index * 29 + 13) % 100}%`,
            } as CSSProperties}
          />
        ))}
      </div>

      <div className="ecosphere-landing__indicators" aria-hidden="true">
        {liveIndicators.map(ind => (
          <span
            key={ind.label}
            className="ecosphere-landing__indicator"
            style={{ left: ind.x, top: ind.y, '--ind-delay': ind.delay } as CSSProperties}
          >
            <i />
            {ind.label}
          </span>
        ))}
      </div>

      <div className="ecosphere-landing__content">
        <p className="ecosphere-landing__eyebrow">SIGNAL GATE // ONLINE</p>
        <div className="ecosphere-landing__mark" aria-hidden="true">
          <span />
          <i />
          <b />
        </div>
        <h1>ECOSPHERE</h1>
        <p className="ecosphere-landing__subtitle">anonymous signals drifting tonight.</p>

        <div className="ecosphere-landing__explainer">
          <p className="ecosphere-landing__tagline">somewhere out there, someone's still awake.</p>
          <p className="ecosphere-landing__plain">
            ten-second voices from strangers you'll never meet. listen, drift, leave one of your own before it fades.
          </p>
          <p className="ecosphere-landing__cue">press play on whatever's passing through.</p>
        </div>

        <div className="ecosphere-landing__wave" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <em key={i} style={{ '--wd': `${(i % 8) * 0.11}s`, '--wh': `${28 + ((i * 37) % 60)}%` } as CSSProperties} />
          ))}
        </div>
        <button className="ecosphere-landing__button" disabled={isEntering} onClick={beginTransition} type="button">
          ENTER THE GATE
        </button>
      </div>

      <AnimatePresence>
        {isEntering ? (
          <motion.div
            animate={{ opacity: [0, 1, 0.88], scaleX: [0.12, 1.04, 1] }}
            className="ecosphere-landing__transition"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0, scaleX: 0.08 }}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
          >
            <motion.span
              animate={{ x: ['-18%', '112%'], opacity: [0, 1, 0] }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.i
              animate={{ opacity: [0, 1, 0], scale: [0.74, 1.18, 1.36] }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  )
}
