// Live voice channels — real people talking in real time, one carrier at a time.
//
// Model: whoever holds the carrier streams their mic (WebRTC) to everyone else
// in the channel; everyone else listens. Turn-taking reuses the carrier-room
// reducer, so "one voice holds the frequency" is enforced by state, not
// etiquette. The keeper (whoever has been in the channel longest) is the single
// authority: it applies requests, enforces the turn cap, can cut the carrier
// and can remove someone. Nothing is recorded or stored anywhere — audio flows
// peer-to-peer, and the signaling bus only carries random session keys.
//
// The bus is pluggable: Supabase Realtime in production, and a same-origin
// BroadcastChannel bus for local testing across browser tabs.

import { reduceRoom, createRoomState } from './carrierTurnState'
import type { RoomState, RoomAction } from './carrierTurnState'
import { isSupabaseConfigured } from './supabase-env'
import { getOptionalSupabaseClient } from './supabase'

/** A speaker's turn is cut after this long, so nobody can hold the mic forever. */
export const LIVE_TURN_CAP_MS = 45_000
/** Small rooms keep peer-to-peer audio reliable and moderation human-scale. */
export const LIVE_ROOM_LIMIT = 8

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]

export interface LivePeerMeta { key: string; sigil: string; color: string; joinedAt: number }

export interface LiveState {
  room: RoomState
  /** keys removed by the keeper; they are dropped and cannot rejoin this session */
  removed: string[]
  /** when the current carrier took the mic (for the turn cap) */
  turnStartedAt: number | null
  /** bumps on every change so stale broadcasts can be ignored */
  rev: number
}

export function createLiveState(): LiveState {
  return { room: createRoomState('queue'), removed: [], turnStartedAt: null, rev: 0 }
}

export type LiveAction =
  | RoomAction
  | { type: 'remove'; key: string }

/** Pure: apply one action to the live state. */
export function reduceLive(s: LiveState, a: LiveAction, now: number = Date.now()): LiveState {
  if (a.type === 'remove') {
    if (s.removed.includes(a.key)) return s
    const room = reduceRoom(s.room, { type: 'leave', key: a.key })
    return finish(s, room, [...s.removed, a.key], now)
  }
  if (a.type === 'request' && s.removed.includes(a.key)) return s
  return finish(s, reduceRoom(s.room, a), s.removed, now)
}

function finish(s: LiveState, room: RoomState, removed: string[], now: number): LiveState {
  const carrierChanged = room.carrier !== s.room.carrier
  const turnStartedAt = room.carrier ? (carrierChanged ? now : s.turnStartedAt) : null
  if (!carrierChanged && room === s.room && removed === s.removed) return s
  return { room, removed, turnStartedAt, rev: s.rev + 1 }
}

/** Pure: the keeper is whoever joined first (ties broken by key). */
export function electKeeper(peers: LivePeerMeta[]): string | null {
  if (peers.length === 0) return null
  return [...peers].sort((a, b) => a.joinedAt - b.joinedAt || (a.key < b.key ? -1 : 1))[0].key
}

/** Pure: has the current turn run past the cap? */
export function turnExpired(s: LiveState, now: number = Date.now()): boolean {
  return Boolean(s.room.carrier && s.turnStartedAt !== null && now - s.turnStartedAt >= LIVE_TURN_CAP_MS)
}

// ─── signaling bus ───────────────────────────────────────────────────────────

export interface LiveBus {
  send(event: string, payload: Record<string, unknown>): void
  onMessage(cb: (event: string, payload: Record<string, unknown>) => void): void
  onPeers(cb: (peers: LivePeerMeta[]) => void): void
  close(): void
}

/** Supabase Realtime: presence for who's here, broadcast for everything else. */
export function supabaseBus(channelId: string, me: LivePeerMeta): LiveBus | null {
  if (!isSupabaseConfigured) return null
  const client = getOptionalSupabaseClient()
  if (!client) return null
  let onMsg: (event: string, payload: Record<string, unknown>) => void = () => {}
  let onPeersCb: (peers: LivePeerMeta[]) => void = () => {}
  const channel = client.channel(`live_${channelId}`, { config: { presence: { key: me.key }, broadcast: { self: false } } })
  for (const event of ['state', 'action', 'rtc', 'reaction']) {
    channel.on('broadcast', { event }, ({ payload }) => onMsg(event, payload as Record<string, unknown>))
  }
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState() as Record<string, Array<Partial<LivePeerMeta>>>
    onPeersCb(Object.entries(state).map(([key, metas]) => ({
      key,
      sigil: metas[0]?.sigil ?? '◌',
      color: metas[0]?.color ?? '#8a93ad',
      joinedAt: typeof metas[0]?.joinedAt === 'number' ? metas[0].joinedAt : Date.now(),
    })))
  })
  channel.subscribe(status => {
    if (status === 'SUBSCRIBED') void channel.track({ sigil: me.sigil, color: me.color, joinedAt: me.joinedAt })
  })
  return {
    send: (event, payload) => { void channel.send({ type: 'broadcast', event, payload }) },
    onMessage: cb => { onMsg = cb },
    onPeers: cb => { onPeersCb = cb },
    close: () => { void client.removeChannel(channel) },
  }
}

