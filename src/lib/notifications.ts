// In-app notifications: backend rows when Supabase is configured, plus a
// local store so the bell works offline (the phantom and system events feed
// it). Both sources merge in the bell, newest first.

import { getOptionalSupabaseClient } from './supabase'
import { isSupabaseConfigured } from './supabase-env'
import { ensureBackendSession } from './session'

export type NotificationType = 'new_reaction' | 'new_listener' | 'new_listener_follow' | 'new_capsule' | 'phantom_interaction' | 'return_moment' | 'recap'
  | 'wavelength_match' | 'wave' | 'tuned_in'

/** anonymous peer attached to wavelength notifications, so the inbox can wave back */
export type NotificationPeer = { key: string; mood: string; sigil: string; color: string; hz: number }

export type EcoNotification = {
  id: string
  type: NotificationType
  text: string
  read: boolean
  createdAt: number
  remote: boolean
  peer?: NotificationPeer
}

export const NOTIFICATION_GLYPHS: Record<NotificationType, string> = {
  new_reaction: '◉',
  new_listener: '◌',
  new_listener_follow: '◈',
  new_capsule: '◬',
  phantom_interaction: '∅',
  return_moment: '◔',
  recap: '∿',
  wavelength_match: '≋',
  wave: '◠',
  tuned_in: '⌖',
}

const TYPE_TEXT: Record<NotificationType, string> = {
  new_reaction: 'someone resonated with your signal',
  new_listener: 'someone listened to your signal',
  new_listener_follow: 'a carrier is now tuned to you',
  new_capsule: 'a capsule arrived for you',
  phantom_interaction: 'carrier_null touched your frequency',
  return_moment: 'something happened while you were gone',
  recap: 'your nightly recap is ready',
  wavelength_match: 'someone on your wavelength just came on the grid',
  wave: 'someone on your wavelength waved at you',
  tuned_in: 'someone on your wavelength tuned in to you',
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

export function formatBadge(count: number): string {
  return count > 99 ? '99+' : String(count)
}

// ─── local store ──────────────────────────────────────────────────────────────

const LOCAL_KEY = 'ecosphere:localNotifications'
const LOCAL_LIMIT = 50

type LocalNotification = { id: string; type: NotificationType; text?: string; read: boolean; createdAt: number; peer?: NotificationPeer }

function readLocal(): LocalNotification[] {
  try { return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? '[]') } catch { return [] }
}

function writeLocal(items: LocalNotification[]) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(items.slice(0, LOCAL_LIMIT))) } catch { /* session only */ }
}

/** Push a local notification (phantom drift, system events) and announce it. */
export function pushLocalNotification(type: NotificationType, text?: string, peer?: NotificationPeer) {
  const item: LocalNotification = { id: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, text, read: false, createdAt: Date.now(), peer }
  writeLocal([item, ...readLocal()])
  try {
    window.dispatchEvent(new CustomEvent('ecosphere:notification', { detail: { id: item.id, type, text, peer } }))
  } catch { /* non-browser */ }
}

// ─── merged API used by the bell ──────────────────────────────────────────────

export async function listNotifications(limit = 20, unreadOnly = false): Promise<EcoNotification[]> {
  const local: EcoNotification[] = readLocal()
    .filter(n => !unreadOnly || !n.read)
    .map(n => ({ id: n.id, type: n.type, text: n.text ?? TYPE_TEXT[n.type], read: n.read, createdAt: n.createdAt, remote: false, peer: n.peer }))

  let remote: EcoNotification[] = []
  if (isSupabaseConfigured) {
    const client = getOptionalSupabaseClient()
    const userId = await ensureBackendSession()
    if (client && userId) {
      try {
        let query = client
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (unreadOnly) query = query.eq('read', false)
        const { data } = await query
        remote = (data ?? []).map(row => ({
          id: row.id,
          type: row.type,
          text: typeof (row.metadata as { label?: unknown } | null)?.label === 'string'
            ? String((row.metadata as { label?: unknown }).label)
            : TYPE_TEXT[row.type],
          read: row.read,
          createdAt: new Date(row.created_at).getTime(),
          remote: true,
        }))
      } catch { /* offline — local only */ }
    }
  }

  return [...remote, ...local].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
}

export async function markNotificationRead(notification: Pick<EcoNotification, 'id' | 'remote'>) {
  if (!notification.remote) {
    writeLocal(readLocal().map(n => (n.id === notification.id ? { ...n, read: true } : n)))
    return
  }
  const client = getOptionalSupabaseClient()
  if (!client) return
  try {
    await client.from('notifications').update({ read: true }).eq('id', notification.id)
  } catch { /* retried on next open */ }
}

export async function markAllNotificationsRead() {
  writeLocal(readLocal().map(n => ({ ...n, read: true })))
  if (!isSupabaseConfigured) return
  const client = getOptionalSupabaseClient()
  const userId = await ensureBackendSession()
  if (!client || !userId) return
  try {
    await client.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  } catch { /* retried on next open */ }
}

/**
 * Live updates: backend realtime inserts (when configured) plus the local
 * 'ecosphere:notification' event. Returns an unsubscribe function.
 */
