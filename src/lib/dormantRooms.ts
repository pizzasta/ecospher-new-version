// Dead Zones for Rooms: frequencies that went quiet. A room fades to dormant
// when its carriers go silent; it keeps a "last spoken" trace (the final
// carrier's sigil + how long ago) and can be reopened — you come back as the
// first carrier, muted, on a recovered frequency. Deterministic per day so
// every device sees the same dormant band.

export interface DormantRoom {
  id: string
  hz: string
  label: string
  lastSigil: string
  lastColor: string
  quietMins: number
  line: string
}

const SIGILS = ['∿', '⬡', '◐', '⌖', '✦', '▦', '◌', '◈']
const COLORS = ['#b9889b', '#7fa6b4', '#8a7fa6', '#5fe0a0', '#c08a6a', '#6a6f93']

const SEEDS: Array<{ id: string; hz: string; label: string; line: string }> = [
  { id: 'dz-quiet', hz: '93.7', label: 'quiet hours', line: 'two voices, then a long pause that never reopened' },
  { id: 'dz-drive', hz: '101.9', label: 'the late drive', line: 'someone narrating an empty highway. the carrier just stopped' },
  { id: 'dz-unsent', hz: '88.5', label: 'the unsent', line: 'a confession that trailed off mid-sentence' },
  { id: 'dz-3am', hz: '104.1', label: '3am thoughts', line: 'a full room that drifted off one by one' },
  { id: 'dz-static', hz: '97.3', label: 'warm static', line: 'nobody spoke for an hour. it went dormant on its own' },
]

function hash(key: string): number {
  let h = 9
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 0x7fffffff
  return h
}

function day(now: number): number { return Math.floor(now / 86400000) }

/** Tonight's dormant frequencies, with a deterministic "last spoken" trace. */
export function dormantRooms(now = Date.now()): DormantRoom[] {
  return SEEDS.map(s => {
    const seed = hash(s.id) + day(now)
    return {
      ...s,
      lastSigil: SIGILS[seed % SIGILS.length],
      lastColor: COLORS[seed % COLORS.length],
      quietMins: 18 + (seed % 280), // ~18min … ~5h
    }
  })
}

/** "quiet for 2h 14m" style. */
export function quietFor(mins: number): string {
  if (mins < 60) return `quiet for ${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m === 0 ? `quiet for ${h}h` : `quiet for ${h}h ${m}m`
}
