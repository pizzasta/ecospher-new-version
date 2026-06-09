import './EcosphereLandingScreen.css'
import type { CSSProperties } from 'react'
import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const particleCount = 26

type EcosphereLandingScreenProps = {
  onEnterComplete?: () => void
}

export default function EcosphereLandingScreen({ onEnterComplete }: EcosphereLandingScreenProps) {
  const [isEntering, setIsEntering] = useState(false)

  const beginTransition = useCallback(() => {
    if (isEntering) return

    setIsEntering(true)
  }, [isEntering])

  return (
    <motion.section
      animate={isEntering ? { filter: 'blur(18px)', opacity: 0, scale: 1.035 } : { filter: 'blur(0px)', opacity: 1, scale: 1 }}
      aria-label="Ecosphere landing screen"
      className={`ecosphere-landing ${isEntering ? 'is-entering' : ''}`}
      exit={{ filter: 'blur(18px)', opacity: 0, scale: 1.035 }}
      initial={{ filter: 'blur(10px)', opacity: 0, scale: 1.02 }}
      onAnimationComplete={() => {
        if (isEntering) onEnterComplete?.()
      }}
      transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
    >
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

      <div className="ecosphere-landing__content">
        <p className="ecosphere-landing__eyebrow">SIGNAL GATE // ONLINE</p>
        <div className="ecosphere-landing__mark" aria-hidden="true">
          <span />
          <i />
          <b />
        </div>
        <h1>ECOSPHERE</h1>
        <p className="ecosphere-landing__subtitle">anonymous signals drifting through the late-night frequency field.</p>
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