export function subscribeToNotifications(onNew: (notification: EcoNotification) => void): () => void {
  const onLocal = (event: Event) => {
    const detail = (event as CustomEvent<{ id: string; type: NotificationType; text?: string; peer?: NotificationPeer }>).detail
    if (!detail) return
    onNew({ id: detail.id, type: detail.type, text: detail.text ?? TYPE_TEXT[detail.type], read: false, createdAt: Date.now(), remote: false, peer: detail.peer })
  }
  window.addEventListener('ecosphere:notification', onLocal)

  let teardownRemote = () => {}
  if (isSupabaseConfigured) {
    const client = getOptionalSupabaseClient()
    if (client) {
      void ensureBackendSession().then(userId => {
        if (!userId) return
        const channel = client
          .channel('ecosphere-notifications')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => {
            const row = payload.new as { id: string; type: NotificationType; metadata?: { label?: unknown } | null; created_at?: string }
            const label = typeof row.metadata?.label === 'string' ? row.metadata.label : TYPE_TEXT[row.type]
            onNew({ id: row.id, type: row.type, text: label, read: false, createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(), remote: true })
            // let other surfaces (the presence room) react without opening a second channel
            window.dispatchEvent(new CustomEvent('ecosphere:remote-notification', { detail: { id: row.id, type: row.type } }))
          })
          .subscribe()
        teardownRemote = () => { void client.removeChannel(channel) }
      })
    }
  }

  return () => {
    window.removeEventListener('ecosphere:notification', onLocal)
    teardownRemote()
  }
}

// ─── inbox helpers (pure) ─────────────────────────────────────────────────────

export type InboxFilter = 'all' | 'you' | 'wavelength'

const WAVELENGTH_TYPES: NotificationType[] = ['wavelength_match', 'wave', 'tuned_in']

export function matchesFilter(n: EcoNotification, filter: InboxFilter): boolean {
  if (filter === 'all') return true
  const wl = WAVELENGTH_TYPES.includes(n.type)
  return filter === 'wavelength' ? wl : !wl
}

export type InboxGroup = { key: string; type: NotificationType; items: EcoNotification[]; latest: EcoNotification; unread: number }

const GROUPABLE: NotificationType[] = ['new_reaction', 'new_listener', 'new_listener_follow']
const GROUP_WINDOW_MS = 60 * 60 * 1000

/**
 * Collapse runs of the same kind of event that land close together
 * ("4 people resonated with your signal") so a busy night reads as one line.
 * Wavelength events stay individual — each one is a person you can answer.
 */
export function groupNotifications(items: EcoNotification[]): InboxGroup[] {
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt)
  const groups: InboxGroup[] = []
  for (const n of sorted) {
    const last = groups[groups.length - 1]
    if (last && GROUPABLE.includes(n.type) && last.type === n.type && last.items[last.items.length - 1].createdAt - n.createdAt <= GROUP_WINDOW_MS) {
      last.items.push(n)
      if (!n.read) last.unread += 1
      continue
    }
    groups.push({ key: n.id, type: n.type, items: [n], latest: n, unread: n.read ? 0 : 1 })
  }
  return groups
}

const GROUP_TEXT: Partial<Record<NotificationType, (n: number) => string>> = {
  new_reaction: n => `${n} people resonated with your signal`,
  new_listener: n => `${n} people listened to your signal`,
  new_listener_follow: n => `${n} carriers tuned to you`,
}

export function groupText(g: InboxGroup): string {
  if (g.items.length > 1) return GROUP_TEXT[g.type]?.(g.items.length) ?? g.latest.text
  return g.latest.text
}

/** Where tapping a notification takes you. */
export function notificationTarget(type: NotificationType): string | null {
  switch (type) {
    case 'new_reaction': case 'new_listener': return 'signals'
    case 'new_listener_follow': case 'return_moment': return 'pod'
    case 'new_capsule': return 'capsules'
    case 'recap': return 'dashboard'
    case 'phantom_interaction': return 'anomalies'
    default: return null
  }
}

// ─── quiet hours ──────────────────────────────────────────────────────────────

const QUIET_KEY = 'ecosphere:quietHours'
export type QuietHours = { on: boolean; from: number; to: number }
export const DEFAULT_QUIET: QuietHours = { on: false, from: 1, to: 8 }

export function readQuietHours(): QuietHours {
  try {
    const v = JSON.parse(window.localStorage.getItem(QUIET_KEY) ?? 'null') as Partial<QuietHours> | null
    if (!v) return { ...DEFAULT_QUIET }
    const hour = (h: unknown, d: number) => (typeof h === 'number' && h >= 0 && h <= 23 ? Math.round(h) : d)
    return { on: v.on === true, from: hour(v.from, DEFAULT_QUIET.from), to: hour(v.to, DEFAULT_QUIET.to) }
  } catch { return { ...DEFAULT_QUIET } }
}

export function saveQuietHours(q: QuietHours) {
  try { window.localStorage.setItem(QUIET_KEY, JSON.stringify(q)) } catch { /* session only */ }
}

/** True when alerts should stay silent (badge still counts). Handles windows that wrap midnight. */
export function inQuietHours(q: QuietHours, hour: number = new Date().getHours()): boolean {
  if (!q.on || q.from === q.to) return false
  return q.from < q.to ? hour >= q.from && hour < q.to : hour >= q.from || hour < q.to
}
