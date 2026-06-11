// Listening identity: the hub shouldn't report stats, it should reflect
// behavior. Everything here derives from data the app already tracks —
// no new collection, just interpretation.

export type IdentityInteraction = {
  type: string
  label: string
  page?: string
  createdAt: string
}

export type IdentityListen = {
  label: string
  playedAt: string
}

export type IdentityInput = {
  interactions: IdentityInteraction[]
  listens: IdentityListen[]
  savedCount: number
  recordingsCount: number
  silentDays: number | null
  streak: number
}

const HOUR = 60 * 60 * 1000

function hourOf(iso: string): number {
  return new Date(iso).getHours()
}

function withinHours(iso: string, hours: number, now: number): boolean {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && now - t <= hours * HOUR
}

/** label → how many times it was played */
function replayCounts(listens: IdentityListen[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const listen of listens) counts.set(listen.label, (counts.get(listen.label) ?? 0) + 1)
  return counts
}

function nightShare(listens: IdentityListen[]): number {
  if (listens.length === 0) return 0
  const night = listens.filter(l => { const h = hourOf(l.playedAt); return h >= 0 && h < 5 }).length
  return night / listens.length
}

function topPage(interactions: IdentityInteraction[]): string | null {
  const counts = new Map<string, number>()
  for (const it of interactions) {
    if (it.page && it.page !== 'pod' && it.page !== 'settings') {
      counts.set(it.page, (counts.get(it.page) ?? 0) + 1)
    }
  }
  let best: string | null = null
  let bestCount = 0
  for (const [page, count] of counts) {
    if (count > bestCount) { best = page; bestCount = count }
  }
  return best
}

const PAGE_TRAITS: Record<string, string> = {
  zones: 'lingers in dead zones',
  unsent: 'keeps returning to unsent things',
  frequencies: 'drifts the open sea more than the rooms',
  rooms: 'a rooms regular — usually listening, not talking',
  relics: 'spends time with old tapes',
  capsules: 'checks on sealed things',
  drift: 'follows the drift wherever it goes',
  signals: 'returns to unresolved fragments',
  home: 'watches the band from the observatory',
}

/** 3-4 short lines describing how this person listens. */
export function deriveTraits(input: IdentityInput, now = Date.now()): string[] {
  const traits: string[] = []

  // active hours from actual listening times
  const hours = input.listens.map(l => hourOf(l.playedAt))
  if (hours.length >= 3) {
    const buckets = [0, 0, 0, 0] // night 0-5, morning 5-12, day 12-19, evening 19-24
    for (const h of hours) buckets[h < 5 ? 0 : h < 12 ? 1 : h < 19 ? 2 : 3] += 1
    const top = buckets.indexOf(Math.max(...buckets))
    traits.push(['most active between 1am and 4am', 'a morning listener, strangely', 'listens in daylight like it\'s nothing', 'most active after dark'][top])
  }

  const page = topPage(input.interactions)
  if (page && PAGE_TRAITS[page]) traits.push(PAGE_TRAITS[page])

  // replay habits
  const repeats = [...replayCounts(input.listens).values()].filter(c => c >= 2).length
  if (repeats >= 2) traits.push('replays the same fragments instead of finding new ones')
  else if (input.listens.length >= 6) traits.push('rarely replays — always moving')

  // voice vs silence
  const reactions = input.interactions.filter(it => it.type === 'voice_reaction').length
  if (reactions === 0 && input.listens.length >= 4) traits.push('rarely reacts. stays anyway')
  else if (reactions >= 3) traits.push('leaves more reactions than most')

  if (input.recordingsCount === 0 && input.listens.length >= 3) traits.push('all ears, no transmissions yet')
  if (input.streak >= 4) traits.push(`${input.streak} nights without missing the band`)

  void now
  return traits.slice(0, 4)
}

/** One dynamic state word-phrase. Changes with behavior, not configuration. */
export function deriveAtmosphere(input: IdentityInput, now = Date.now()): string {
  const lastHourPlays = input.listens.filter(l => withinHours(l.playedAt, 1, now)).length
  const tonightPlays = input.listens.filter(l => withinHours(l.playedAt, 8, now)).length
  const counts = replayCounts(input.listens.filter(l => withinHours(l.playedAt, 8, now)))
  const loopedTonight = [...counts.values()].some(c => c >= 3)
  const hour = new Date(now).getHours()

  if (loopedTonight) return 'replay loop detected'
  if (lastHourPlays >= 3) return 'unstable replay cycle'
  if (input.silentDays != null && input.silentDays >= 3) return 'low signal'
  if (tonightPlays >= 5) return 'emotionally saturated'
  if (tonightPlays >= 2 && hour >= 0 && hour < 5) return 'drifting heavily'
  if (tonightPlays >= 2) return 'emotionally active'
  if (hour >= 0 && hour < 5) return 'lingering'
  return 'quiet tonight'
}

