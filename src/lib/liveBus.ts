// The live bus: one shared Supabase Realtime channel for the whole band.
// Presence says WHO is drifting where (anonymously — page name only, never
// identity); broadcast says WHAT just happened (a replay, a reaction, a
// chain growing, a replay storm). Everything is throttled and ambient by
// design: receivers turn events into soft toasts and pulses, never feeds.

import { getOptionalSupabaseClient } from './supabase'
import { isSupabaseConfigured } from './supabase-env'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type LiveEventType = 'replay' | 'reaction' | 'chain_layer' | 'storm'

export type LiveEvent = {
  type: LiveEventType
  /** page or target id — never a user identity */
  id?: string
  page?: string
}

export type LivePresence = {
  total: number
  perPage: Record<string, number>
}

/** Human line for an incoming event — pure, testable, anti-spam by tone. */
export function liveToastFor(event: LiveEvent): string {
  switch (event.type) {
    case 'replay': return 'someone, somewhere, just replayed a signal'
    case 'reaction': return 'a reaction landed on the band just now'
    case 'chain_layer': return 'a signal chain grew by one voice'
    case 'storm': return 'a replay storm just pulled someone in'
    default: return 'something moved on the band'
  }
}

let channel: RealtimeChannel | null = null
let currentPage = 'home'
let lastSendAt = 0

function dispatchPresence() {
  if (!channel) return
  try {
    const state = channel.presenceState<{ page?: string }>()
    const perPage: Record<string, number> = {}
    let total = 0
    for (const presences of Object.values(state)) {
      for (const p of presences) {
        total += 1
        const page = typeof p.page === 'string' ? p.page : 'somewhere'
        perPage[page] = (perPage[page] ?? 0) + 1
      }
    }
    window.dispatchEvent(new CustomEvent<LivePresence>('ecosphere:presence', { detail: { total, perPage } }))
  } catch { /* presence is decoration */ }
}

/** Join the band's live channel. Idempotent; no-op without a backend. */
export function startLiveBus(page: string): void {
  currentPage = page
  if (channel || !isSupabaseConfigured) return
  const client = getOptionalSupabaseClient()
  if (!client) return
  try {
    channel = client.channel('ecosphere:live', { config: { presence: { key: crypto.randomUUID() } } })
    channel
      .on('broadcast', { event: 'live' }, payload => {
        const event = payload.payload as LiveEvent
        if (!event || typeof event.type !== 'string') return
        window.dispatchEvent(new CustomEvent<LiveEvent>('ecosphere:live', { detail: event }))
      })
      .on('presence', { event: 'sync' }, dispatchPresence)
      .on('presence', { event: 'join' }, dispatchPresence)
      .on('presence', { event: 'leave' }, dispatchPresence)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') void channel?.track({ page: currentPage, at: Date.now() })
      })
  } catch {
    channel = null
  }
}

/** Tell the band which page you drifted to (presence only, throttled by supabase). */
export function setLivePage(page: string): void {
  currentPage = page
  if (!channel) return
  try { void channel.track({ page, at: Date.now() }) } catch { /* decoration */ }
}

/** Announce an event — anonymous, throttled to one per 2s so nothing spams. */
export function sendLive(event: LiveEvent): void {
  if (!channel) return
  const now = Date.now()
  if (now - lastSendAt < 2000) return
  lastSendAt = now
  try {
    void channel.send({ type: 'broadcast', event: 'live', payload: { ...event, page: event.page ?? currentPage } })
  } catch { /* decoration */ }
}

export function stopLiveBus(): void {
  const client = getOptionalSupabaseClient()
  if (channel && client) {
    try { void client.removeChannel(channel) } catch { /* gone */ }
  }
  channel = null
}
