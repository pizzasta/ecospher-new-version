// Wavelength — how strangers find each other without ever being findable.
//
// Nobody can search for anybody. Instead, while you're on the grid you
// broadcast an anonymous wavelength — the mood you're in, how awake you are,
// your Hz, the hour you're up at, and the kinds of signals you replay — under
// a random key that changes every session. Everyone else who's online does
// the same, and each client scores who's closest. You can tune in to a match
// or send a wave; they find out, and can wave back. No account id, no handle
// lookups, nothing stored server-side: when you close the app, you're gone.

import { getOptionalSupabaseClient } from './supabase'
import { isSupabaseConfigured } from './supabase-env'

export type WaveMeta = {
  /** random per-session key — never an account id */
  key: string
  mood: string
  energy: string
  hz: number
  /** local hour 0–23 the person is up at right now */
  hour: number
  /** feelings they replay most (feed moods), up to 3 */
  replays: string[]
  sigil: string
  color: string
  joinedAt: number
}

export type WaveMatch = {
  peer: WaveMeta
  /** 0–100 */
  score: number
  reasons: string[]
}

// ─── scoring (pure) ──────────────────────────────────────────────────────────

const ADJACENT_MOODS: Record<string, string[]> = {
  tender: ['hopeful', 'heavy'],
  restless: ['numb', 'hopeful'],
  numb: ['heavy', 'restless'],
  hopeful: ['tender', 'restless'],
  heavy: ['numb', 'tender'],
}

function hourGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 24
  return Math.min(d, 24 - d)
}

/** How close two wavelengths are, 0–100, with the reasons in plain words. */
export function wavelengthScore(me: WaveMeta, them: WaveMeta): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let s = 0

  if (me.mood === them.mood) { s += 34; reasons.push(`both ${me.mood} tonight`) }
  else if (ADJACENT_MOODS[me.mood]?.includes(them.mood)) s += 16

  if (me.energy === them.energy) s += 8

  const hzGap = Math.abs(me.hz - them.hz)
  s += Math.max(0, 1 - hzGap / 90) * 22
  if (hzGap <= 6) reasons.push(`${hzGap < 1 ? 'same' : `${hzGap.toFixed(0)} Hz apart on the`} band`)

  const hg = hourGap(me.hour, them.hour)
  s += Math.max(0, 1 - hg / 6) * 16
  if (hg === 0) reasons.push(me.hour >= 0 && me.hour < 5 ? `up at ${me.hour === 0 ? 'midnight' : `${me.hour}am`} too` : 'awake right now too')

  const shared = me.replays.filter(r => them.replays.includes(r))
  const union = new Set([...me.replays, ...them.replays]).size
  if (union > 0) s += (shared.length / union) * 20
  if (shared.length > 0) reasons.push(`you both replay ${shared[0]} signals`)

  return { score: Math.round(Math.min(100, s)), reasons: reasons.slice(0, 2) }
}

/** Best matches first; never yourself, never anyone below the floor. */
export function rankMatches(me: WaveMeta, peers: WaveMeta[], floor = 45, limit = 6): WaveMatch[] {
  return peers
    .filter(p => p.key !== me.key)
    .map(peer => ({ peer, ...wavelengthScore(me, peer) }))
    .filter(m => m.score >= floor)
    .sort((a, b) => b.score - a.score || a.peer.joinedAt - b.peer.joinedAt)
    .slice(0, limit)
}

/** A short anonymous description of a match: "someone tender · 3am". */
export function describePeer(p: WaveMeta): string {
  const h = p.hour
  const when = h === 0 ? 'midnight' : h < 5 ? `${h}am` : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'tonight'
  return `someone ${p.mood} · ${when}`
}

// ─── what you replay (kept on-device) ────────────────────────────────────────

const REPLAY_KEY = 'ecosphere:replayMoods'

export function noteReplayMood(mood: string) {
  try {
    const counts = JSON.parse(window.localStorage.getItem(REPLAY_KEY) ?? '{}') as Record<string, number>
    counts[mood] = (counts[mood] ?? 0) + 1
    window.localStorage.setItem(REPLAY_KEY, JSON.stringify(counts))
  } catch { /* session only */ }
}

