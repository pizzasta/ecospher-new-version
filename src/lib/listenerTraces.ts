// Listener traces: tiny human fingerprints left on signals. Not comments,
// not poetry — the kind of thing someone types at 1am and doesn't reread.
// Deterministic per signal so traces feel discovered, not generated fresh.

export type ListenerTrace = {
  id: string
  text: string
  /** late traces mount after a delay — the page keeps living */
  delayMs: number
  /** degrees, for the lightly-pinned imperfect look */
  tilt: number
  /** 0-100 horizontal drift so nothing lines up perfectly */
  offset: number
  night: boolean
}

const TRACES = [
  'this sounded worse with headphones',
  'heard this in a parking lot',
  'the silence made this sadder somehow',
  'i replayed this too many times',
  'someone laughed in the background',
  'this feels like checking your phone after an argument',
  "i shouldn't have opened this app tonight",
  'heard this while pretending to study',
  'why did this actually help',
  'the ending ruined me',
  'paused it. sat there. pressed play again',
  'my roommate asked what i was listening to. said nothing',
  'this came on while i was reheating dinner',
  'i typed a whole reply and deleted it',
  'the first three seconds are the whole thing',
  'listened with one earbud at work',
  'accidentally played this out loud on the bus',
  'this is a wednesday night sound',
  'skipped it twice before actually listening',
  'i was fine until the pause in the middle',
  'sent it to myself so i wouldn\'t lose it',
  'played this instead of answering',
  'the static at the end sounds like my old apartment',
  'turned the volume down and somehow it got louder',
  'don\'t listen to this while waiting for a text back',
  'heard it once. thought about it all shift',
  'this was background noise until it wasn\'t',
  'i don\'t even know this person. anyway',
] as const

// only surface between midnight and 5am — the hours that explain them
const NIGHT_TRACES = [
  "it's 2am and this app knew",
  'everyone else in the house is asleep',
  'listening so i don\'t check their profile',
  'should be asleep. one more',
  'the room is dark and this is the only light',
  'my alarm is in four hours and i don\'t care',
] as const

// "most replayed trace" — the one note a signal becomes known for
const MOST_REPLAYED = [
  'this sounded different in the car',
  'the second listen is the real one',
  'everyone replays the same ten seconds. you can tell',
  'came back for the ending. it was still the ending',
  'i wasn\'t the only one who looped this. good',
  'replayed it until it stopped working. it never stopped working',
  'the part everyone skips is the part i stay for',
  'this is the one that gets shared at 1am',
] as const

function hash(str: string): number {
  let h = 23
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}

function isNightHour(now: Date): boolean {
  const hour = now.getHours()
  return hour >= 0 && hour < 5
}

export type TraceContext = {
  /** the user has replayed this signal */
  replayed: boolean
  /** resonance / replay weight 0-100 — gates placement */
  resonance: number
  now?: Date
}

/**
 * Traces for one signal. Empty unless the signal earned them (replayed by
 * the user, or heavily replayed by the band). One trace per condition, so
 * cards never crowd:
 *  - base trace: resonance >= 85 or replayed
 *  - second trace: unlocked by replaying
 *  - night trace: only between midnight and 5am
 * One of the visible traces arrives late (18-40s) — the card keeps living.
 */
export function tracesForSignal(signalId: string, context: TraceContext): ListenerTrace[] {
  const { replayed, resonance } = context
  const now = context.now ?? new Date()
  if (!replayed && resonance < 85) return []

  const seed = hash(signalId)
  const traces: ListenerTrace[] = []

  const baseIndex = seed % TRACES.length
  traces.push({
    id: `${signalId}-t0`,
    text: TRACES[baseIndex],
    delayMs: 0,
    tilt: ((seed % 50) / 10) - 2.5,
    offset: seed % 55,
    night: false,
  })

  if (replayed) {
    const secondIndex = (baseIndex + 7 + (seed % 11)) % TRACES.length
    traces.push({
      id: `${signalId}-t1`,
      text: TRACES[secondIndex],
      // unlocked traces drift in late — you notice them on the way back
      delayMs: 18000 + (seed % 22000),
      tilt: (((seed >> 3) % 50) / 10) - 2.5,
      offset: 20 + ((seed >> 2) % 55),
      night: false,
    })
  }

  if (isNightHour(now)) {
    traces.push({
      id: `${signalId}-night`,
      text: NIGHT_TRACES[seed % NIGHT_TRACES.length],
      delayMs: 6000 + (seed % 9000),
      tilt: (((seed >> 5) % 40) / 10) - 2,
      offset: 10 + ((seed >> 4) % 60),
      night: true,
    })
  }

  return traces
}

/** The trace a heavily-replayed signal becomes known for. */
export function mostReplayedTrace(signalId: string, resonance: number): string | null {
  if (resonance < 90) return null
  return MOST_REPLAYED[hash(signalId) % MOST_REPLAYED.length]
}
