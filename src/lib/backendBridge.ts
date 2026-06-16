// Bridge between the local-first ecosystem store and the Supabase backend.
// Everything here is fire-and-forget and configured-guarded: when env vars
// are missing or the network fails, the app keeps running on localStorage /
// IndexedDB exactly as before. The mock feed content has no relational rows
// yet, so cross-page actions mirror into activity_events (free-form type +
// metadata); real audio recordings mirror into storage + audio_files.

import { isSupabaseConfigured } from './supabase-env'
import { deleteAudio, getAudioPlaybackUrl, listAudioLibrary, logActivity, publishSignal, uploadAudio } from './library'
import { getOptionalSupabaseClient } from './supabase'
import type { ActivityEventType, AudioFileRow } from './library'

export function mirrorActivity(type: ActivityEventType, label: string, metadata: Record<string, unknown> = {}) {
  if (!isSupabaseConfigured) return
  void logActivity(type, {}, { label, ...metadata }).catch(() => { /* offline — local state is the source of truth */ })
}

export type RemoteRecording = {
  audioId: string
  title: string
  durationMs: number
  createdAt: number
  bucket: string
  path: string
}

/** Upload a finished recording to the user's backend audio library. */
export function mirrorRecordingUpload(blob: Blob, title: string, durationMs: number) {
  if (!isSupabaseConfigured) return
  void uploadAudio(blob, { title, durationSeconds: Math.round(durationMs / 1000) })
    .then((row) => {
      if (row) mirrorActivity('audio_uploaded', title, { durationMs })
    })
    .catch(() => { /* upload failed — recording is still in IndexedDB */ })
}

/** Recordings stored in the backend audio library (empty when offline). */
export async function fetchRemoteRecordings(): Promise<RemoteRecording[]> {
  if (!isSupabaseConfigured) return []
  try {
    const rows = await listAudioLibrary(false)
    return rows.map((row) => ({
      audioId: row.id,
      title: row.title ?? 'unsent signal',
      durationMs: (row.duration_seconds ?? 3) * 1000,
      createdAt: new Date(row.created_at).getTime(),
      bucket: row.bucket,
      path: row.path,
    }))
  } catch {
    return []
  }
}

export async function remotePlaybackUrl(recording: Pick<RemoteRecording, 'bucket' | 'path'>): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  try {
    return await getAudioPlaybackUrl(recording)
  } catch {
    return null
  }
}

export function mirrorRecordingDelete(recording: Pick<AudioFileRow, 'id' | 'bucket' | 'path'>) {
  if (!isSupabaseConfigured) return
  void deleteAudio(recording).catch(() => { /* row stays; harmless */ })
}


export type RemoteSignal = {
  id: string
  title: string
  caption: string
  mood: string
  createdAt: number
  audioUrl?: string
}

/**
 * Publish a feed post to the backend so other users see it. Returns the real
 * signal id (use it as the card id so reactions reference the right row), or
 * null when offline/unconfigured/screened-out.
 */
export async function publishSignalToFeed(content: string, mood: string, anonymous: boolean): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  try { return await publishSignal(content, mood, anonymous) } catch { return null }
}

/**
 * Record a reaction to a public signal. Inserts a voice_reaction activity for
 * the signal, which the DB trigger turns into a 'new_reaction' notification for
 * that signal's author. No-op offline; only call for real backend signals.
 */
export function mirrorReaction(signalId: string, label: string) {
  if (!isSupabaseConfigured) return
  void logActivity('voice_reaction', { signal_id: signalId }, { label }).catch(() => { /* offline — local trace already recorded */ })
}

/** Ask moderate-audio to transcribe + screen a clip and promote it to public.
 *  Fail-closed: anything but a clean 'passed' leaves the clip private. */
async function screenAudio(audioId: string, bucket: string, path: string, mime: string): Promise<boolean> {
  const client = getOptionalSupabaseClient()
  if (!client) return false
  try {
    const { data, error } = await client.functions.invoke('moderate-audio', { body: { audioId, bucket, path, mime } })
    if (error) return false
    return (data as { status?: string } | null)?.status === 'passed'
  } catch {
    return false
  }
}

