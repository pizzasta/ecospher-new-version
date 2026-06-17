// Signal Search: one glowing palette that reaches everything — signals,
// relics, rooms, capsules, chains, the sea, dead zones — by name OR by
// feeling ("can't sleep", "driving at night", "people laughing").
// Results carry a sample seed so the palette can leak a tiny audio preview.

import type { SampleKind } from './sampleAudio'
import { currentDrop } from './frequencyDrops'
import { readLastVoiceAt, silentDays } from './weightOfSilence'

export type SearchEntry = {
  id: string
  title: string
  sub: string
  /** screen route id the result opens */
  page: string
  kind: SampleKind
  seed: number
  tags: string[]
}

export type DiscoveryRow = SearchEntry & { reason: string }

const E = (id: string, title: string, sub: string, page: string, kind: SampleKind, seed: number, tags: string[]): SearchEntry =>
  ({ id, title, sub, page, kind, seed, tags })

export function buildSearchIndex(): SearchEntry[] {
  return [
    // relics — the tapes
    E('rl1', 'unlabeled tape, side B', 'a second voice hums along underneath', 'relics', 'tone', 311, ['relic', 'tape', 'humming', 'comfort', 'background', 'quiet', 'mystery']),
    E('rl2', 'heartbeat on the night bus', 'still keeps time', 'relics', 'whisper', 322, ['relic', 'insomnia', 'sleep', 'quiet', 'heartbeat', 'calm', 'comforting']),
    E('rl3', 'voicemail, number unknown', 'one name, three times', 'relics', 'voice', 333, ['relic', 'voicemail', 'unresolved', 'heavy', 'deleted', 'mystery']),
    E('rl4', 'static that turns into a song', 'stop trying to hear it', 'relics', 'static', 344, ['relic', 'music', 'songs', 'static', 'radio', 'stayed']),
    E('rl5', 'half a confession', 'cut off where it mattered', 'relics', 'voice', 355, ['relic', 'unfinished', 'confession', 'unresolved', 'heavy', 'replayed endings', 'ending']),
    E('rl6', 'answering machine, 1999', 'eleven saved messages, each kinder', 'relics', 'voice', 366, ['relic', 'heartbreak', 'heavy', 'messages', 'unresolved', 'replayed']),
    E('rl7', 'the hold music', 'people replay the cough at minute 22', 'relics', 'tone', 377, ['relic', 'music', 'background', 'comfort', 'waiting', 'replayed heavily']),
    E('rl8', 'wind through a screen door', "someone's whole summer, by accident", 'relics', 'static', 388, ['relic', 'comfort', 'comforting', 'background', 'quiet', 'summer', 'stayed', 'songs people stayed in']),
    E('rl9', 'last bus announcement', 'a route cancelled the next morning', 'relics', 'zone', 399, ['relic', 'driving', 'night', 'driving at night', 'lonely', 'ending']),
    E('rl10', 'sealed birthday tape', 'nobody ever came back for it', 'relics', 'static', 410, ['relic', 'sealed', 'almost sent', 'unopened', 'heavy', 'mystery']),
    // rooms — live voices
    E('rm1', "Can't Sleep room", 'for everyone staring at the ceiling right now', 'rooms', 'whisper', 521, ['room', 'insomnia', "can't sleep", 'cant sleep', 'sleep', 'quiet', 'late night']),
    E('rm2', 'Missing Someone room', "for whoever's on your mind right now", 'rooms', 'voice', 532, ['room', 'heartbreak', 'heavy', 'missing', 'unresolved']),
    E('rm3', 'Late Night Driving room', 'voices for the empty highway', 'rooms', 'zone', 543, ['room', 'driving', 'driving at night', 'lonely', 'night']),
    E('rm4', 'Oversharing Hour room', 'no context, no shame, full stories', 'rooms', 'laugh', 554, ['room', 'chaotic', 'laughing', 'people laughing', 'funny', 'loud']),
    E('rm5', 'Comfort Room', "like a weighted blanket but it's voices", 'rooms', 'whisper', 565, ['room', 'comfort', 'comforting', 'quiet', 'soft', 'late night comfort']),
    E('rm6', 'Songwriters Awake room', 'people sharing unfinished songs tonight', 'rooms', 'tone', 576, ['room', 'music', 'songs', 'unfinished', 'creative', 'songs people stayed in']),
    E('rm7', 'Post Argument room', 'just had a fight. decompress here', 'rooms', 'static', 587, ['room', 'unresolved', 'argument', 'heavy', 'chaotic', 'unfinished conversations']),
    // capsules + drops
    E('cp1', 'the rare frequency drop', '24 hours, then it never exists again', 'capsules', 'tone', 611, ['capsule', 'rare', 'drop', 'tonight', 'urgent', 'replay storm']),
    E('cp2', 'the unmarked capsule', 'still forming — come back when ready', 'capsules', 'static', 622, ['capsule', 'forming', 'waiting', 'mystery']),
    E('cp3', 'ghost signal of the day', 'rotates at midnight', 'capsules', 'whisper', 633, ['capsule', 'ghost', 'abandoned', 'quiet', 'mystery']),
    // chains
    E('ch1', 'insomnia chain', 'strangers layering voices instead of sleeping', 'chains', 'whisper', 711, ['chain', 'insomnia', "can't sleep", 'sleep', 'voices', 'choir']),
    E('ch2', 'anonymous choir', 'the internet accidentally singing together', 'chains', 'tone', 722, ['chain', 'music', 'singing', 'songs', 'choir', 'emotionally active']),
    E('ch3', 'breakup chain', 'what nobody got to say, layered', 'chains', 'voice', 733, ['chain', 'heartbreak', 'heavy', 'unresolved', 'unfinished conversations']),
    E('ch4', 'driving at night chain', 'steering-wheel rhythms and last exits', 'chains', 'zone', 744, ['chain', 'driving', 'driving at night', 'night', 'lonely']),
    // the sea
    E('sea1', 'the frequency sea', 'live emotional audio drifting nearby', 'frequencies', 'static', 811, ['sea', 'drift', 'ocean', 'ambient', 'background voices', 'quiet signals nearby']),
    E('sea2', 'group laughter, far away', 'somewhere across the water', 'frequencies', 'laugh', 822, ['sea', 'laughing', 'people laughing', 'funny', 'distant']),
    E('sea3', 'someone humming alone', 'a tune nobody can place', 'frequencies', 'tone', 833, ['sea', 'music', 'humming', 'quiet', 'comfort']),
    // drift radar
    E('dr1', 'the drift radar', 'hold the water, move through live moments', 'drift', 'voice', 911, ['radar', 'drift', 'scan', 'discover', 'overhear']),
    E('dr2', 'silence, but nobody leaves', 'a signal on the radar right now', 'drift', 'static', 922, ['radar', 'quiet', 'silence', 'comfort', 'staying']),
    E('dr3', 'arguing, softly', 'overheard from a distance', 'drift', 'static', 933, ['radar', 'argument', 'unresolved', 'heavy', 'unfinished conversations']),
    // dead zones
    E('dz1', 'dead zones', 'rooms that went quiet — fragments still inside', 'zones', 'zone', 1011, ['dead zone', 'abandoned', 'quiet', 'recover', 'lost', 'fading']),
    E('dz2', '"anyway. goodnight." — recovered', 'said to an empty room', 'zones', 'whisper', 1022, ['dead zone', 'abandoned', 'ending', 'replayed endings', 'goodnight', 'heavy']),
    // unsent
    E('un1', 'the unsent room', 'say the thing you never sent', 'unsent', 'voice', 1111, ['unsent', 'confession', 'unfinished', 'almost sent', 'heavy', 'unfinished conversations']),
    // anomalies
    E('an1', 'signal anomalies', 'irregularities in the emotional spectrum', 'anomalies', 'static', 1511, ['anomaly', 'anomalies', 'glitch', 'rare', 'irregular', 'spectrum', 'strange', 'spike']),
    // observatory + settings (reachable even in minimal nav)
    E('obs1', 'the observatory', 'tonight\'s daily signal and the live band', 'home', 'tone', 1311, ['observatory', 'home', 'daily', 'tonight', 'start']),
    E('set1', 'settings', 'tune your presence — night protocol, lurker mode, display', 'settings', 'static', 1411, ['settings', 'preferences', 'night', 'lurker', 'language', 'display', 'sign out']),
    // profile + dashboard + transmit (reachable from search even in minimal nav)
    E('pod1', 'your profile', 'how you listen, not who you say you are', 'pod', 'tone', 1211, ['hub', 'profile', 'identity', 'you', 'pod', 'anthem', 'signal name']),
    E('dash1', 'your dashboard', 'your private band — saved voices, recap, signal to self', 'dashboard', 'static', 1212, ['dashboard', 'private', 'saved', 'recap', 'listening history', 'signal to self', 'you']),
    E('tx1', 'transmissions', 'speak into a frequency — no inbox, an echo finds you', 'transmit', 'voice', 1213, ['transmit', 'message', 'messaging', 'dm', 'frequency', 'echo', 'send', 'whisper']),
  ]
}

