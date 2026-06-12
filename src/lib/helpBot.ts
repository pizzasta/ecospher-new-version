// Help Bot — answers FAQ and safety-protocol questions from Settings → Help.
//
// Two layers:
//   1. Local knowledge base + keyword matcher — instant, offline, always works.
//   2. Optional AI answer via the `help-bot` Edge Function (Claude) when the
//      backend is configured — falls back to layer 1 on any failure.
//
// Crisis-adjacent questions ALWAYS get the crisis answer, never an AI one.

import { getOptionalSupabaseClient } from './supabase'
import { isSupabaseConfigured } from './supabase-env'

export interface HelpTopic {
  id: string
  label: string // shown as a suggested-question chip
  keywords: string[]
  answer: string
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'what-is',
    label: 'what is ecosphere?',
    keywords: ['ecosphere', 'what is this', 'this place', 'the point', 'purpose'],
    answer: "ecosphere is an anonymous, late-night, audio-first space. you record short signals, drift through rooms, and listen to strangers. no names, no photos, no follower counts — just frequencies.",
  },
  {
    id: 'record',
    label: 'how do i record?',
    keywords: ['record', 'recording', 'mic', 'microphone', 'voice', 'signal', 'audio', 'speak', 'talk'],
    answer: "hit a record button anywhere you see one — the observatory, the unsent room, or inside a voice room. the mic only turns on while you hold the recording, and everything you record is private by default until you choose to release it.",
  },
  {
    id: 'anonymous',
    label: 'am i really anonymous?',
    keywords: ['anonymous', 'anonymity', 'identity', 'real name', 'who am i', 'know me', 'find me', 'trace'],
    answer: "yes, by design. ecosphere never asks for your name, photo, phone number, or location, and there's no way to search for or message a specific person. your signal name is the only identity you have here. full details: /privacy.html",
  },
  {
    id: 'safety',
    label: 'how does moderation work?',
    keywords: ['moderation', 'moderated', 'screen', 'screened', 'guardian', 'filter', 'rules', 'allowed', 'banned', 'flagged'],
    answer: "everything public is screened automatically — in your browser and again at the database. harassment, threats, personal info, spam, sexual content, and anything involving minors never reaches the band; flagged content is forced private. no humans read your private content. it's software, and there are no appeals — keep it off the public band and you'll never notice it.",
  },
  {
    id: 'report',
    label: 'how do i report something?',
    keywords: ['report', 'reporting', 'flag', 'block', 'abuse', 'harassment', 'creep', 'predator', 'uncomfortable', 'unsafe'],
    answer: "every signal has a report option — one tap, pick a reason (harassment, spam, unsafe content, sexual content, child safety), done. reports are anonymous. if something feels predatory or involves a minor, report it with the child safety reason and it gets priority handling.",
  },
  {
    id: 'age',
    label: 'who can use this?',
    keywords: ['age', '18', 'adult', 'minor', 'kid', 'child', 'old', 'young', 'teenager', 'teen'],
    answer: "ecosphere is 18+ only. you confirm this at the gate, and accounts or content associated with minors are removed. there are intentionally no private messages, no photos, and no way to find specific people — the app is built so it has nothing to offer someone hunting for kids.",
  },
  {
    id: 'delete',
    label: 'how do i delete everything?',
    keywords: ['delete', 'erase', 'remove', 'wipe', 'forget', 'gone', 'account', 'data', 'clear'],
    answer: "two buttons in settings: 'erase cloud data' deletes your recordings, signals, reactions, and profile from the backend and signs you out; 'clear local data' wipes this device. run both and everything you ever made here is gone. no retention, no soft-delete tricks.",
  },
  {
    id: 'privacy-data',
    label: 'what data do you keep?',
    keywords: ['privacy', 'data', 'stored', 'collect', 'tracking', 'trackers', 'ads', 'sell', 'information'],
    answer: "as little as possible. most things live only in your browser. when a backend is connected it stores your anonymous account id, signal name, recordings, saves/reactions, and customizations — nothing else. no ads, no data sales, no third-party trackers. the full picture is at /privacy.html",
  },
  {
    id: 'rooms',
    label: 'what are rooms?',
    keywords: ['rooms', 'room', 'join', 'voice room', 'group', 'live', 'vibe', 'vibes', 'mic', 'talking'],
    answer: "rooms are live anonymous voice spaces — tap one to join, leave whenever. you can listen, leave a short fragment, drop a whisper, and send reaction vibes at whoever's on the mic. lurker mode (in settings) lets you stay listen-only.",
  },
  {
    id: 'unsent',
    label: "what's the unsent room?",
    keywords: ['unsent', 'letter', 'never sent', 'say the thing', 'prompt', 'weekly'],
    answer: "the unsent room is where you say the thing you never sent — record it, release it, let strangers leave reactions. there's a new prompt every week that can only be answered there.",
  },
  {
    id: 'clocks',
    label: 'capsules, drops, relics?',
    keywords: ['capsule', 'capsules', 'drop', 'drops', 'rare', 'relic', 'relics', 'shelf', 'schedule', 'time'],
    answer: "things on clocks: capsules form and open on their own schedules. rare frequency drops appear for 24 hours and never again. relics wear down the more they get handled. none of it waits for you — that's the point.",
  },
  {
    id: 'hub',
    label: "what's my hub?",
    keywords: ['hub', 'profile', 'pod', 'tape', 'cassette', 'intro', 'bio', 'color', 'colors', 'signature', 'customize'],
    answer: "your hub doesn't show who you say you are — it shows how you listen. record a ten-second cassette intro instead of a bio, pick your signature color and background wave, and the rest builds itself from your behavior.",
  },
  {
    id: 'lurker',
    label: 'can i just listen?',
    keywords: ['lurker', 'lurk', 'just listen', 'listen only', 'quiet', 'shy', 'without talking'],
    answer: "absolutely. flip on lurker mode in settings and every recorder rests — you drift through the whole ecosphere listen-only. nobody is notified, nothing looks different. lurking is a respected frequency here.",
  },
  {
    id: 'offline',
    label: 'does it work offline?',
    keywords: ['offline', 'connection', 'internet', 'no signal', 'airplane', 'sync', 'upload'],
    answer: "mostly, yes. your data lives on your device first, and recordings made offline queue up and upload when you reconnect. the band itself needs a connection to hear other people, but nothing you make gets lost.",
  },
  {
    id: 'notifications',
    label: 'notifications?',
    keywords: ['notification', 'notifications', 'push', 'bell', 'alert', 'notify'],
    answer: "the bell collects what happened while you were away — replays, reactions, drops. web push is strictly opt-in from settings, and 'enable push' is the only thing that ever asks for the permission.",
  },
  {
    id: 'terms',
    label: 'terms & legal',
    keywords: ['terms', 'legal', 'tos', 'license', 'own', 'ownership', 'copyright', 'warranty', 'law'],
    answer: "you own everything you record. making something public just lets ecosphere play it to other users inside the service — nothing more. the short version of everything legal lives at /terms.html and /privacy.html",
  },
  {
    id: 'crisis',
    label: 'i need real help',
    keywords: ['crisis', 'suicide', 'suicidal', 'kill myself', 'hurt myself', 'self harm', 'self-harm', 'want to die', 'end it', 'emergency', 'danger', 'hotline', 'help me'],
    answer: "ecosphere is not a crisis service, and you deserve more than an anonymous band right now. if you're in danger, call your local emergency number. in the US, call or text 988 (suicide & crisis lifeline). in the UK & ROI, samaritans: 116 123. elsewhere, findahelpline.com lists free lines by country. the band will still be here after.",
  },
]