/** Same-origin test bus: tabs of one browser find each other via BroadcastChannel. */
export function localBus(channelId: string, me: LivePeerMeta): LiveBus {
  const bc = new BroadcastChannel(`ecosphere-live-${channelId}`)
  const seen = new Map<string, { meta: LivePeerMeta; at: number }>()
  let onMsg: (event: string, payload: Record<string, unknown>) => void = () => {}
  let onPeersCb: (peers: LivePeerMeta[]) => void = () => {}
  const emitPeers = () => onPeersCb([me, ...[...seen.values()].map(v => v.meta)])
  bc.onmessage = (e: MessageEvent<{ event: string; payload: Record<string, unknown> }>) => {
    const { event, payload } = e.data
    if (event === '__hello') {
      const meta = payload as unknown as LivePeerMeta
      if (meta.key === me.key) return
      const isNew = !seen.has(meta.key)
      seen.set(meta.key, { meta, at: Date.now() })
      if (isNew) { emitPeers(); bc.postMessage({ event: '__hello', payload: me }) }
      return
    }
    if (event === '__bye') {
      if (seen.delete(String(payload.key))) emitPeers()
      return
    }
    onMsg(event, payload)
  }
  const beat = window.setInterval(() => {
    bc.postMessage({ event: '__hello', payload: me })
    const cutoff = Date.now() - 6000
    let changed = false
    for (const [k, v] of seen) if (v.at < cutoff) { seen.delete(k); changed = true }
    if (changed) emitPeers()
  }, 2000)
  window.setTimeout(() => { bc.postMessage({ event: '__hello', payload: me }); emitPeers() }, 0)
  return {
    send: (event, payload) => bc.postMessage({ event, payload }),
    onMessage: cb => { onMsg = cb },
    onPeers: cb => { onPeersCb = cb; emitPeers() },
    close: () => {
      window.clearInterval(beat)
      bc.postMessage({ event: '__bye', payload: { key: me.key } })
      bc.close()
    },
  }
}

// ─── the live channel session ────────────────────────────────────────────────

export interface LiveHandlers {
  onState?: (state: LiveState, keeperKey: string | null) => void
  onPeers?: (peers: LivePeerMeta[]) => void
  /** a remote voice started (stream) or stopped (null) */
  onAudio?: (fromKey: string, stream: MediaStream | null) => void
  onReaction?: (glyph: string, fromKey: string) => void
  /** you were removed by the keeper */
  onRemoved?: () => void
  /** the room is full, or the mic was refused, etc. */
  onNotice?: (text: string) => void
}

export interface LiveSession {
  myKey: string
  requestMic: () => void
  passMic: () => void
  /** push-to-talk: only true while the button is held */
  setTalking: (on: boolean) => void
  /** keeper only */
  cut: () => void
  /** keeper only */
  remove: (key: string) => void
  react: (glyph: string) => void
  leave: () => void
}

type RtcMsg = { to: string; from: string; kind: 'offer' | 'answer' | 'ice'; sdp?: string; candidate?: RTCIceCandidateInit }