/** Score by phrase + word overlap across title/sub/tags. Feeling-first. */
export function searchSignals(query: string, index: SearchEntry[] = buildSearchIndex()): SearchEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const words = q.split(/\s+/).filter(w => w.length > 1)
  const scored = index
    .map(entry => {
      const hay = `${entry.title} ${entry.sub} ${entry.tags.join(' ')}`.toLowerCase()
      let score = 0
      if (hay.includes(q)) score += 6
      for (const tag of entry.tags) {
        if (tag === q) score += 8
        else if (q.includes(tag) || tag.includes(q)) score += 3
      }
      for (const w of words) if (hay.includes(w)) score += 2
      return { entry, score }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, 8).map(r => r.entry)
}

/** Empty-query state: emotionally intelligent suggestions from real behavior. */
export function discoverySuggestions(now = Date.now()): DiscoveryRow[] {
  const rows: DiscoveryRow[] = []
  const index = buildSearchIndex()
  const by = (id: string) => index.find(e => e.id === id)

  // you may return to this: the relic you handled most
  try {
    const activity = JSON.parse(window.localStorage.getItem('ecosphere:relicActivity') ?? '{}') as Record<string, { replays?: number }>
    const top = Object.entries(activity).sort((a, b) => (b[1].replays ?? 0) - (a[1].replays ?? 0))[0]
    const entry = top && (top[1].replays ?? 0) > 0 ? by(top[0]) : null
    if (entry) rows.push({ ...entry, reason: 'you may return to this' })
  } catch { /* fresh device */ }

  // your chain is growing
  try {
    const layers = JSON.parse(window.localStorage.getItem('ecosphere:chainLayers') ?? '[]') as unknown[]
    if (layers.length > 0) {
      const entry = by('ch2')
      if (entry) rows.push({ ...entry, reason: 'a chain with your voice in it is still growing' })
    }
  } catch { /* none */ }

  // resurfacing tonight: the live drop when one is open
  if (currentDrop(now)) {
    const entry = by('cp1')
    if (entry) rows.push({ ...entry, reason: 'resurfacing tonight — gone in hours' })
  }

  // the silence nudge
  const quietDays = silentDays(readLastVoiceAt(), now)
  if (quietDays != null && quietDays >= 2) {
    const entry = by('un1')
    if (entry) rows.push({ ...entry, reason: `it's been ${quietDays} days since your last voice` })
  }

  // fill with rotating ambient picks so the palette never opens empty
  const ambient: Array<[string, string]> = [
    ['sea1', 'quiet signals nearby'],
    ['rm1', 'listeners who stayed here also replayed'],
    ['dr2', 'matching your current drift'],
    ['rl8', 'voices people stayed inside'],
  ]
  const hour = new Date(now).getHours()
  for (const [id, reason] of ambient) {
    if (rows.length >= 5) break
    const entry = by(id)
    if (entry && !rows.some(r => r.id === id)) {
      rows.push({ ...entry, reason: hour >= 22 || hour < 5 ? `${reason} · after dark` : reason })
    }
  }
  return rows.slice(0, 5)
}
