import { useEffect, useState } from 'react'
import type { LivePresence } from '../lib/liveBus'

/** Real carriers online right now (from the live bus presence sync). */
export function useLivePresence(): LivePresence {
  const [presence, setPresence] = useState<LivePresence>({ total: 0, perPage: {} })
  useEffect(() => {
    const onPresence = (event: Event) => {
      const detail = (event as CustomEvent<LivePresence>).detail
      if (detail) setPresence(detail)
    }
    window.addEventListener('ecosphere:presence', onPresence)
    return () => window.removeEventListener('ecosphere:presence', onPresence)
  }, [])
  return presence
}
