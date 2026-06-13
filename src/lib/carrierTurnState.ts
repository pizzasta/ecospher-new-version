// The authoritative turn-state for a carrier room, as a pure reducer. In the
// live model the keeper (room creator) is the single authority: it holds this
// state, applies every participant's action, and broadcasts the result — so
// there's no server arbiter and nothing identifying on the wire (keys are random
// presence ids). Pure + deterministic so it can be exhaustively tested before
// any network is involved.

import type { FlowMode } from './carrierRoom'

export interface RoomState {
  mode: FlowMode
  hushed: boolean
  carrier: string | null   // presence key holding the carrier
  second: string | null    // open-drift second carrier
  queue: string[]          // waiting keys, in order
}

export type RoomAction =
  | { type: 'request'; key: string }
  | { type: 'grant'; key: string }     // keeper hands the carrier to a queued key
  | { type: 'yield'; key: string }
  | { type: 'leave'; key: string }
  | { type: 'advance' }                // current turn ended → promote from queue
  | { type: 'clear' }                  // keeper drops the current carrier(s)
  | { type: 'hush'; on: boolean }
  | { type: 'mode'; mode: FlowMode }

export function createRoomState(mode: FlowMode = 'queue'): RoomState {
  return { mode, hushed: false, carrier: null, second: null, queue: [] }
}

function withoutKey(queue: string[], key: string): string[] {
  return queue.filter(k => k !== key)
}

function promote(s: RoomState): RoomState {
  const [next, ...rest] = s.queue
  return { ...s, carrier: next ?? null, queue: rest }
}

export function reduceRoom(s: RoomState, a: RoomAction): RoomState {
  switch (a.type) {
    case 'request': {
      if (s.mode === 'listen-only') return s
      if (a.key === s.carrier || a.key === s.second || s.queue.includes(a.key)) return s
      if (s.mode === 'open-drift') {
        if (s.carrier === null) return { ...s, carrier: a.key }
        if (s.second === null) return { ...s, second: a.key }
        return { ...s, queue: [...s.queue, a.key] }
      }
      // queue: an open carrier is taken immediately; keeper-led always waits
      if (s.mode === 'queue' && s.carrier === null) return { ...s, carrier: a.key }
      return { ...s, queue: [...s.queue, a.key] }
    }
    case 'grant':
      return { ...s, carrier: a.key, queue: withoutKey(s.queue, a.key) }
    case 'yield':
      if (s.second === a.key) return { ...s, second: null }
      if (s.carrier === a.key) return promote(s)
      return { ...s, queue: withoutKey(s.queue, a.key) }
    case 'leave': {
      const queue = withoutKey(s.queue, a.key)
      if (s.second === a.key) return { ...s, second: null, queue }
      if (s.carrier === a.key) return promote({ ...s, queue })
      return { ...s, queue }
    }
    case 'advance':
      return promote({ ...s, second: null })
    case 'clear':
      return promote({ ...s, second: null })
    case 'hush':
      return { ...s, hushed: a.on }
    case 'mode':
      return createRoomState(a.mode)
    default:
      return s
  }
}
