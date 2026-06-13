// Real-time transport for carrier rooms over Supabase Realtime — presence +
// broadcast only (no DB rows, nothing identifying on the wire). The keeper is
// the authority: it applies actions through the pure reducer and broadcasts the
// resulting state; everyone else sends actions and renders received state.
// Fully config-guarded: with no backend it returns a null session and the room
// runs on its local/simulated engine, untouched.

import { isSupabaseConfigured } from './supabase-env'
import { getOptionalSupabaseClient } from './supabase'
import { reduceRoom, createRoomState } from './carrierTurnState'
import type { RoomState, RoomAction } from './carrierTurnState'
import type { FlowMode } from './carrierRoom'

export const liveRoomsEnabled = isSupabaseConfigured

export interface LivePeer { key: string; sigil: string; color: string }

export interface CarrierRoomSession {
  /** how many carriers/listeners are really present (anonymous presence) */
  peers: () => LivePeer[]
  /** the random presence key this client speaks as */
  myKey: string
  send: (action: RoomAction) => void
  react: (glyph: string) => void
  leave: () => void
}

export interface CarrierRoomHandlers {
  onPeers?: (peers: LivePeer[]) => void
  onState?: (state: RoomState) => void
  onReaction?: (glyph: string, fromKey: string) => void
}

type PresenceMeta = { sigil: string; color: string }

/**
 * Join a room's live channel. The keeper owns the turn-state; clients send
 * actions. Returns null when there's no backend (the caller keeps its local
 * engine).
 */
export function joinCarrierRoom(
  roomId: string,
  me: { sigil: string; color: string; keeper: boolean; mode: FlowMode },
  handlers: CarrierRoomHandlers = {},
): CarrierRoomSession | null {
  if (!isSupabaseConfigured) return null
  const client = getOptionalSupabaseClient()
  if (!client) return null

  const myKey = `p_${Math.random().toString(36).slice(2, 10)}`
  let peers: LivePeer[] = []
  let keeperState: RoomState = createRoomState(me.mode)

  const channel = client.channel(`carrier_${roomId}`, { config: { presence: { key: myKey } } })

  const broadcastState = () => {
    void channel.send({ type: 'broadcast', event: 'state', payload: keeperState })
  }

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, PresenceMeta[]>
      peers = Object.entries(state).map(([key, metas]) => ({
        key,
        sigil: metas[0]?.sigil ?? '◌',
        color: metas[0]?.color ?? '#8a93ad',
      }))
      handlers.onPeers?.(peers)
      // the keeper re-publishes turn-state when the room changes shape
      if (me.keeper) broadcastState()
    })
    .on('broadcast', { event: 'action' }, ({ payload }) => {
      if (!me.keeper) return
      keeperState = reduceRoom(keeperState, payload as RoomAction)
      handlers.onState?.(keeperState)
      broadcastState()
    })
    .on('broadcast', { event: 'state' }, ({ payload }) => {
      if (me.keeper) return
      handlers.onState?.(payload as RoomState)
    })
    .on('broadcast', { event: 'reaction' }, ({ payload }) => {
      const p = payload as { glyph: string; key: string }
      if (p.key !== myKey) handlers.onReaction?.(p.glyph, p.key)
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') void channel.track({ sigil: me.sigil, color: me.color } satisfies PresenceMeta)
    })

  return {
    peers: () => peers,
    myKey,
    send: (action: RoomAction) => {
      if (me.keeper) {
        keeperState = reduceRoom(keeperState, action)
        handlers.onState?.(keeperState)
        broadcastState()
      } else {
        void channel.send({ type: 'broadcast', event: 'action', payload: action })
      }
    },
    react: (glyph: string) => { void channel.send({ type: 'broadcast', event: 'reaction', payload: { glyph, key: myKey } }) },
    leave: () => { void client.removeChannel(channel) },
  }
}
