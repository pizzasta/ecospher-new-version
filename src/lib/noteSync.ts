// Backend for public post-it notes: publish a note, fetch the top-reacted few
// for the Relics page, and react to one. Config-guarded — with no backend the
// Relics featuring falls back to your own local public notes.

import { isSupabaseConfigured } from './supabase-env'
import { getOptionalSupabaseClient } from './supabase'
import { ensureBackendSession } from './session'

export const noteSyncEnabled = isSupabaseConfigured

export interface PublicNoteRow { id: string; text: string; color: string; reactions: number }

// public_notes isn't in the generated Database types; treat it loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function table(): any | null {
  const client = getOptionalSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client ? (client as any).from('public_notes') : null
}

/** Release a note into the public pool (it's already screened client-side). */
export async function publishNote(text: string, color: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const userId = await ensureBackendSession()
  if (!userId) return false
  const t = table()
  if (!t) return false
  const { error } = await t.insert({ text: text.slice(0, 120), color, day: Math.floor(Date.now() / 86400000) })
  return !error
}

/** The most-reacted notes (then most recent) — the curated Relics feature pool. */
export async function fetchTopNotes(limit = 3): Promise<PublicNoteRow[]> {
  if (!isSupabaseConfigured) return []
  const t = table()
  if (!t) return []
  const { data, error } = await t
    .select('id, text, color, reactions')
    .order('reactions', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(r => ({ id: r.id as string, text: r.text as string, color: (r.color as string) ?? '#caa57f', reactions: (r.reactions as number) ?? 0 }))
}

/** Resonate with a note — bumps its reaction count via the definer function. */
export async function reactToNote(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const client = getOptionalSupabaseClient()
  if (!client) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).rpc('react_to_note', { p_id: id })
}
