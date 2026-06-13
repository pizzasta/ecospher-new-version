// Group conversations: tap a topic and actually hear a small group talking
// about it — short lines, traded back and forth, each speaker in their own
// voice. Real device voices carry the words (see speech.ts) over a low murmur
// of others in the room. The scripts are simulated and deterministic, in the
// app's plain late-night register — nothing here pretends to be a real person's
// recording.

import { speakSignal, speechSupported, cancelSpeech } from './speech'
import { playChainBlend, stopChainPlayback } from './sampleAudio'
import { moderatePublicSignalText } from './signalModeration'

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
  {
    id: 'burnt-out',
    glyph: '⚙',
    title: 'burnt out',
    teaser: 'running on empty, said plainly',
    turns: [
      { who: 0, line: 'i’m not sad i’m just so tired of everything' },
      { who: 1, line: 'that’s burnout. it dresses up as laziness' },
      { who: 2, line: 'i did nothing today and still felt behind' },
      { who: 0, line: 'yes. exactly that. behind on what though' },
      { who: 3, line: 'rest isn’t a reward you earn. you’re allowed it now' },
      { who: 1, line: 'screenshotting that for monday me' },
    ],
  },
  {
    id: 'cancelled-plans',
    glyph: '◌',
    title: 'social battery dead',
    teaser: 'the relief of staying in',
    turns: [
      { who: 0, line: 'i cancelled and immediately felt better. is that bad' },
      { who: 1, line: 'no. some plans you make just to feel normal' },
      { who: 2, line: 'i love them i just can’t be perceived tonight' },
      { who: 3, line: 'being home in soft clothes is a personality. mine' },
      { who: 0, line: 'okay good. we’re all just recharging in here' },
    ],
  },
  {
    id: 'the-drive',
    glyph: '⇆',
    title: 'the late drive',
    teaser: 'nowhere to be, just going',
    turns: [
      { who: 0, line: 'sometimes i just drive with no destination at night' },
      { who: 1, line: 'empty roads and one good song. unbeatable' },
      { who: 2, line: 'i do my best thinking at like 60 on the highway' },
      { who: 0, line: 'something about moving makes the thoughts quieter' },
      { who: 3, line: 'just don’t check how much gas this is costing us' },
      { who: 1, line: 'we don’t talk about that in the drive room' },
    ],
  },
  {
    id: 'comparing',
    glyph: '◬',
    title: 'comparing again',
    teaser: 'the scroll that ruins the night',
    turns: [
      { who: 0, line: 'why does everyone seem further ahead than me' },
      { who: 1, line: 'because you’re seeing their highlights, not their 3am' },
      { who: 2, line: 'i had to mute like nine people to breathe' },
      { who: 0, line: 'i keep forgetting the timeline is fake' },
      { who: 3, line: 'put the phone face down. you’re doing fine' },
      { who: 1, line: 'face down phone club, in session' },
    ],
  },
  {
    id: 'one-good-thing',
    glyph: '✿',
    title: 'one good thing',
    teaser: 'naming the one good thing today',
    turns: [
      { who: 0, line: 'the coffee was actually perfect this morning' },
      { who: 1, line: 'a stranger held the door and i almost cried' },
      { who: 2, line: 'my plant grew a new leaf. small but mine' },
      { who: 3, line: 'i laughed at something dumb and meant it' },
      { who: 0, line: 'okay we’re all going to be okay actually' },
    ],
  },
]

// ─── custom groups: anyone can start one ──────────────────────────────────────

const CUSTOM_KEY = 'ecosphere:customGroups'

function wc(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function isCustomTopic(id: string): boolean {
  return id.startsWith('custom_')
}

export function loadCustomTopics(): GroupTopic[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(CUSTOM_KEY) ?? '[]') as GroupTopic[]
    return Array.isArray(raw)
      ? raw.filter(t => t && typeof t.id === 'string' && Array.isArray(t.turns) && t.turns.length > 0)
      : []
  } catch { return [] }
}

function persistCustom(list: GroupTopic[]): void {
  try { window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(list.slice(0, 8))) } catch { /* session only */ }
}

/** Start your own group from a title and a first line. Screened before it opens. */
export function createCustomTopic(title: string, firstLine: string): { topic: GroupTopic } | { error: string } {
  const t = title.trim().replace(/\s+/g, ' ').slice(0, 40)
  const line = firstLine.trim().replace(/\s+/g, ' ').slice(0, 90)
  if (t.length < 3) return { error: 'give it a name first' }
  if (wc(line) < 3) return { error: 'add a first line to get it going' }
  if (moderatePublicSignalText(t).status === 'flagged' || moderatePublicSignalText(line).status === 'flagged') {
    return { error: "that can't open a group here. try it softer." }
  }
  const topic: GroupTopic = {
    id: `custom_${Date.now().toString(36)}`,
    glyph: '✦',
    title: t,
    teaser: 'a group someone started',
    turns: [{ who: 0, line }],
  }
  persistCustom([topic, ...loadCustomTopics()])
  return { topic }
}

/** Add a line to a custom group; speakers cycle so it sounds like more than one voice. */
export function addLineToCustom(id: string, line: string): GroupTopic | null {
  const clean = line.trim().replace(/\s+/g, ' ').slice(0, 90)
  if (wc(clean) < 3 || moderatePublicSignalText(clean).status === 'flagged') return null
  const list = loadCustomTopics()
  const idx = list.findIndex(t => t.id === id)
  if (idx < 0) return null
  const topic = list[idx]
  const updated: GroupTopic = { ...topic, turns: [...topic.turns, { who: topic.turns.length % 4, line: clean }].slice(0, 24) }
  list[idx] = updated
  persistCustom(list)
  return updated
}

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
