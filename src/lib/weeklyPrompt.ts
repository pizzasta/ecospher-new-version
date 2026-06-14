// Prompt of the Week: posed on socials, answered only in the Unsent Room.
// Deterministic per ISO week so every client agrees on the live prompt —
// the same mechanism as frequency drops, no backend needed.

const PROMPTS = [
  "what is the one thing you're glad you never sent?",
  'say the apology you never got.',
  'leave the voicemail you deleted before sending.',
  "describe the last time you almost called someone. what stopped you?",
  'say it like they can finally hear you.',
  "what would you tell the person you were a year ago tonight?",
  'the text you typed and erased — say it out loud instead.',
  'what do you miss that you pretend you don\'t?',
  'say the thing you rehearsed in the shower and never used.',
  "who do you hope is doing okay? tell them here.",
  'finish this sentence out loud: "i never told anyone, but—"',
  'what would you say if you knew nobody would reply?',
] as const

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const EPOCH = Date.UTC(2026, 0, 5) // a monday

export type WeeklyPrompt = {
  id: string
  text: string
  daysLeft: number
}

export function currentPrompt(now = Date.now()): WeeklyPrompt {
  const week = Math.max(0, Math.floor((now - EPOCH) / WEEK_MS))
  const weekStart = EPOCH + week * WEEK_MS
  const daysLeft = Math.max(1, Math.ceil((weekStart + WEEK_MS - now) / (24 * 60 * 60 * 1000)))
  return {
    id: `prompt-${week}`,
    text: PROMPTS[week % PROMPTS.length],
    daysLeft,
  }
}
