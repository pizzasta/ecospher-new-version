// Group conversations: tap a topic and actually hear a small group talking
// about it — short lines, traded back and forth, each speaker in their own
// voice. Real device voices carry the words (see speech.ts) over a low murmur
// of others in the room. The scripts are simulated and deterministic, in the
// app's plain late-night register — nothing here pretends to be a real person's
// recording.

import { speakSignal, speechSupported, cancelSpeech } from './speech'
import { playChainBlend, stopChainPlayback } from './sampleAudio'

export interface GroupTurn {
  /** speaker index 0..3 — drives which voice reads the line */
  who: number
  line: string
}

export interface GroupTopic {
  id: string
  glyph: string
  title: string
  teaser: string
  turns: GroupTurn[]
}

export const GROUP_TOPICS: GroupTopic[] = [
  {
    id: 'cant-sleep',
    glyph: '☾',
    title: "can't sleep",
    teaser: 'people up at the wrong hour, keeping each other company',
    turns: [
      { who: 0, line: "anyone else just. not tired but exhausted" },
      { who: 1, line: 'every night this week. i give up at like four' },
      { who: 2, line: "i stopped fighting it honestly. i just let it be late" },
      { who: 0, line: 'what do you even do though. like right now' },
      { who: 1, line: 'lie here. think about everything i said in 2017' },
      { who: 3, line: "i'm just glad the lights are on in here" },
      { who: 2, line: "yeah. it's better than the ceiling" },
    ],
  },
  {
    id: 'didnt-send',
    glyph: '✉',
    title: "the text i didn't send",
    teaser: 'drafts that never left the box',
    turns: [
      { who: 0, line: "i typed the whole thing out. then deleted it" },
      { who: 1, line: "what would it have said. if you'd sent it" },
      { who: 0, line: 'just that i still think about it. that’s all' },
      { who: 2, line: 'i kept one in my drafts for a year. literally a year' },
      { who: 3, line: "sometimes not sending it is the message" },
      { who: 1, line: "i don't know if that makes it better or worse" },
      { who: 0, line: "me neither. but i feel less insane hearing it" },
    ],
  },
  {
    id: 'figuring-out',
    glyph: '◎',
    title: 'still figuring it out',
    teaser: "everyone pretending less than usual",
    turns: [
      { who: 0, line: 'does anyone actually feel like an adult yet' },
      { who: 1, line: "no. i just got taller and got a job" },
      { who: 2, line: "i thought i'd have it sorted by now. i don't" },
      { who: 3, line: "nobody does. they're all doing the same bit" },
      { who: 0, line: 'that’s weirdly comforting actually' },
      { who: 1, line: "we're all just winging it in different fonts" },
      { who: 2, line: "okay that one's going on my wall" },
    ],
  },
  {
    id: 'someone-i-miss',
    glyph: '❍',
    title: 'someone i miss',
    teaser: 'said quietly, to people who get it',
    turns: [
      { who: 0, line: "i miss them at the dumbest times. like grocery stores" },
      { who: 1, line: "songs do it to me. i had to delete a whole playlist" },
      { who: 2, line: "i still go to text them when something funny happens" },
      { who: 0, line: 'yeah. the reflex doesn’t leave for a while' },
      { who: 3, line: 'it gets quieter. it doesn’t really go' },
      { who: 1, line: "i think i'm okay with quieter" },
    ],
  },
  {
    id: 'overthinking',
    glyph: '∿',
    title: 'overthinking everything',
    teaser: 'the 3am replay of one conversation',
    turns: [
      { who: 0, line: "i've replayed one conversation like forty times tonight" },
      { who: 1, line: 'and they’ve forgotten it completely. guaranteed' },
      { who: 0, line: "logically yes. emotionally absolutely not" },
      { who: 2, line: 'my brain only opens at night. for renovations' },
      { who: 3, line: "name one thing you fixed by thinking about it at 3am" },
      { who: 0, line: '…okay you got me' },
      { who: 1, line: 'we should all just go to sleep. nobody move' },
    ],
  },
  {
    id: 'small-wins',
    glyph: '✶',
    title: 'small wins today',
    teaser: 'low bar, said out loud anyway',
    turns: [
      { who: 0, line: 'i answered an email i’d avoided for two weeks' },
      { who: 1, line: 'huge. genuinely. i replied to a text from march' },
      { who: 2, line: 'i ate a real meal. with a vegetable in it' },
      { who: 3, line: 'i got out of bed before noon. one time' },
      { who: 0, line: 'these are all wins. i’m proud of this room' },
      { who: 1, line: 'low bar club. membership is free' },
    ],
  },
  {
    id: 'starting-over',
    glyph: '⟳',
    title: 'starting over',
    teaser: 'new city, new chapter, no map',
    turns: [
      { who: 0, line: 'i moved somewhere nobody knows me. it’s a lot' },
      { who: 1, line: 'i did that two years ago. the first month is the worst' },
      { who: 0, line: 'good. i needed to hear it gets less bad' },
      { who: 2, line: 'nobody tells you how loud an empty apartment is' },
      { who: 3, line: 'you build it back slower than you’d like. but you do' },
      { who: 1, line: 'one okay day at a time. that’s the whole trick' },
    ],
  },
  {
    id: 'just-venting',
    glyph: '⚡',
    title: 'just need to vent',
    teaser: 'no advice, just somewhere to put it',
    turns: [
      { who: 0, line: 'i don’t want solutions i just want to say it was a bad day' },
      { who: 1, line: 'understood. floor is yours. we’re just nodding' },
      { who: 0, line: 'everything that could go wrong went wrong. all of it' },
      { who: 2, line: 'that’s allowed. some days are just like that' },
      { who: 3, line: 'you don’t have to be okay in here. that’s the point' },
      { who: 0, line: 'okay. that actually helped. thank you' },
    ],
  },
]

