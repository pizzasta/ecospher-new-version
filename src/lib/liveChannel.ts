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

export interface LivePeerMeta {
  key: string
  sigil: string
  color: string
  joinedAt: number
  /** public signing key (P-256, JWK x/y as JSON); every message must verify against it */
  pub?: string
}

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
  for (const event of ['state', 'action', 'rtc', 'reaction', 'sync']) {
    channel.on('broadcast', { event }, ({ payload }) => onMsg(event, payload as Record<string, unknown>))
  }
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState() as Record<string, Array<Partial<LivePeerMeta>>>
    onPeersCb(Object.entries(state).map(([key, metas]) => ({
      key,
      sigil: metas[0]?.sigil ?? '◌',
      color: metas[0]?.color ?? '#8a93ad',
      joinedAt: typeof metas[0]?.joinedAt === 'number' ? metas[0].joinedAt : Date.now(),
      // a key claimed twice is a spoof attempt: neither copy is trusted
      pub: metas.length === 1 ? metas[0]?.pub : undefined,
    })))
  })
  channel.subscribe(status => {
    if (status === 'SUBSCRIBED') void channel.track({ sigil: me.sigil, color: me.color, joinedAt: me.joinedAt, pub: me.pub })
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

// ─── signed messages ─────────────────────────────────────────────────────────
// Every message is signed with a per-session key whose public half travels in
// presence. Receivers verify against the sender's published key, so nobody can
// speak as the keeper (or anyone else) — forged state, removals, mic handoffs
// and audio offers are dropped.

export interface LiveIdentity { meta: LivePeerMeta; privateKey: CryptoKey }

const SIGN_ALG = { name: 'ECDSA', hash: 'SHA-256' } as const

export async function createLiveIdentity(base: Omit<LivePeerMeta, 'pub'>): Promise<LiveIdentity> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  return { meta: { ...base, pub: JSON.stringify({ x: jwk.x, y: jwk.y }) }, privateKey: pair.privateKey }
}

function canonical(event: string, from: string, body: unknown): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(JSON.stringify([event, from, body])))
}