export function topReplayMoods(limit = 3): string[] {
  try {
    const counts = JSON.parse(window.localStorage.getItem(REPLAY_KEY) ?? '{}') as Record<string, number>
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([m]) => m)
  } catch { return [] }
}

// ─── on/off (per device) ─────────────────────────────────────────────────────

const OPT_KEY = 'ecosphere:wavelengthOn'

/** On by default; anyone can switch it off and stay unmatched. */
export function wavelengthEnabled(): boolean {
  try { return window.localStorage.getItem(OPT_KEY) !== 'off' } catch { return true }
}

export function setWavelengthEnabled(on: boolean) {
  try { window.localStorage.setItem(OPT_KEY, on ? 'on' : 'off') } catch { /* session only */ }
  try { window.dispatchEvent(new CustomEvent('ecosphere:wavelength-toggle')) } catch { /* non-browser */ }
}

// ─── the band: presence + waves ──────────────────────────────────────────────

export type WaveEvent = { kind: 'wave' | 'tune'; from: WaveMeta }

export interface WaveBus {
  send(event: 'wave' | 'tune', payload: { to: string; from: WaveMeta }): void
  onMessage(cb: (event: 'wave' | 'tune', payload: { to: string; from: WaveMeta }) => void): void
  onPeers(cb: (peers: WaveMeta[]) => void): void
  close(): void
}

function isWaveMeta(v: unknown): v is WaveMeta {
  const m = v as Partial<WaveMeta> | null
  return !!m && typeof m.key === 'string' && typeof m.mood === 'string' && typeof m.hz === 'number'
    && typeof m.hour === 'number' && Array.isArray(m.replays) && typeof m.sigil === 'string' && typeof m.color === 'string'
}

/** Clamp anything a peer sends to sane, displayable values. */
export function sanitizePeer(v: unknown): WaveMeta | null {
  if (!isWaveMeta(v)) return null
  const color = /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : '#8a93ad'
  return {
    key: v.key.slice(0, 40),
    mood: v.mood.slice(0, 16),
    energy: typeof v.energy === 'string' ? v.energy.slice(0, 16) : 'low',
    hz: Math.max(20, Math.min(200, v.hz)),
    hour: Math.max(0, Math.min(23, Math.round(v.hour))),
    replays: v.replays.filter((r): r is string => typeof r === 'string').slice(0, 3).map(r => r.slice(0, 16)),
    sigil: [...v.sigil].slice(0, 2).join(''),
    color,
    joinedAt: typeof v.joinedAt === 'number' ? v.joinedAt : Date.now(),
  }
}

function supabaseWaveBus(me: WaveMeta): WaveBus | null {
  if (!isSupabaseConfigured) return null
  const client = getOptionalSupabaseClient()
  if (!client) return null
  let onMsg: (e: 'wave' | 'tune', p: { to: string; from: WaveMeta }) => void = () => {}
  let onPeersCb: (peers: WaveMeta[]) => void = () => {}
  const channel = client.channel('wavelength', { config: { presence: { key: me.key }, broadcast: { self: false } } })
  for (const event of ['wave', 'tune'] as const) {
    channel.on('broadcast', { event }, ({ payload }) => onMsg(event, payload as { to: string; from: WaveMeta }))
  }
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState() as Record<string, unknown[]>
    // a key claimed twice is somebody spoofing: neither copy is shown
    onPeersCb(Object.entries(state).filter(([, metas]) => metas.length === 1)
      .map(([key, metas]) => sanitizePeer({ ...(metas[0] as object), key }))
      .filter((m): m is WaveMeta => m !== null))
  })
  channel.subscribe(status => {
    if (status === 'SUBSCRIBED') void channel.track({ ...me })
  })
  return {
    send: (event, payload) => { void channel.send({ type: 'broadcast', event, payload }) },
    onMessage: cb => { onMsg = cb },
    onPeers: cb => { onPeersCb = cb },
    close: () => { void client.removeChannel(channel) },
  }
}

