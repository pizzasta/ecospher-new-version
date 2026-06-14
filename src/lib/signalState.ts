// Mute as signal strength. A live voice is a carrier; a muted one has dropped to
// static. Every mute state is one point on that gradient — the same model
// powers live carrier rooms and recovered Dead Zone rooms, so mute behaves
// identically across both.

export type SignalState =
  | 'live'        // on the carrier, transmitting
  | 'held-dark'   // holding the carrier, self-muted
  | 'drifting'    // listener floor — muted by design
  | 'dropped'     // auto-mute: drifted away / lost focus
  | 'cleared'     // keeper dropped this signal to static
  | 'hushed'      // global: keeper silenced the room
  | 'unsettled'   // technical fault — signal won't stabilize

export const SIGNAL_GLYPH: Record<SignalState, string> = {
  live: '∿',
  'held-dark': '◌',
  drifting: '·',
  dropped: '▒',
  cleared: '▒',
  hushed: '◌',
  unsettled: '⚠',
}

export const SIGNAL_LABEL: Record<SignalState, string> = {
  live: 'on the air',
  'held-dark': 'holding · gone quiet',
  drifting: 'just drifting',
  dropped: 'dropped to static',
  cleared: 'the keeper let your signal go quiet',
  hushed: 'the frequency went quiet',
  unsettled: 're-tune the mic',
}

/** True when this state can actually be heard. Only ever 'live'. */
export function isAudible(state: SignalState): boolean {
  return state === 'live'
}

/**
 * Resolve a participant's signal state from their situation. Order matters:
 * faults and room-wide states win, and anything uncertain resolves toward
 * silence (fail-closed).
 */
export function resolveSignalState(ctx: {
  unsettled?: boolean
  hushed?: boolean
  cleared?: boolean
  dropped?: boolean
  isCarrier?: boolean
  muted?: boolean
}): SignalState {
  if (ctx.unsettled) return 'unsettled'
  if (ctx.hushed) return 'hushed'
  if (ctx.cleared) return 'cleared'
  if (ctx.dropped) return 'dropped'
  if (ctx.isCarrier) return ctx.muted ? 'held-dark' : 'live'
  return 'drifting'
}