function toB64(buf: ArrayBuffer): string {
  let s = ''
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function signMessage(key: CryptoKey, event: string, from: string, body: unknown): Promise<string> {
  return toB64(await crypto.subtle.sign(SIGN_ALG, key, canonical(event, from, body)))
}

const importedKeys = new Map<string, Promise<CryptoKey>>()
function importPub(pub: string): Promise<CryptoKey> {
  let k = importedKeys.get(pub)
  if (!k) {
    const { x, y } = JSON.parse(pub) as { x: string; y: string }
    k = crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x, y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    importedKeys.set(pub, k)
  }
  return k
}

export async function verifyMessage(pub: string, event: string, from: string, body: unknown, sig: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify(SIGN_ALG, await importPub(pub), fromB64(sig), canonical(event, from, body))
  } catch {
    return false
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
  /** the session ended on its own (e.g. the channel was full) */
  onEnded?: (reason: 'full') => void
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
  identity: LiveIdentity,
  handlers: LiveHandlers = {},
  getMic: () => Promise<MediaStream> = () => navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  }),
): LiveSession {
  const me = identity.meta
  let peers: LivePeerMeta[] = [me]
  // sign in order, so one sender's messages never overtake each other
  let sendChain: Promise<void> = Promise.resolve()
  const post = (event: string, body: Record<string, unknown>) => {
    sendChain = sendChain
      .then(async () => {
        const sig = await signMessage(identity.privateKey, event, me.key, body)
        if (!closed) bus.send(event, { from: me.key, body, sig })
      })
      .catch(() => { /* a failed send is the same as a dropped packet */ })
  }
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
    if (isKeeper()) post('state', { state })
  }

  const apply = (action: LiveAction) => {
    if (isKeeper()) {
      const next = reduceLive(state, action)
      if (next !== state) { state = next; onStateChanged(); publish() }
    } else {
      post('action', { action })
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
      if (e.candidate) post('rtc', { to: remote, from: me.key, kind: 'ice', candidate: e.candidate.toJSON() } satisfies RtcMsg)
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
    post('rtc', { to: remote, from: me.key, kind: 'offer', sdp: offer.sdp } satisfies RtcMsg)
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
      post('rtc', { to: m.from, from: me.key, kind: 'answer', sdp: answer.sdp } satisfies RtcMsg)
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

  // ── receiving: verify every message against its sender's published key ──
  type Envelope = { event: string; from: string; body: Record<string, unknown>; sig: string; at: number }
  let unverified: Envelope[] = []
  let recvChain: Promise<void> = Promise.resolve()

  const receive = (env: Envelope) => {
    recvChain = recvChain.then(async () => {
      if (closed) return
      const sender = peers.find(p => p.key === env.from)
      if (!sender?.pub) {
        // presence may not have caught up yet; hold briefly, then give up
        if (Date.now() - env.at < 10_000) unverified = [...unverified.slice(-49), env]
        return
      }
      if (!(await verifyMessage(sender.pub, env.event, env.from, env.body, env.sig))) return
      dispatch(env.event, env.from, env.body)
    }).catch(() => { /* one bad message never stalls the queue */ })
  }

  function retryUnverified() {
    const held = unverified
    unverified = []
    for (const env of held) receive(env)
  }

  const dispatch = (event: string, from: string, body: Record<string, unknown>) => {
    if (closed || from === me.key) return
    if (event === 'state') {
      if (isKeeper() || from !== keeperKey) return
      const incoming = body.state as LiveState
      if (incoming.rev < state.rev) return
      state = incoming
      onStateChanged()
      handlers.onState?.(state, keeperKey)
    } else if (event === 'sync') {
      if (isKeeper()) publish()
    } else if (event === 'action') {
      if (!isKeeper()) return
      const action = body.action as LiveAction
      // others may only request, pass or leave — and only for their own key
      const ownKey = action.type === 'request' || action.type === 'yield' || action.type === 'leave'
      if (!ownKey || action.key !== from) return
      apply(action)
    } else if (event === 'rtc') {
      const m = body as unknown as RtcMsg
      if (m.from !== from) return
      void handleRtc(m).catch(() => { /* a failed path just stays silent */ })
    } else if (event === 'reaction') {
      handlers.onReaction?.(String(body.glyph), from)
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
      handlers.onEnded?.('full')
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
      // we may have discarded the keeper's snapshot while we thought we were keeper
      post('sync', {})
    }
    retryUnverified()
    // a carrier sends audio to anyone who just arrived; closes paths to anyone gone
    if (amCarrier()) void startBroadcasting()
    for (const key of [...pcs.keys()]) if (!withMe.some(p => p.key === key)) closePc(key)
  })

  bus.onMessage((event, payload) => {
    if (closed || typeof payload.from !== 'string' || typeof payload.sig !== 'string') return
    receive({ event, from: payload.from, body: (payload.body ?? {}) as Record<string, unknown>, sig: payload.sig, at: Date.now() })
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
    react: (glyph: string) => post('reaction', { glyph }),
    leave,
  }
}

// ─── the channels ────────────────────────────────────────────────────────────

export interface LiveChannelInfo { id: string; name: string; hz: string; topic: string }

/** sessionStorage key: a channel id the channels screen should open on arrival */
export const OPEN_LIVE_KEY = 'ecosphere:openLiveChannel'

export const LIVE_CHANNELS: LiveChannelInfo[] = [
  { id: 'after-hours', name: 'after hours', hz: '101.3', topic: 'whatever is keeping you up' },
  { id: 'open-mic', name: 'open mic', hz: '94.7', topic: 'say one thing to the grid' },
  { id: 'night-shift', name: 'night shift', hz: '88.9', topic: 'for everyone working while the city sleeps' },
]

// ─── feature flag ────────────────────────────────────────────────────────────

const FLAG_KEY = 'ecosphere:liveVoice'

/**
 * Live voice is on for everyone when the backend is configured (still labelled
 * beta). Per-browser overrides: ?livevoice=0 turns it off, ?livevoice=local
 * uses the same-browser test bus, ?livevoice=1 clears any override.
 * Returns 'off', 'on' (Supabase realtime) or 'local' (same-browser test bus).
 */
export function liveVoiceMode(): 'off' | 'on' | 'local' {
  let override: string | null = null
  try {
    const param = new URLSearchParams(window.location.search).get('livevoice')
    if (param === 'local' || param === '0') window.localStorage.setItem(FLAG_KEY, param === 'local' ? 'local' : 'off')
    if (param === '1') window.localStorage.removeItem(FLAG_KEY)
    override = window.localStorage.getItem(FLAG_KEY)
  } catch { /* storage unavailable — fall back to the default */ }
  if (override === 'local') return 'local'
  if (override === 'off') return 'off'
  return isSupabaseConfigured ? 'on' : 'off'
}