/** Same-browser bus so two tabs can find each other without a backend (tests, demos). */
export function localWaveBus(me: WaveMeta): WaveBus {
  const bc = new BroadcastChannel('ecosphere-wavelength')
  const seen = new Map<string, { meta: WaveMeta; at: number }>()
  let onMsg: (e: 'wave' | 'tune', p: { to: string; from: WaveMeta }) => void = () => {}
  let onPeersCb: (peers: WaveMeta[]) => void = () => {}
  const emit = () => onPeersCb([me, ...[...seen.values()].map(v => v.meta)])
  bc.onmessage = (e: MessageEvent<{ event: string; payload: unknown }>) => {
    const { event, payload } = e.data
    if (event === '__hello') {
      const meta = sanitizePeer(payload)
      if (!meta || meta.key === me.key) return
      const isNew = !seen.has(meta.key)
      seen.set(meta.key, { meta, at: Date.now() })
      if (isNew) { emit(); bc.postMessage({ event: '__hello', payload: me }) }
      return
    }
    if (event === '__bye') { if (seen.delete(String((payload as { key?: unknown })?.key))) emit(); return }
    if (event === 'wave' || event === 'tune') onMsg(event, payload as { to: string; from: WaveMeta })
  }
  const beat = window.setInterval(() => {
    bc.postMessage({ event: '__hello', payload: me })
    const cutoff = Date.now() - 6000
    let changed = false
    for (const [k, v] of seen) if (v.at < cutoff) { seen.delete(k); changed = true }
    if (changed) emit()
  }, 2000)
  window.setTimeout(() => { bc.postMessage({ event: '__hello', payload: me }); emit() }, 0)
  return {
    send: (event, payload) => bc.postMessage({ event, payload }),
    onMessage: cb => { onMsg = cb },
    onPeers: cb => { onPeersCb = cb; emit() },
    close: () => { window.clearInterval(beat); bc.postMessage({ event: '__bye', payload: { key: me.key } }); bc.close() },
  }
}

const WAVE_COOLDOWN_MS = 10 * 60 * 1000

export type WavelengthSession = {
  me: WaveMeta
  wave: (to: WaveMeta) => boolean
  tune: (to: WaveMeta) => boolean
  leave: () => void
}

/**
 * Join the band. `onPeers` gets everyone on it (you included); `onEvent`
 * fires when someone waves or tunes in to YOU. Waves and tune-ins to the
 * same person are rate-limited so nobody can be spammed.
 */
export function joinWavelength(
  me: WaveMeta,
  handlers: { onPeers: (peers: WaveMeta[]) => void; onEvent: (e: WaveEvent) => void },
  bus: WaveBus | null = supabaseWaveBus(me),
): WavelengthSession | null {
  if (!bus) return null
  const sentAt = new Map<string, number>()
  const heardAt = new Map<string, number>()
  bus.onPeers(handlers.onPeers)
  bus.onMessage((event, payload) => {
    if (!payload || payload.to !== me.key) return
    const from = sanitizePeer(payload.from)
    if (!from || from.key === me.key) return
    const tag = `${event}:${from.key}`
    const last = heardAt.get(tag) ?? 0
    if (Date.now() - last < WAVE_COOLDOWN_MS) return
    heardAt.set(tag, Date.now())
    handlers.onEvent({ kind: event, from })
  })
  const send = (event: 'wave' | 'tune', to: WaveMeta) => {
    const tag = `${event}:${to.key}`
    if (Date.now() - (sentAt.get(tag) ?? 0) < WAVE_COOLDOWN_MS) return false
    sentAt.set(tag, Date.now())
    bus.send(event, { to: to.key, from: me })
    return true
  }
  return {
    me,
    wave: to => send('wave', to),
    tune: to => send('tune', to),
    leave: () => bus.close(),
  }
}

export function newWaveKey(): string {
  return `w_${crypto.randomUUID?.().slice(0, 12) ?? Math.random().toString(36).slice(2, 14)}`
}