function hash(text: string): number {
  let h = 9
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 0x7fffffff
  return h
}

/** A consistent, distinct voice seed per speaker within a topic. */
export function voiceSeedFor(topic: GroupTopic, who: number): number {
  return (hash(topic.id) + who * 1777) % 90000
}

/** Day-rotated turn order so the same group sounds a little different each night. */
export function orderedTurns(topic: GroupTopic, now = Date.now()): GroupTurn[] {
  const day = Math.floor(now / 86400000)
  const start = day % topic.turns.length
  return topic.turns.map((_, i) => topic.turns[(start + i) % topic.turns.length])
}

export interface GroupHandlers {
  onTurn?: (turn: GroupTurn, index: number) => void
  onEnd?: () => void
}

export interface GroupSession {
  stop: () => void
}

/**
 * Play a topic's conversation: each line spoken in its speaker's voice, traded
 * with a natural pause, over a low murmur of others. Falls back to wordless
 * murmur turns when the device has no speech voices. Returns a stop handle.
 */
export function playGroupConversation(topic: GroupTopic, handlers: GroupHandlers = {}): GroupSession {
  let stopped = false
  let timer = 0
  let bedTimer = 0
  const turns = orderedTurns(topic)
  let i = 0

  const canSpeak = speechSupported()

  // a low bed of other voices in the room, refreshed so it never fully drops
  const refreshBed = () => {
    if (stopped) return
    void playChainBlend([
      { kind: 'voice', seed: hash(topic.id) + 1, durationMs: 9000, volume: 0.05 },
      { kind: 'whisper', seed: hash(topic.id) + 5, durationMs: 8000, volume: 0.045, delayMs: 1500 },
    ])
    bedTimer = window.setTimeout(refreshBed, 8500)
  }

  const next = () => {
    if (stopped) return
    if (i >= turns.length) {
      window.clearTimeout(bedTimer)
      stopChainPlayback()
      handlers.onEnd?.()
      return
    }
    const turn = turns[i]
    handlers.onTurn?.(turn, i)
    const seed = voiceSeedFor(topic, turn.who)
    if (canSpeak) {
      speakSignal(turn.line, seed, {
        onEnd: () => {
          if (stopped) return
          i++
          // a beat between turns, a touch longer after a full stop
          const pause = 420 + (turn.line.endsWith('.') || turn.line.endsWith('?') ? 320 : 0)
          timer = window.setTimeout(next, pause)
        },
      })
    } else {
      // no device voices: a murmur stands in for the turn so the room still sounds alive
      void playChainBlend([{ kind: turn.who % 2 ? 'whisper' : 'voice', seed, durationMs: 2600, volume: 0.22 }])
      i++
      timer = window.setTimeout(next, 2800)
    }
  }

  if (canSpeak) refreshBed()
  next()

  return {
    stop: () => {
      stopped = true
      window.clearTimeout(timer)
      window.clearTimeout(bedTimer)
      cancelSpeech()
      stopChainPlayback()
    },
  }
}