/** Stats with feelings attached — replaces "4 replays, 1 archived". */
export function tonightLines(input: IdentityInput, now = Date.now()): string[] {
  const lines: string[] = []
  const tonight = input.listens.filter(l => withinHours(l.playedAt, 12, now))

  if (tonight.length > 0) {
    lines.push(`${tonight.length} signal${tonight.length === 1 ? '' : 's'} resurfaced tonight`)
  }

  const counts = replayCounts(input.listens)
  const looped = [...counts.entries()].filter(([, c]) => c >= 2)
  if (looped.length > 0) {
    lines.push(`you came back to "${looped[0][0]}" again`)
  }

  const night = nightShare(input.listens)
  if (input.listens.length >= 4 && night >= 0.4) {
    lines.push('late-night activity increasing')
  }

  const zoneVisits = input.interactions.filter(it => it.page === 'zones').length
  if (zoneVisits >= 2) {
    lines.push('1 abandoned fragment followed you back')
  }

  if (lines.length === 0) {
    lines.push(input.silentDays != null && input.silentDays >= 1 ? 'the band held your frequency while you were gone' : 'nothing resurfaced yet. the night is early')
  }

  return lines.slice(0, 3)
}

/** What the hub remembers about you. 1-2 lines, only when earned. */
export function memoryLines(input: IdentityInput, now = Date.now()): string[] {
  const lines: string[] = []

  const tonightCounts = replayCounts(input.listens.filter(l => withinHours(l.playedAt, 12, now)))
  const returned = [...tonightCounts.entries()].find(([, c]) => c >= 2)
  if (returned) lines.push('you came back to the same signal again tonight')

  if (input.listens.length >= 5 && nightShare(input.listens) >= 0.5) {
    lines.push('you replay more after midnight')
  }

  const roomVisits = input.interactions.filter(it => it.page === 'rooms').length
  const otherVisits = input.interactions.filter(it => it.page && it.page !== 'rooms').length
  if (otherVisits >= 6 && roomVisits === 0) lines.push('you avoid crowded rooms')

  const zoneVisits = input.interactions.filter(it => it.page === 'zones').length
  if (zoneVisits >= 3) lines.push('you revisit abandoned fragments often')

  return lines.slice(0, 2)
}

// ─── humanized activity ───────────────────────────────────────────────────────

const PAGE_DRIFT_LINES: Record<string, string> = {
  rooms: 'drifted past the rooms without entering',
  frequencies: 'floated the frequency sea for a while',
  zones: 'walked the dead zones again',
  unsent: 'sat with the unsent signals',
  relics: 'handled the old tapes',
  capsules: 'checked the seals',
  drift: 'followed the drift field',
  signals: 'scrolled the band slowly',
  home: 'watched the observatory',
}

export type HumanActivity = { id: string; text: string; createdAt: string }

/** Collapses raw interactions into human lines; repeats become counts. */
export function humanizeActivity(interactions: IdentityInteraction[], limit = 8): HumanActivity[] {
  const out: HumanActivity[] = []
  let i = 0
  while (i < interactions.length && out.length < limit) {
    const it = interactions[i]
    // group consecutive plays of the same thing
    if (it.type === 'signal_play') {
      let run = 1
      while (i + run < interactions.length && interactions[i + run].type === 'signal_play' && interactions[i + run].label === it.label) run += 1
      const what = it.label.replace(/^played /, '')
      out.push({
        id: `${it.createdAt}-${i}`,
        text: run > 1 ? `replayed ${what} ${run} times` : `replayed ${what}`,
        createdAt: it.createdAt,
      })
      i += run
      continue
    }

    let text: string | null = null
    if (it.type === 'page_visit') text = PAGE_DRIFT_LINES[it.page ?? ''] ?? null
    else if (it.type === 'voice_reaction') text = 'left a voice reaction behind'
    else if (it.type === 'room_enter') text = `slipped into ${it.label.replace(/^entered chamber /, '').replace(/-/g, ' ')}`
    else if (it.type === 'signal_saved') text = it.label.replace(/^kept /, 'kept ') // already human
    else if (it.type === 'relic_unlocked') text = it.label.replace(/^discovered relic /, 'recovered ')
    else if (it.type === 'capsule_opened') text = it.label.replace(/^opened /, 'broke the seal on ')
    else if (it.type === 'drift_discovery' || it.type === 'drift_activity') text = it.label
    else text = it.label

    if (text) out.push({ id: `${it.createdAt}-${i}`, text, createdAt: it.createdAt })
    i += 1
  }
  return out
}
