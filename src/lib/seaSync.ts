// Backend fan-out for Cast a Line. A cast is a tiny anonymous row; inserts are
// broadcast over Realtime so a line reaches everyone drifting right now.
// Config-guarded: with no backend, casts stay local (the sea still works).

import { isSupabaseConfigured } from './supabase-env'
import { getOptionalSupabaseClient } from './supabase'
import { ensureBackendSession } from './session'

export const seaSyncEnabled = isSupabaseConfigured

export interface SeaLineRow { id: string; text: string; createdAt: number }

function today(): number { return Math.floor(Date.now() / 86400000) }

// sea_lines isn't in the generated Database types; treat it loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(): any | null {
  const client = getOptionalSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client ? (client as any).from('sea_lines') : null
}

/** Publish a cast line. Fire-and-forget; returns whether it persisted. */
export async function castToSea(text: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const userId = await ensureBackendSession()
  if (!userId) return false
  const t = table()
  if (!t) return false
  const { error } = await t.insert({ text: text.slice(0, 90), day: today() })
  return !error
}

/** The lines others cast into the sea today (newest first). */
export async function fetchSeaLines(limit = 24): Promise<SeaLineRow[]> {
  if (!isSupabaseConfigured) return []
  const t = table()
  if (!t) return []
  const { data, error } = await t
    .select('id, text, created_at')
    .eq('day', today())
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(r => ({ id: r.id as string, text: r.text as string, createdAt: new Date(r.created_at).getTime() }))
}

/** Live: a new line cast by anyone lands here. Returns an unsubscribe fn. */
export function subscribeSeaLines(onLine: (row: SeaLineRow) => void): () => void {
  if (!isSupabaseConfigured) return () => {}
  const client = getOptionalSupabaseClient()
  if (!client) return () => {}
  const channel = client
    .channel('sea_lines_live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sea_lines' }, payload => {
      const r = payload.new as { id: string; text: string; created_at: string }
      onLine({ id: r.id, text: r.text, createdAt: new Date(r.created_at).getTime() })
    })
    .subscribe()
  return () => { void client.removeChannel(channel) }
}
