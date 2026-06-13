// Real human group rooms: anonymous strangers dropping short voice clips into a
// topic, heard by anyone in that group. Built on the existing audio pipeline
// (public group-audio bucket + public audio_files rows). Everything here is
// config-guarded — with no backend it returns empty / refuses cleanly, and the
// simulated group conversations carry on untouched.
//
// Screening: every drop REQUIRES a one-line caption that is text-moderated and
// shown to listeners. That's the interim screen; full audio screening is the
// `moderate-audio` Edge Function (speech-to-text → moderation), documented in
// EDGE_FUNCTIONS.md as the next safety layer before audio is featured widely.

import { isSupabaseConfigured } from './supabase-env'
import { getOptionalSupabaseClient } from './supabase'
import { moderatePublicSignalText } from './signalModeration'
import { uploadGroupVoice, listGroupVoices, getGroupVoicePublicUrl, deleteGroupVoice } from './library'

export const groupRoomsEnabled = isSupabaseConfigured

export interface GroupVoice {
  id: string
  line: string
  url: string
  createdAt: number
  bucket: string
  path: string
}

export type DropResult = { ok: true; id: string } | { ok: false; error: string }

function captionWords(line: string): number {
  return line.trim().split(/\s+/).filter(Boolean).length
}

/** The real voices people have dropped into a group (newest first). */
export async function fetchGroupVoices(topicId: string, limit = 12): Promise<GroupVoice[]> {
  if (!isSupabaseConfigured) return []
  const rows = await listGroupVoices(topicId, limit)
  const voices: GroupVoice[] = []
  for (const r of rows) {
    const url = getGroupVoicePublicUrl(r.bucket, r.path)
    if (url) voices.push({ id: r.id, line: r.line, url, createdAt: r.createdAt, bucket: r.bucket, path: r.path })
  }
  return voices
}

/**
 * Drop a voice clip into a group. The caption is moderated up front; the clip
 * itself uploads private and is only made public once the moderate-audio
 * function transcribes and clears it. Fail-closed: if screening isn't
 * available, the clip stays private and never appears for others.
 */
export async function dropGroupVoice(topicId: string, blob: Blob, durationSeconds: number, line: string): Promise<DropResult> {
  if (!isSupabaseConfigured) return { ok: false, error: 'live rooms are off right now' }
  const clean = line.trim().replace(/\s+/g, ' ').slice(0, 90)
  if (captionWords(clean) < 3) return { ok: false, error: 'add a short caption so others know what they’re hearing' }
  if (moderatePublicSignalText(clean).status === 'flagged') return { ok: false, error: 'that caption can’t go into a shared room' }

  const row = await uploadGroupVoice(blob, { topicId, line: clean, durationSeconds })
  if (!row) return { ok: false, error: 'couldn’t drop your voice — try again' }

  const verdict = await screenGroupVoice(row.id, row.bucket, row.path, row.mime_type ?? blob.type)
  if (verdict === 'passed') {
    broadcastGroupVoice(topicId)
    return { ok: true, id: row.id }
  }
  if (verdict === 'flagged') {
    return { ok: false, error: "that didn't pass the room's voice screen" }
  }
  // unscreened — STT not deployed/failed; the clip stays private
  return { ok: false, error: 'voice screening isn’t set up yet — your clip stayed private' }
}

type ScreenVerdict = 'passed' | 'flagged' | 'unscreened'

/** Ask the moderate-audio function to transcribe, screen, and promote the clip. */
async function screenGroupVoice(audioId: string, bucket: string, path: string, mime: string): Promise<ScreenVerdict> {
  const client = getOptionalSupabaseClient()
  if (!client) return 'unscreened'
  try {
    const { data, error } = await client.functions.invoke('moderate-audio', {
      body: { audioId, bucket, path, mime },
    })
    if (error) return 'unscreened'
    const status = (data as { status?: string } | null)?.status
    return status === 'passed' || status === 'flagged' ? status : 'unscreened'
  } catch {
    return 'unscreened'
  }
}

/** Remove a clip you dropped (RLS only ever lets you delete your own). */
export async function removeGroupVoice(v: Pick<GroupVoice, 'id' | 'bucket' | 'path'>): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  return deleteGroupVoice(v)
}

// ─── realtime: a tiny broadcast nudge so open listeners refetch ───────────────

function broadcastGroupVoice(topicId: string): void {
  const client = getOptionalSupabaseClient()
  if (!client) return
  const ch = client.channel(`group_${topicId}`)
  ch.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      void ch.send({ type: 'broadcast', event: 'voice', payload: {} }).finally(() => { void client.removeChannel(ch) })
    }
  })
}

/** Re-run `onNudge` whenever someone drops a new voice into this group. */
export function subscribeGroupVoices(topicId: string, onNudge: () => void): () => void {
  if (!isSupabaseConfigured) return () => {}
  const client = getOptionalSupabaseClient()
  if (!client) return () => {}
  const ch = client
    .channel(`group_${topicId}`)
    .on('broadcast', { event: 'voice' }, () => onNudge())
    .subscribe()
  return () => { void client.removeChannel(ch) }
}
