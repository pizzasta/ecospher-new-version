// Nighttime intensification: one number, 0..1, that the whole app reads.
// 0 during the day; ramps up through the evening; full depth 0:00-4:00am.
// Everything night-related (denser sea, stronger vignette, faster decay,
// rarer traces) keys off this so the app genuinely feels different at 3am.

export function nightIntensity(now: Date = new Date()): number {
  const hour = now.getHours() + now.getMinutes() / 60

  if (hour >= 0 && hour < 4) return 1
  if (hour >= 4 && hour < 6) return Math.max(0, 1 - (hour - 4) / 2) // 4-6am ramp down
  if (hour >= 21) return Math.min(1, ((hour - 21) / 3) * 0.7 + 0.3) // 9pm-midnight ramp up
  return 0
}

export function isDeepNight(now: Date = new Date()): boolean {
  return effectiveNightIntensity(now) >= 0.8
}

/**
 * Intensity with the preview override applied. Set localStorage
 * 'ecosphere:nightOverride' to '1' (or any 0..1 value) to preview the
 * deep-night ecosystem in daylight; remove it to return to the clock.
 */
export function effectiveNightIntensity(now: Date = new Date()): number {
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('ecosphere:nightOverride')
      if (raw != null) {
        const value = raw === 'on' ? 1 : Number(raw)
        if (Number.isFinite(value)) return Math.min(1, Math.max(0, value))
      }
    }
  } catch { /* storage unavailable */ }
  return nightIntensity(now)
}

// observatory ambient lines that only exist after dark
export const DEEP_NIGHT_LINES = [
  'late-night band active · replays climbing',
  'more listeners right now than this hour usually gets',
  'an old signal just resurfaced two rooms over',
  'someone has been on the same fragment for 20 minutes',
  'the unsent room is busier than it looks',
] as const
