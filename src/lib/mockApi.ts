// In-memory mock backend for MVP flows that don't need Supabase.
// Mirrors the REST surface a real backend would expose:
//   GET  /api/signals        → apiGetSignals()
//   GET  /api/rooms          → apiGetRooms()
//   POST /api/react          → apiReact({ signalId, reactionType })
//   POST /api/capsule/break  → apiBreakCapsule({ capsuleId })
// Every call resolves to a MockResponse with an HTTP-style status code so
// callers can be swapped to fetch() later without changing their logic.

export type MockResponse<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; body: { error: string } }

export type MockSignal = {
  id: string
  handle: string
  time: string
  content: string
  mood: string
  resonance: number
  anonymous: boolean
}

export type MockRoom = {
  id: string
  name: string
  category: string
  occupancy: number
}

export type ReactionType = 'felt' | 'same' | 'here' | 'again' | 'loud'

const REACTION_TYPES: readonly ReactionType[] = ['felt', 'same', 'here', 'again', 'loud']

const signalStore: MockSignal[] = [
  { id: 's1', handle: 'anonymous_03:14', time: '3 min ago', content: 'still awake. the quiet feels different tonight. like something is about to remember itself.', mood: 'nocturne', resonance: 94, anonymous: true },
  { id: 's2', handle: 'signal_veil', time: '11 min ago', content: 'replaying that moment again. the part before everything shifted. i keep landing in the same second.', mood: 'drift', resonance: 87, anonymous: false },
  { id: 's3', handle: 'anonymous_fade', time: '22 min ago', content: 'found a pocket of warm static on the radio. there is something almost like a song inside it.', mood: 'static', resonance: 79, anonymous: true },
  { id: 's4', handle: 'lost_carrier_7', time: '44 min ago', content: 'there are frequencies you only hear when no one else is listening. late night internet knows this.', mood: 'lost', resonance: 63, anonymous: false },
  { id: 's5', handle: 'anonymous_0:48', time: '1 hr ago', content: "the ecosystem held the channel open. like it was waiting for something i hadn't said yet.", mood: 'bloom', resonance: 91, anonymous: true },
]

const roomStore: MockRoom[] = [
  { id: 'r1', name: "can't sleep again", category: 'late night', occupancy: 14 },
  { id: 'r2', name: 'people venting quietly', category: 'release', occupancy: 9 },
  { id: 'r3', name: 'music playing nearby', category: 'ambient', occupancy: 22 },
  { id: 'r4', name: 'deep talks at low volume', category: 'connection', occupancy: 6 },
  { id: 'r5', name: 'lonely tonight', category: 'company', occupancy: 11 },
  { id: 'r6', name: 'the 3am drive', category: 'drift', occupancy: 4 },
]

const reactionCounts = new Map<string, Record<ReactionType, number>>()

const capsuleContentStore: Record<string, { line: string; audioSeed: number }> = {
  c1: { line: '"kept this one because the room went quiet right after. you can hear it decide to."', audioSeed: 17 },
  c2: { line: '"amber light through a window that is not there anymore. the recording kept the warmth."', audioSeed: 29 },
  c3: { line: '"said once, at low volume, to no one. the capsule sealed itself around it."', audioSeed: 41 },
  c4: { line: '"mostly static now. but the static remembers the shape of what it covered."', audioSeed: 53 },
  c5: { line: '"new. unlabeled. it sounds like the minute before something good."', audioSeed: 67 },
  c6: { line: '"recorded, re-recorded, never sent. the pauses are the real message."', audioSeed: 79 },
}

const brokenSeals = new Set<string>()

// small simulated network latency so loading states are exercised
function respond<T>(response: MockResponse<T>, delayMs = 120 + Math.random() * 180): Promise<MockResponse<T>> {
  return new Promise(resolve => {
    setTimeout(() => resolve(response), delayMs)
  })
}

function fail(status: number, error: string): Promise<MockResponse<never>> {
  return respond<never>({ ok: false, status, body: { error } })
}

export function apiGetSignals(): Promise<MockResponse<{ signals: MockSignal[] }>> {
  return respond({ ok: true, status: 200, body: { signals: signalStore.map(s => ({ ...s })) } })
}

export function apiGetRooms(): Promise<MockResponse<{ rooms: MockRoom[] }>> {
  return respond({ ok: true, status: 200, body: { rooms: roomStore.map(r => ({ ...r })) } })
}

export function apiReact(payload: { signalId?: unknown; reactionType?: unknown }): Promise<MockResponse<{ signalId: string; reactionType: ReactionType; count: number }>> {
  const { signalId, reactionType } = payload

  if (typeof signalId !== 'string' || !signalId.trim()) {
    return fail(400, 'signalId is required')
  }
  if (typeof reactionType !== 'string' || !REACTION_TYPES.includes(reactionType as ReactionType)) {
    return fail(400, `reactionType must be one of: ${REACTION_TYPES.join(', ')}`)
  }
  if (!signalStore.some(s => s.id === signalId)) {
    return fail(404, `signal ${signalId} not found`)
  }

  const counts = reactionCounts.get(signalId) ?? { felt: 0, same: 0, here: 0, again: 0, loud: 0 }
  counts[reactionType as ReactionType] += 1
  reactionCounts.set(signalId, counts)

  return respond({
    ok: true,
    status: 200,
    body: { signalId, reactionType: reactionType as ReactionType, count: counts[reactionType as ReactionType] },
  })
}

export function apiBreakCapsule(payload: { capsuleId?: unknown }): Promise<MockResponse<{ capsuleId: string; revealed: { line: string; audioSeed: number }; alreadyBroken: boolean }>> {
  const { capsuleId } = payload

  if (typeof capsuleId !== 'string' || !capsuleId.trim()) {
    return fail(400, 'capsuleId is required')
  }

  const content = capsuleContentStore[capsuleId]
  if (!content) {
    return fail(404, `capsule ${capsuleId} not found`)
  }

  const alreadyBroken = brokenSeals.has(capsuleId)
  brokenSeals.add(capsuleId)

  return respond({
    ok: true,
    status: 200,
    body: { capsuleId, revealed: { ...content }, alreadyBroken },
  })
}
