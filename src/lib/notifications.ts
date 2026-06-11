// In-app notifications: backend rows when Supabase is configured, plus a
// local store so the bell works offline (the phantom and system events feed
// it). Both sources merge in the bell, newest first.

import { getOptionalSupabaseClient } from './supabase'
import { isSupabaseConfigured } from './supabase-env'
import { ensureBackendSession } from './session'

export type NotificationType = 'new_reaction' | 'new_listener' | 'new_listener_follow' | 'new_capsule' | 'phantom_interaction'

export type EcoNotification = {
  id: string
  type: NotificationType
  text: string
  read: boolean
  createdAt: number
  remote: boolean
}

export const NOTIFICATION_GLYPHS: Record<NotificationType, string> = {
  new_reaction: '◉',
  new_listener: '◌',
  new_listener_follow: '◈',
  new_capsule: '◬',
  phantom_interaction: '∅',
}

const TYPE_TEXT: Record<NotificationType, string> = {
  new_reaction: 'someone resonated with your signal',
  new_listener: 'someone listened to your signal',
  new_listener_follow: 'a carrier is now tuned to you',
  new_capsule: 'a capsule arrived for you',
  phantom_interaction: 'carrier_null touched your frequency',
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

type LocalNotification = { id: string; type: NotificationType; text?: string; read: boolean; createdAt: number }

function readLocal(): LocalNotification[] {
  try { return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? '[]') } catch { return [] }
}

function writeLocal(items: LocalNotification[]) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(items.slice(0, LOCAL_LIMIT))) } catch { /* session only */ }
}

/** Push a local notification (phantom drift, system events) and announce it. */
export function pushLocalNotification(type: NotificationType, text?: string) {
  const item: LocalNotification = { id: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, text, read: false, createdAt: Date.now() }
  writeLocal([item, ...readLocal()])
  try {
    window.dispatchEvent(new CustomEvent('ecosphere:notification', { detail: { id: item.id, type, text } }))
  } catch { /* non-browser */ }
}

// ─── merged API used by the bell ──────────────────────────────────────────────

export async function listNotifications(limit = 20, unreadOnly = false): Promise<EcoNotification[]> {
  const local: EcoNotification[] = readLocal()
    .filter(n => !unreadOnly || !n.read)
    .map(n => ({ id: n.id, type: n.type, text: n.text ?? TYPE_TEXT[n.type], read: n.read, createdAt: n.createdAt, remote: false }))

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
    const detail = (event as CustomEvent<{ id: string; type: NotificationType; text?: string }>).detail
    if (!detail) return
    onNew({ id: detail.id, type: detail.type, text: detail.text ?? TYPE_TEXT[detail.type], read: false, createdAt: Date.now(), remote: false })
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