const CRISIS_TOPIC = HELP_TOPICS.find(t => t.id === 'crisis')!

// crisis terms are checked as substrings of the raw query so multi-word
// phrases ("kill myself") match regardless of tokenization
const CRISIS_TERMS = ['suicid', 'kill myself', 'hurt myself', 'self harm', 'self-harm', 'want to die', 'end my life', 'crisis line', 'hotline', 'emergency']

export const HELP_FALLBACK =
  "i don't have that one on tape. try asking about recording, rooms, privacy, deleting your data, or the safety rules — or read /terms.html and /privacy.html for the formal version."

export function isCrisisQuery(query: string): boolean {
  const q = query.toLowerCase()
  return CRISIS_TERMS.some(term => q.includes(term))
}

// keyword scorer: a topic earns points per keyword found in the query;
// multi-word keywords count double because they're more specific
export function answerLocally(query: string): { topicId: string | null; text: string } {
  if (isCrisisQuery(query)) return { topicId: 'crisis', text: CRISIS_TOPIC.answer }
  const q = ` ${query.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ')} `
  let best: HelpTopic | null = null
  let bestScore = 0
  for (const topic of HELP_TOPICS) {
    let score = 0
    for (const kw of topic.keywords) {
      if (q.includes(` ${kw} `) || q.includes(`${kw}?`) || q.includes(` ${kw}s `)) {
        score += kw.includes(' ') ? 2 : 1
      }
    }
    if (score > bestScore) {
      bestScore = score
      best = topic
    }
  }
  if (!best || bestScore === 0) return { topicId: null, text: HELP_FALLBACK }
  return { topicId: best.id, text: best.answer }
}

export interface HelpBotReply {
  text: string
  source: 'ai' | 'local'
}

// Ask the bot. Tries the Claude-backed Edge Function when a backend is
// configured; any failure (function not deployed, no key, network) falls
// back to the local matcher so the bot never goes silent.
export async function askHelpBot(
  query: string,
  history: Array<{ role: 'user' | 'bot'; text: string }> = [],
): Promise<HelpBotReply> {
  const trimmed = query.trim().slice(0, 400)
  if (!trimmed) return { text: HELP_FALLBACK, source: 'local' }
  // crisis questions are answered locally, verbatim, every time
  if (isCrisisQuery(trimmed)) return { text: CRISIS_TOPIC.answer, source: 'local' }

  if (isSupabaseConfigured) {
    const client = getOptionalSupabaseClient()
    if (client) {
      try {
        const { data, error } = await client.functions.invoke<{ answer?: string }>('help-bot', {
          body: {
            question: trimmed,
            history: history.slice(-6).map(m => ({ role: m.role, text: m.text.slice(0, 400) })),
          },
        })
        const text = typeof data?.answer === 'string' ? data.answer.trim() : ''
        if (!error && text) return { text: text.slice(0, 1200), source: 'ai' }
      } catch { /* fall through to local */ }
    }
  }
  return { ...answerLocally(trimmed), source: 'local' }
}
