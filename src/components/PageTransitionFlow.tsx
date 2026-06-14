import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import './PageTransitionFlow.css'

const transitionPhrases: Record<string, string> = {
  capsules: 'recovering preserved moments',
  drift: 'entering atmospheric drift',
  feed: 'tuning into active signals',
  frequencies: 'scanning emotional bands',
  relics: 'opening deep archive',
  rooms: 'opening shared silence',
  signals: 'tuning into active signals',
  'soul pod': 'returning to your signal',
}

function getTransitionPhrase(label: string) {
  const normalized = label.trim().toLowerCase()
  return transitionPhrases[normalized] ?? null
}

export default function PageTransitionFlow() {
  const [phrase, setPhrase] = useState<string | null>(null)
  const [transitionId, setTransitionId] = useState(0)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const clearPending = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const handleNavigationClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const navButton = target.closest('.nav-item')
      if (!navButton) return

      const navLabel = navButton.querySelector('.nav-label')?.textContent ?? ''
      const nextPhrase = getTransitionPhrase(navLabel)
      if (!nextPhrase) return

      clearPending()
      setPhrase(nextPhrase)
      setTransitionId((current) => current + 1)
      timeoutRef.current = window.setTimeout(() => {
        setPhrase(null)
        timeoutRef.current = null
      }, 1040)
    }

    document.addEventListener('click', handleNavigationClick)
    return () => {
      clearPending()
      document.removeEventListener('click', handleNavigationClick)
    }
  }, [])

  return (
    <AnimatePresence>
      {phrase ? (
        <motion.div
          animate={{ opacity: 1 }}
          aria-hidden="true"
          className="page-transition-flow"
          exit={{ opacity: 0, filter: 'blur(18px)' }}
          initial={{ opacity: 0 }}
          key={`${phrase}-${transitionId}`}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <motion.div
            animate={{ scale: [0.96, 1.04, 1], opacity: [0.38, 0.82, 0] }}
            className="page-transition-flow__glow"
            transition={{ duration: 1.02, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            animate={{ x: ['-26%', '116%'], opacity: [0, 1, 0] }}
            className="page-transition-flow__sweep"
            transition={{ duration: 0.94, ease: [0.22, 1, 0.36, 1] }}
          >
            <span />
            <span />
            <span />
          </motion.div>
          <motion.p
            animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -5], filter: ['blur(10px)', 'blur(0px)', 'blur(0px)', 'blur(8px)'] }}
            className="page-transition-flow__text"
            initial={{ opacity: 0, y: 8, filter: 'blur(10px)' }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            {phrase}
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