export function joinLiveChannel(
  bus: LiveBus,
  me: LivePeerMeta,
  handlers: LiveHandlers = {},
  getMic: () => Promise<MediaStream> = () => navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  }),
): LiveSession {
  let peers: LivePeerMeta[] = [me]
  let keeperKey: string | null = me.key
  let state = createLiveState()
  let mic: MediaStream | null = null
  let talking = false
  let closed = false
  const pcs = new Map<string, RTCPeerConnection>()
  const pendingIce = new Map<string, RTCIceCandidateInit[]>()
  // an offer can arrive a beat before the state that made its sender the carrier
  const pendingOffers = new Map<string, RtcMsg>()

  const isKeeper = () => keeperKey === me.key
  const amCarrier = () => state.room.carrier === me.key

  const publish = () => {
    handlers.onState?.(state, keeperKey)
    if (isKeeper()) bus.send('state', { state, keeper: me.key })
  }

  const apply = (action: LiveAction) => {
    if (isKeeper()) {
      const next = reduceLive(state, action)
      if (next !== state) { state = next; onStateChanged(); publish() }
    } else {
      bus.send('action', { action, from: me.key })
    }
  }

  // ── audio plumbing ──
  const closePc = (key: string) => {
    const pc = pcs.get(key)
    if (pc) { pc.close(); pcs.delete(key) }
    pendingIce.delete(key)
  }
  const closeAll = () => { for (const key of [...pcs.keys()]) closePc(key) }

  const stopMic = () => {
    mic?.getTracks().forEach(t => t.stop())
    mic = null
  }

  const newPc = (remote: string) => {
    closePc(remote)
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pc.onicecandidate = e => {
      if (e.candidate) bus.send('rtc', { to: remote, from: me.key, kind: 'ice', candidate: e.candidate.toJSON() } satisfies RtcMsg)
    }
    pcs.set(remote, pc)
    return pc
  }

  const listeners = () => peers.filter(p => p.key !== me.key && !state.removed.includes(p.key))

  const offerTo = async (remote: string) => {
    if (!mic) return
    const pc = newPc(remote)
    for (const track of mic.getAudioTracks()) pc.addTrack(track, mic)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    bus.send('rtc', { to: remote, from: me.key, kind: 'offer', sdp: offer.sdp } satisfies RtcMsg)
  }

  const startBroadcasting = async () => {
    if (!mic) {
      try {
        mic = await getMic()
      } catch {
        handlers.onNotice?.('mic blocked — allow microphone access to talk')
        apply({ type: 'yield', key: me.key })
        return
      }
      if (closed || !amCarrier()) { stopMic(); return }
    }
    for (const t of mic.getAudioTracks()) t.enabled = talking
    for (const p of listeners()) if (!pcs.has(p.key)) void offerTo(p.key).catch(() => closePc(p.key))
  }

  let lastCarrier: string | null = null
  const onStateChanged = () => {
    if (state.removed.includes(me.key)) {
      handlers.onRemoved?.()
      leave()
      return
    }
    if (state.room.carrier !== lastCarrier) {
      // a new voice holds the frequency: tear down the old paths
      if (lastCarrier && lastCarrier !== me.key) handlers.onAudio?.(lastCarrier, null)
      closeAll()
      if (lastCarrier === me.key) { stopMic(); talking = false }
      lastCarrier = state.room.carrier
    }
    if (amCarrier()) void startBroadcasting()
    const early = state.room.carrier ? pendingOffers.get(state.room.carrier) : undefined
    pendingOffers.clear()
    if (early) void handleRtc(early).catch(() => { /* stays silent */ })
  }

  const handleRtc = async (m: RtcMsg) => {
    if (m.to !== me.key) return
    if (m.kind === 'offer') {
      // only the current carrier may send us audio
      if (state.removed.includes(m.from)) return
      if (m.from !== state.room.carrier) { pendingOffers.set(m.from, m); return }
      const pc = newPc(m.from)
      pc.ontrack = e => handlers.onAudio?.(m.from, e.streams[0] ?? new MediaStream([e.track]))
      await pc.setRemoteDescription({ type: 'offer', sdp: m.sdp })
      for (const c of pendingIce.get(m.from) ?? []) await pc.addIceCandidate(c)
      pendingIce.delete(m.from)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      bus.send('rtc', { to: m.from, from: me.key, kind: 'answer', sdp: answer.sdp } satisfies RtcMsg)
    } else if (m.kind === 'answer') {
      const pc = pcs.get(m.from)
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: m.sdp })
        for (const c of pendingIce.get(m.from) ?? []) await pc.addIceCandidate(c)
        pendingIce.delete(m.from)
      }
    } else if (m.kind === 'ice' && m.candidate) {
      const pc = pcs.get(m.from)
      if (pc?.remoteDescription) await pc.addIceCandidate(m.candidate)
      else pendingIce.set(m.from, [...(pendingIce.get(m.from) ?? []), m.candidate])
    }
  }

  // ── bus wiring ──
  bus.onPeers(list => {
    const withMe = list.some(p => p.key === me.key) ? list : [me, ...list]
    const prevKeeper = keeperKey
    peers = withMe
    keeperKey = electKeeper(withMe)
    handlers.onPeers?.(withMe)
    // room full: the latest arrivals step back out
    const ordered = [...withMe].sort((a, b) => a.joinedAt - b.joinedAt || (a.key < b.key ? -1 : 1))
    if (ordered.findIndex(p => p.key === me.key) >= LIVE_ROOM_LIMIT) {
      handlers.onNotice?.('this channel is full — try another frequency')
      leave()
      return
    }
    if (isKeeper()) {
      // drop anyone who left from the turn-state
      const present = new Set(withMe.map(p => p.key))
      let next = state
      for (const key of [next.room.carrier, next.room.second, ...next.room.queue]) {
        if (key && !present.has(key)) next = reduceLive(next, { type: 'leave', key })
      }
      if (next !== state) { state = next; onStateChanged() }
      publish()
    } else if (prevKeeper !== keeperKey) {
      handlers.onState?.(state, keeperKey)
    }
    // a carrier sends audio to anyone who just arrived; closes paths to anyone gone
    if (amCarrier()) void startBroadcasting()
    for (const key of [...pcs.keys()]) if (!withMe.some(p => p.key === key)) closePc(key)
  })

  bus.onMessage((event, payload) => {
    if (closed) return
    if (event === 'state') {
      if (isKeeper() || payload.keeper !== keeperKey) return
      const incoming = payload.state as LiveState
      if (incoming.rev < state.rev) return
      state = incoming
      onStateChanged()
      handlers.onState?.(state, keeperKey)
    } else if (event === 'action') {
      if (!isKeeper()) return
      const action = payload.action as LiveAction
      // others may only request, pass or leave — and only for their own key
      const ownKey = action.type === 'request' || action.type === 'yield' || action.type === 'leave'
      if (!ownKey || action.key !== payload.from) return
      apply(action)
    } else if (event === 'rtc') {
      void handleRtc(payload as unknown as RtcMsg).catch(() => { /* a failed path just stays silent */ })
    } else if (event === 'reaction') {
      handlers.onReaction?.(String(payload.glyph), String(payload.key))
    }
  })

  // the keeper enforces the turn cap
  const capTimer = window.setInterval(() => {
    if (closed || !isKeeper() || !turnExpired(state)) return
    apply({ type: 'advance' })
  }, 1000)

  function leave() {
    if (closed) return
    if (state.room.carrier === me.key || state.room.queue.includes(me.key)) apply({ type: 'leave', key: me.key })
    closed = true
    window.clearInterval(capTimer)
    closeAll()
    stopMic()
    bus.close()
  }

  return {
    myKey: me.key,
    requestMic: () => apply({ type: 'request', key: me.key }),
    passMic: () => apply({ type: 'yield', key: me.key }),
    setTalking: (on: boolean) => {
      talking = on && amCarrier()
      mic?.getAudioTracks().forEach(t => { t.enabled = talking })
    },
    cut: () => { if (isKeeper()) apply({ type: 'clear' }) },
    remove: (key: string) => { if (isKeeper() && key !== me.key) apply({ type: 'remove', key }) },
    react: (glyph: string) => bus.send('reaction', { glyph, key: me.key }),
    leave,
  }
}

