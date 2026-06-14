// Temporal Resonance window: the room only opens between 3:33 and 3:43 AM
// local time. From 3:00 it is visible but locked ("forming"), so the lock
// icon has somewhere to live; the rest of the day it doesn't exist at all.

export type TemporalPhase = 'closed' | 'forming' | 'open'

export type TemporalState = {
  phase: TemporalPhase
  /** minutes remaining in the open window (only meaningful while open) */
  minutesRemaining: number
  /** minutes until the window opens (only meaningful while forming) */
  minutesUntilOpen: number
}

const OPEN_START = 3 * 60 + 33 // 3:33
const OPEN_END = 3 * 60 + 43 // 3:43 (exclusive)
const FORMING_START = 3 * 60 // 3:00

export function temporalWindow(now: Date = new Date()): TemporalState {
  const minuteOfDay = now.getHours() * 60 + now.getMinutes()

  if (minuteOfDay >= OPEN_START && minuteOfDay < OPEN_END) {
    return { phase: 'open', minutesRemaining: OPEN_END - minuteOfDay, minutesUntilOpen: 0 }
  }
  if (minuteOfDay >= FORMING_START && minuteOfDay < OPEN_START) {
    return { phase: 'forming', minutesRemaining: 0, minutesUntilOpen: OPEN_START - minuteOfDay }
  }
  return { phase: 'closed', minutesRemaining: 0, minutesUntilOpen: 0 }
}

/** Tomorrow's date, formatted the way feed timestamps read. */
export function tomorrowLabel(now: Date = new Date()): string {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
