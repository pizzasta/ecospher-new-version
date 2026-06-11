// Daily Frequency Summary: a short, automated audio recap of the user's
// last day in the ecosphere — three signals from where they drifted, one
// capsule reminder, an ambient open and close. Everything is synthesized
// locally from their actual state; nothing leaves the device.

import type { SampleKind } from './sampleAudio'

export type RecapSegment = {
  id: string
  kind: SampleKind
  seed: number
  durationMs: number
  caption: string
  line: string
}

export type RecapScript = {
  date: string
  greeting: string
  closing: string
  segments: RecapSegment[]
}

export type RecapInput = {
  visitedPages: string[]
  listenedLabels: string[]
  streak: number
  resonance: number
  silentDays: number | null
  personalCapsules: number
}

const PAGE_LINES: Record<string, string[]> = {
  rooms: ['a room you sat in kept talking after you left.', 'the room you visited is still warm.'],
  unsent: ['one of the unsent signals got replayed while you were gone.', 'the unsent room held everything exactly where you left it.'],
  frequencies: ['the sea you drifted through moved a buoy overnight.', 'something surfaced near where you were floating.'],
  zones: ['a dead zone you touched recovered another fragment.', 'the corruption you listened to has gotten quieter.'],
  capsules: ['a seal you considered breaking is still intact.', 'the capsules shifted half an inch in storage. nobody saw it.'],
  relics: ['a relic you examined hummed once at 4am.', 'dust settled differently on the cassette you played.'],
  drift: ['the drift field redrew itself around your last position.', 'a node you opened is brighter tonight.'],
  home: ['the observatory logged your watch hours.', 'the daily signal you tuned into found three more listeners.'],
}

function hashString(text: string): number {
  let hash = 7
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000
  }
  return hash
}

function pickFor(pool: string[], seed: number): string {
  return pool[seed % pool.length]
}

export function buildRecapScript(input: RecapInput, now = new Date()): RecapScript {
  const dateLabel = now.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const daySeed = hashString(dateLabel) + now.getFullYear()
  const segments: RecapSegment[] = []

  segments.push({
    id: 'open',
    kind: 'tone',
    seed: daySeed,
    durationMs: 3200,
    caption: 'opening the band',
    line: `frequency recap · ${dateLabel}`,
  })

  // three echoes from where they actually drifted (fall back to the
  // observatory if they only watched)
  const pages = input.visitedPages.filter(p => PAGE_LINES[p])
  const sources = pages.length > 0 ? pages : ['home']
  const kinds: SampleKind[] = ['voice', 'whisper', 'static']
  for (let i = 0; i < 3; i += 1) {
    const page = sources[i % sources.length]
    const listened = input.listenedLabels[i]
    const seed = hashString(`${page}-${i}`) + daySeed
    segments.push({
      id: `echo-${i + 1}`,
      kind: kinds[i],
      seed,
      durationMs: 4200 + (seed % 1800),
      caption: `echo ${i + 1} of 3 · ${page}`,
      line: listened ? `you replayed "${listened}". it noticed.` : pickFor(PAGE_LINES[page], seed),
    })
  }

  segments.push({
    id: 'capsule',
    kind: 'zone',
    seed: daySeed + 47,
    durationMs: 3600,
    caption: 'capsule reminder',
    line: input.personalCapsules > 0
      ? `${input.personalCapsules} sealed transmission${input.personalCapsules === 1 ? '' : 's'} of yours still waiting to be broken.`
      : 'the unmarked capsule keeps forming whether you watch it or not.',
  })

  segments.push({
    id: 'close',
    kind: 'tone',
    seed: daySeed + 93,
    durationMs: 3000,
    caption: 'closing the band',
    line: input.silentDays != null && input.silentDays >= 2
      ? `it has been ${input.silentDays} days since your voice. no pressure. the channel stays open.`
      : `resonance ${Math.round(input.resonance)}% · ${input.streak > 0 ? `${input.streak} night streak` : 'the band held steady'} · see you tonight.`,
  })

  return {
    date: dateLabel,
    greeting: 'your frequency recap is ready.',
    closing: 'transmission complete. the ecosystem keeps listening.',
    segments,
  }
}

// ─── daily gate ───────────────────────────────────────────────────────────────

const RECAP_SHOWN_KEY = 'ecosphere:lastRecapDate'

export function localDayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function recapAvailable(now = new Date()): boolean {
  try {
    return window.localStorage.getItem(RECAP_SHOWN_KEY) !== localDayKey(now)
  } catch {
    return false
  }
}

export function markRecapShown(now = new Date()) {
  try {
    window.localStorage.setItem(RECAP_SHOWN_KEY, localDayKey(now))
  } catch {
    /* storage unavailable */
  }
}