// ─── the channels ────────────────────────────────────────────────────────────

export interface LiveChannelInfo { id: string; name: string; hz: string; topic: string }

export const LIVE_CHANNELS: LiveChannelInfo[] = [
  { id: 'after-hours', name: 'after hours', hz: '101.3', topic: 'whatever is keeping you up' },
  { id: 'open-mic', name: 'open mic', hz: '94.7', topic: 'say one thing to the grid' },
  { id: 'night-shift', name: 'night shift', hz: '88.9', topic: 'for everyone working while the city sleeps' },
]

// ─── feature flag ────────────────────────────────────────────────────────────

const FLAG_KEY = 'ecosphere:liveVoice'

/**
 * Live voice is opt-in while it's being tested: visit any page with
 * ?livevoice=1 to turn it on for this browser (?livevoice=0 turns it off).
 * Returns 'off', 'on' (Supabase realtime) or 'local' (same-browser test bus).
 */
export function liveVoiceMode(): 'off' | 'on' | 'local' {
  try {
    const param = new URLSearchParams(window.location.search).get('livevoice')
    if (param === '1' || param === 'local') window.localStorage.setItem(FLAG_KEY, param === 'local' ? 'local' : 'on')
    if (param === '0') window.localStorage.removeItem(FLAG_KEY)
    const v = window.localStorage.getItem(FLAG_KEY)
    if (v === 'local') return 'local'
    if (v === 'on') return isSupabaseConfigured ? 'on' : 'local'
  } catch { /* storage unavailable */ }
  return 'off'
}
