import { useEffect, useState } from 'react'
import type { GradientSettings } from '../lib/frequencyGradient'

/**
 * Drives the gradient angle. Static when drift is off, the angle is pinned,
 * or prefers-reduced-motion is set; otherwise advances on a coarse interval
 * (slow rotation needs nowhere near 60fps).
 */
export function useFrequencyGradient(settings: GradientSettings): number {
  const [angle, setAngle] = useState(settings.angle ?? 135)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (settings.speed === 0 || settings.angle != null || reduced) {
      setAngle(settings.angle ?? 135)
      return undefined
    }
    const degreesPerTick = 360 / (settings.speed * 5) // tick every 200ms
    const timer = window.setInterval(() => {
      setAngle(prev => (prev + degreesPerTick) % 360)
    }, 200)
    return () => window.clearInterval(timer)
  }, [settings.speed, settings.angle])

  return angle
}
