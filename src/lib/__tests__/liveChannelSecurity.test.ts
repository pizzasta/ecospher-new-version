// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createLiveIdentity, joinLiveChannel, signMessage, verifyMessage, LIVE_ROOM_LIMIT } from '../liveChannel'
import type { LiveBus, LiveIdentity, LivePeerMeta, LiveSession, LiveState } from '../liveChannel'

// An in-memory network: every bus sees the same presence list and messages.
class Hub {
  members = new Map<string, { meta: LivePeerMeta; onMsg: (e: string, p: Record<string, unknown>) => void; onPeers: (p: LivePeerMeta[]) => void }>()
  peerDelay = new Map<string, number>()
  list() { return [...this.members.values()].map(m => m.meta) }
  emitPeers() {
    for (const [key, m] of this.members) {
      const delay = this.peerDelay.get(key) ?? 0
      setTimeout(() => m.onPeers(this.list()), delay)
    }
  }
  bus(meta: LivePeerMeta): LiveBus {
    const entry = { meta, onMsg: (_e: string, _p: Record<string, unknown>) => {}, onPeers: (_p: LivePeerMeta[]) => {} }
    this.members.set(meta.key, entry)
    return {
      send: (event, payload) => {
        for (const [key, m] of this.members) if (key !== meta.key) setTimeout(() => m.onMsg(event, payload), 0)
      },
      onMessage: cb => { entry.onMsg = cb },
      onPeers: cb => { entry.onPeers = cb; this.emitPeers() },
      close: () => { this.members.delete(meta.key); this.emitPeers() },
    }
  }
  /** raw injection, as a malicious client would do */
  inject(event: string, payload: Record<string, unknown>) {
    for (const m of this.members.values()) setTimeout(() => m.onMsg(event, payload), 0)
  }
}

const fakeMic = () => Promise.resolve({ getAudioTracks: () => [], getTracks: () => [] } as unknown as MediaStream)
const wait = (ms = 60) => new Promise(r => setTimeout(r, ms))

async function person(key: string, joinedAt: number): Promise<LiveIdentity> {
  return createLiveIdentity({ key, sigil: '◌', color: '#fff', joinedAt })
}

const sessions: LiveSession[] = []
afterEach(() => { while (sessions.length) sessions.pop()!.leave() })

function join(hub: Hub, id: LiveIdentity, seen: { state?: LiveState; removed?: boolean; ended?: boolean }) {
  const s = joinLiveChannel(hub.bus(id.meta), id, {
    onState: st => { seen.state = st },
    onRemoved: () => { seen.removed = true },
    onEnded: () => { seen.ended = true },
  }, fakeMic)
  sessions.push(s)
  return s
}

describe('message signatures', () => {
  it('verify only with the signer’s key and an untouched body', async () => {
    const a = await person('a', 1)
    const b = await person('b', 2)
    const sig = await signMessage(a.privateKey, 'state', 'a', { x: 1 })
    expect(await verifyMessage(a.meta.pub!, 'state', 'a', { x: 1 }, sig)).toBe(true)
    expect(await verifyMessage(b.meta.pub!, 'state', 'a', { x: 1 }, sig)).toBe(false)
    expect(await verifyMessage(a.meta.pub!, 'state', 'a', { x: 2 }, sig)).toBe(false)
    expect(await verifyMessage(a.meta.pub!, 'state', 'b', { x: 1 }, sig)).toBe(false)
  })
})

describe('a live channel resists forged messages', () => {
  it('ignores a removal forged in the keeper’s name, but obeys the real keeper', async () => {
    const hub = new Hub()
    const [keeper, victim, attacker] = await Promise.all([person('k', 1), person('v', 2), person('x', 3)])
    const k = join(hub, keeper, {})
    const victimSeen: { state?: LiveState; removed?: boolean } = {}
    join(hub, victim, victimSeen)
    join(hub, attacker, {})
    await wait()

    const forged: LiveState = { room: { mode: 'queue', hushed: false, carrier: null, second: null, queue: [] }, removed: ['v'], turnStartedAt: null, rev: 999 }
    // signed with the attacker's own key but claiming to be the keeper
    hub.inject('state', { from: 'k', body: { state: forged }, sig: await signMessage(attacker.privateKey, 'state', 'k', { state: forged }) })
    // honestly signed, but the attacker isn't the keeper
    hub.inject('state', { from: 'x', body: { state: forged }, sig: await signMessage(attacker.privateKey, 'state', 'x', { state: forged }) })
    // unsigned
    hub.inject('state', { from: 'k', body: { state: forged } })
    await wait(120)
    expect(victimSeen.removed).toBeUndefined()

    k.remove('v')
    await wait(120)
    expect(victimSeen.removed).toBe(true)
  })

  it('ignores a forged request to pass someone else’s mic', async () => {
    const hub = new Hub()
    const [keeper, speaker, attacker] = await Promise.all([person('k', 1), person('s', 2), person('x', 3)])
    const keeperSeen: { state?: LiveState } = {}
    join(hub, keeper, keeperSeen)
    const s = join(hub, speaker, {})
    join(hub, attacker, {})
    await wait()
    s.requestMic()
    await wait(120)
    expect(keeperSeen.state?.room.carrier).toBe('s')
    const action = { type: 'yield', key: 's' }
    hub.inject('action', { from: 'x', body: { action }, sig: await signMessage(attacker.privateKey, 'action', 'x', { action }) })
    await wait(120)
    expect(keeperSeen.state?.room.carrier).toBe('s')
  })
})

describe('joining mid-conversation', () => {
  it('a late joiner ends up with the room’s real state even if it hears the keeper before presence', async () => {
    const hub = new Hub()
    const [keeper, late] = await Promise.all([person('k', 1), person('z', 5)])
    const k = join(hub, keeper, {})
    await wait()
    k.requestMic()
    await wait(80)
    hub.peerDelay.set('z', 150) // the late joiner learns who's here only after messages start
    const lateSeen: { state?: LiveState } = {}
    join(hub, late, lateSeen)
    await wait(400)
    expect(lateSeen.state?.room.carrier).toBe('k')
  })
})

describe('a bus that reports presence synchronously', () => {
  it('can be joined without a startup crash', async () => {
    const id = await person('solo', 1)
    let peersCb: (p: LivePeerMeta[]) => void = () => {}
    const bus: LiveBus = {
      send: () => {},
      onMessage: () => {},
      // like the same-browser test bus: calls back immediately on registration
      onPeers: cb => { peersCb = cb; cb([id.meta]) },
      close: () => {},
    }
    const seen: { state?: LiveState } = {}
    expect(() => sessions.push(joinLiveChannel(bus, id, { onState: st => { seen.state = st } }, fakeMic))).not.toThrow()
    peersCb([id.meta])
    sessions[sessions.length - 1].requestMic()
    await wait()
    expect(seen.state?.room.carrier).toBe('solo')
  })
})

describe('a full channel', () => {
  it('ends the session for arrivals past the limit', async () => {
    const hub = new Hub()
    const ids = await Promise.all(Array.from({ length: LIVE_ROOM_LIMIT + 1 }, (_, i) => person(`p${i}`, i + 1)))
    const seen: Array<{ ended?: boolean }> = ids.map(() => ({}))
    ids.forEach((id, i) => join(hub, id, seen[i]))
    await wait(150)
    expect(seen[LIVE_ROOM_LIMIT].ended).toBe(true)
    expect(seen.slice(0, LIVE_ROOM_LIMIT).every(s => !s.ended)).toBe(true)
  })
})
