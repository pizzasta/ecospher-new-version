import { useEffect, useState } from 'react'
import { predictText } from '../lib/predictiveEcho'

/**
 * Predictive Echo hook: 2 seconds after the user stops typing, offer a
 * ghosted completion. Clears the moment they type again or empty the field.
 */
export function usePredictiveText(value: string, idleMs = 2000): string | null {
  const [suggestion, setSuggestion] = useState<string | null>(null)

  useEffect(() => {
    setSuggestion(null)
    const trimmed = value.trim()
    if (!trimmed || trimmed.length < 3) return undefined
    const timer = window.setTimeout(() => {
      setSuggestion(predictText(trimmed))
    }, idleMs)
    return () => window.clearTimeout(timer)
  }, [value, idleMs])

  return suggestion
}
