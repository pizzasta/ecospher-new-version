// Signals from tomorrow. Shown only inside the Temporal Resonance window;
// they cannot be replied to — they haven't happened yet.

import { tomorrowLabel } from './temporalWindow'

export type FutureSignal = {
  id: string
  handle: string
  content: string
  mood: 'nocturne' | 'drift' | 'static' | 'lost' | 'bloom'
  timeLabel: string
  waveformSeed: number
}

const FUTURE_LINES: Array<[string, string, FutureSignal['mood']]> = [
  ['tomorrowsweather', 'it rains around 4pm. you were right not to say it tonight.', 'drift'],
  ['callyoudidnttake', 'the phone rings twice tomorrow. the second one matters.', 'nocturne'],
  ['nextnightshift', "the song you can't remember right now plays at the gas station tomorrow. you'll stop walking.", 'static'],
  ['unsentbecomessent', 'one of the drafts gets sent tomorrow. not by you. about you.', 'lost'],
  ['futureleftovers', 'tomorrow you reheat tonight and it tastes fine. it always tastes fine a day later.', 'bloom'],
  ['theankleweather', 'someone asks "you okay?" tomorrow and means it. have an answer ready.', 'drift'],
  ['carrierfromahead', 'this frequency is being listened to right now by someone in your tomorrow. wave.', 'static'],
  ['latemorningecho', "you sleep through the first alarm. it's okay. the day waits.", 'nocturne'],
]

export function futureSignals(): FutureSignal[] {
  const label = tomorrowLabel()
  return FUTURE_LINES.map(([handle, content, mood], index) => ({
    id: `future-${index + 1}`,
    handle,
    content,
    mood,
    timeLabel: `${label} · tomorrow`,
    waveformSeed: 333 + index * 11,
  }))
}