/**
 * Publish a VOICE feed post: upload the clip (private), publish the signal
 * linked to it, then run the clip through moderate-audio — only a clean pass
 * promotes the audio to public so others can hear it. The post card + caption
 * fan out regardless (screened by the signals guardian). Returns the signal id.
 */
export async function publishVoiceSignalToFeed(
  blob: Blob, caption: string, mood: string, anonymous: boolean, durationSeconds: number,
): Promise<{ id: string | null; audioPublic: boolean }> {
  if (!isSupabaseConfigured) return { id: null, audioPublic: false }
  try {
    const row = await uploadAudio(blob, { title: caption.slice(0, 40) || 'a signal', durationSeconds, kind: 'signal' })
    if (!row) return { id: null, audioPublic: false }
    const id = await publishSignal(caption, mood, anonymous, row.id)
    const audioPublic = await screenAudio(row.id, row.bucket, row.path, row.mime_type ?? blob.type)
    return { id, audioPublic }
  } catch {
    return { id: null, audioPublic: false }
  }
}

/** Public signals from the live backend (empty when offline/unconfigured). */
export async function fetchPublicSignals(limit = 12): Promise<RemoteSignal[]> {
  if (!isSupabaseConfigured) return []
  const client = getOptionalSupabaseClient()
  if (!client) return []
  try {
    const { data, error } = await client
      .from('signals')
      .select('id, title, caption, mood, created_at, audio_files(bucket, path, is_public)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    type Row = { id: string; title: string; caption: string | null; mood: string | null; created_at: string; audio_files: { bucket: string; path: string; is_public: boolean } | null }
    return await Promise.all((data as unknown as Row[]).map(async (row) => {
      let audioUrl: string | undefined
      const audio = row.audio_files
      if (audio?.is_public && audio.bucket && audio.path) {
        const url = await getAudioPlaybackUrl({ bucket: audio.bucket, path: audio.path }).catch(() => null)
        if (url) audioUrl = url
      }
      return {
        id: row.id,
        title: row.title,
        caption: row.caption ?? row.title,
        mood: row.mood ?? 'drift',
        createdAt: new Date(row.created_at).getTime(),
        audioUrl,
      }
    }))
  } catch {
    return []
  }
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

export type EcosphereLiveEvent = { type: string; label: string; createdAt: number }

/**
 * Subscribe to live public activity (new signals, reactions, uploads) so the
 * UI updates without a reload. No-op when the backend isn't configured.
 * Returns an unsubscribe function. The supabase client reconnects its socket
 * automatically; we also force a resubscribe when the browser comes back
 * online after a connection drop.
 */
export function subscribeToEcosphereActivity(onEvent: (event: EcosphereLiveEvent) => void): () => void {
  if (!isSupabaseConfigured) return () => {}
  const client = getOptionalSupabaseClient()
  if (!client) return () => {}

  const channel = client
    .channel('ecosphere-live-activity')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_events' }, (payload) => {
      const row = payload.new as { type?: string; is_public?: boolean; metadata?: { label?: unknown } | null; created_at?: string }
      if (!row?.is_public) return
      const label = typeof row.metadata?.label === 'string' ? row.metadata.label : null
      onEvent({
        type: row.type ?? 'activity',
        label: label ?? 'something moved in the ecosphere',
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      })
    })
    .subscribe()

  const onOnline = () => {
    void channel.subscribe()
  }
  window.addEventListener('online', onOnline)

  return () => {
    window.removeEventListener('online', onOnline)
    void client.removeChannel(channel)
  }
}

/** Fade a signal forever for this user (fire-and-forget, local-first). */
export function mirrorSignalFade(signalId: string) {
  if (!isSupabaseConfigured) return
  void (async () => {
    const client = getOptionalSupabaseClient()
    if (!client) return
    const { data } = await client.auth.getUser()
    const userId = data.user?.id
    if (!userId) return
    await client.from('faded_signals').upsert(
      { user_id: userId, signal_id: signalId },
      { onConflict: 'user_id,signal_id' },
    )
  })().catch(() => { /* local fade already applied */ })
}
