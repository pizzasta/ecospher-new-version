// Bridge between the local-first ecosystem store and the Supabase backend.
// Everything here is fire-and-forget and configured-guarded: when env vars
// are missing or the network fails, the app keeps running on localStorage /
// IndexedDB exactly as before. The mock feed content has no relational rows
// yet, so cross-page actions mirror into activity_events (free-form type +
// metadata); real audio recordings mirror into storage + audio_files.

import { isSupabaseConfigured } from './supabase-env'
import { deleteAudio, getAudioPlaybackUrl, listAudioLibrary, logActivity, uploadAudio } from './library'
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
}

/** Public signals from the live backend (empty when offline/unconfigured). */
export async function fetchPublicSignals(limit = 12): Promise<RemoteSignal[]> {
  if (!isSupabaseConfigured) return []
  const client = getOptionalSupabaseClient()
  if (!client) return []
  try {
    const { data, error } = await client
      .from('signals')
      .select('id, title, caption, mood, created_at')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data.map((row) => ({
      id: row.id,
      title: row.title,
      caption: row.caption ?? row.title,
      mood: row.mood ?? 'drift',
      createdAt: new Date(row.created_at).getTime(),
    }))
  } catch {
    return []
  }
}
