import { getOptionalSupabaseClient } from './supabase'
import { supabaseEnv } from './supabase-env'
import { ensureBackendSession, getBackendUserId } from './session'
import type { Database, Json } from './database.types'

type Tables = Database['public']['Tables']
export type ProfileRow = Tables['profiles']['Row']
export type SavedSignalRow = Tables['saved_signals']['Row']
export type AudioFileRow = Tables['audio_files']['Row']
export type CapsuleRow = Tables['capsules']['Row']
export type UserRelicRow = Tables['user_relics']['Row']
export type ArchiveItemRow = Tables['archive_items']['Row']
export type ActivityEventRow = Tables['activity_events']['Row']

export type ArchiveItemType = ArchiveItemRow['item_type']

export type ActivityEventType =
  | 'signal_played'
  | 'signal_saved'
  | 'signal_unsaved'
  | 'voice_reaction'
  | 'signal_reported'
  | 'drift_discovery'
  | 'audio_uploaded'
  | 'audio_renamed'
  | 'audio_deleted'
  | 'capsule_created'
  | 'capsule_opened'
  | 'capsule_deleted'
  | 'relic_unlocked'
  | 'relic_favorited'
  | 'item_archived'
  | 'item_unarchived'
  | 'username_updated'
  | 'room_joined'
  | 'local_data_migrated'

function client() {
  return getOptionalSupabaseClient()
}

async function requireUser() {
  const userId = await ensureBackendSession()
  if (!userId) return null
  return { db: client()!, userId }
}

// ─── Activity history ─────────────────────────────────────────────────────────

export async function logActivity(
  type: ActivityEventType,
  refs: Partial<Pick<ActivityEventRow, 'signal_id' | 'audio_file_id' | 'relic_id' | 'capsule_id'>> = {},
  metadata: Json | null = null,
) {
  const ctx = await requireUser()
  if (!ctx) return false
  const { error } = await ctx.db.from('activity_events').insert({
    type,
    user_id: ctx.userId,
    metadata,
    ...refs,
  })
  return !error
}

export async function listActivity(limit = 50) {
  const ctx = await requireUser()
  if (!ctx) return []
  const { data } = await ctx.db
    .from('activity_events')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function syncProfile(username: string, signalCore?: string | null) {
  const ctx = await requireUser()
  if (!ctx) return null

  const { data: existing } = await ctx.db.from('profiles').select('*').eq('id', ctx.userId).maybeSingle()

  if (!existing) {
    const { data, error } = await ctx.db
      .from('profiles')
      .insert({ id: ctx.userId, username, signal_core: signalCore ?? null, onboarding_complete: true })
      .select()
      .maybeSingle()
    return error ? null : data
  }

  if (existing.username !== username || (signalCore && existing.signal_core !== signalCore)) {
    const { data, error } = await ctx.db
      .from('profiles')
      .update({ username, signal_core: signalCore ?? existing.signal_core })
      .eq('id', ctx.userId)
      .select()
      .maybeSingle()
    if (!error && existing.username !== username) {
      void logActivity('username_updated', {}, { previous: existing.username, next: username })
    }
    return error ? null : data
  }

  return existing
}

export async function getProfile() {
  const ctx = await requireUser()
  if (!ctx) return null
  const { data } = await ctx.db.from('profiles').select('*').eq('id', ctx.userId).maybeSingle()
  return data
}

// ─── Saved signals ────────────────────────────────────────────────────────────

export async function saveSignal(signalId: string, note?: string) {
  const ctx = await requireUser()
  if (!ctx) return false
  const { error } = await ctx.db
    .from('saved_signals')
    .upsert({ user_id: ctx.userId, signal_id: signalId, note: note ?? null }, { onConflict: 'user_id,signal_id' })
  if (!error) void logActivity('signal_saved', { signal_id: signalId })
  return !error
}

export async function unsaveSignal(signalId: string) {
  const ctx = await requireUser()
  if (!ctx) return false
  const { error } = await ctx.db.from('saved_signals').delete().eq('user_id', ctx.userId).eq('signal_id', signalId)
  if (!error) void logActivity('signal_unsaved', { signal_id: signalId })
  return !error
}

export async function listSavedSignals() {
  const ctx = await requireUser()
  if (!ctx) return []
  const { data } = await ctx.db
    .from('saved_signals')
    .select('*, signals(*)')
    .eq('user_id', ctx.userId)
    .order('saved_at', { ascending: false })
  return data ?? []
}

export async function recordReplay(signalId: string, sourcePage: string) {
  const db = client()
  if (!db) return false
  const userId = await getBackendUserId()
  const { error } = await db.from('replays').insert({
    signal_id: signalId,
    listener_id: userId,
    source_page: sourcePage,
  })
  return !error
}

// ─── Audio library ────────────────────────────────────────────────────────────

export async function uploadAudio(blob: Blob, options: { title?: string; durationSeconds?: number; isPublic?: boolean } = {}) {
  const ctx = await requireUser()
  if (!ctx) return null

  const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const path = `${ctx.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  const bucket = supabaseEnv.buckets.signalAudio

  const { error: uploadError } = await ctx.db.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || 'audio/webm',
    upsert: false,
  })
  if (uploadError) return null

  const { data, error } = await ctx.db
    .from('audio_files')
    .insert({
      owner_id: ctx.userId,
      bucket,
      path,
      title: options.title ?? null,
      duration_seconds: options.durationSeconds ?? null,
      mime_type: blob.type || 'audio/webm',
      is_public: options.isPublic ?? false,
    })
    .select()
    .maybeSingle()

  if (error || !data) return null
  void logActivity('audio_uploaded', { audio_file_id: data.id })
  return data
}

export async function listAudioLibrary(includeArchived = false) {
  const ctx = await requireUser()
  if (!ctx) return []
  let query = ctx.db
    .from('audio_files')
    .select('*')
    .eq('owner_id', ctx.userId)
    .order('created_at', { ascending: false })
  if (!includeArchived) query = query.eq('is_archived', false)
  const { data } = await query
  return data ?? []
}

export async function getAudioPlaybackUrl(audio: Pick<AudioFileRow, 'bucket' | 'path'>, expiresInSeconds = 600) {
  const db = client()
  if (!db) return null
  const { data, error } = await db.storage.from(audio.bucket).createSignedUrl(audio.path, expiresInSeconds)
  return error ? null : data.signedUrl
}

export async function renameAudio(audioId: string, title: string) {
  const ctx = await requireUser()
  if (!ctx) return false
  const { error } = await ctx.db.from('audio_files').update({ title }).eq('id', audioId).eq('owner_id', ctx.userId)
  if (!error) void logActivity('audio_renamed', { audio_file_id: audioId })
  return !error
}

export async function setAudioVisibility(audioId: string, isPublic: boolean) {
  const ctx = await requireUser()
  if (!ctx) return false
  const { error } = await ctx.db
    .from('audio_files')
    .update({ is_public: isPublic })
    .eq('id', audioId)
    .eq('owner_id', ctx.userId)
  return !error
}

export async function setAudioArchived(audioId: string, isArchived: boolean) {
  const ctx = await requireUser()
  if (!ctx) return false
  const { error } = await ctx.db
    .from('audio_files')
    .update({ is_archived: isArchived })
    .eq('id', audioId)
    .eq('owner_id', ctx.userId)
  if (!error) void logActivity(isArchived ? 'item_archived' : 'item_unarchived', { audio_file_id: audioId })
  return !error
}

export async function deleteAudio(audio: Pick<AudioFileRow, 'id' | 'bucket' | 'path'>) {
  const ctx = await requireUser()
  if (!ctx) return false
  await ctx.db.storage.from(audio.bucket).remove([audio.path])
  const { error } = await ctx.db.from('audio_files').delete().eq('id', audio.id).eq('owner_id', ctx.userId)
  if (!error) void logActivity('audio_deleted', {})
  return !error
}

// ─── Capsules ─────────────────────────────────────────────────────────────────

export async function createCapsule(input: {
  title: string
  textNote?: string
  audioPath?: string
  emotionalTag?: string
  unlockAt?: Date | null
}) {
  const ctx = await requireUser()
  if (!ctx) return null
  const { data, error } = await ctx.db
    .from('capsules')
    .insert({
      user_id: ctx.userId,
      title: input.title,
      text_note: input.textNote ?? null,
      audio_path: input.audioPath ?? null,
      emotional_tag: input.emotionalTag ?? null,
      unlock_at: input.unlockAt ? input.unlockAt.toISOString() : null,
    })
    .select()
    .maybeSingle()
  if (error || !data) return null
  void logActivity('capsule_created', { capsule_id: data.id })
  return data
}

export async function listCapsules() {
  const ctx = await requireUser()
  if (!ctx) return []
  const { data } = await ctx.db
    .from('capsules')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export function isCapsuleUnlocked(capsule: Pick<CapsuleRow, 'unlock_at'>) {
  return !capsule.unlock_at || new Date(capsule.unlock_at).getTime() <= Date.now()
}

export async function openCapsule(capsuleId: string) {
  const ctx = await requireUser()
  if (!ctx) return null
  const { data: capsule } = await ctx.db.from('capsules').select('*').eq('id', capsuleId).eq('user_id', ctx.userId).maybeSingle()
  if (!capsule || !isCapsuleUnlocked(capsule)) return null
  const { data, error } = await ctx.db
    .from('capsules')
    .update({ opened_at: capsule.opened_at ?? new Date().toISOString(), status: 'saved' })
    .eq('id', capsuleId)
    .select()
    .maybeSingle()
  if (!error) void logActivity('capsule_opened', { capsule_id: capsuleId })
  return error ? null : data
}

export async function deleteCapsule(capsuleId: string) {
  const ctx = await requireUser()
  if (!ctx) return false
  const { error } = await ctx.db.from('capsules').delete().eq('id', capsuleId).eq('user_id', ctx.userId)
  if (!error) void logActivity('capsule_deleted', {})
  return !error
}

// ─── Relics ───────────────────────────────────────────────────────────────────

export async function unlockUserRelic(relicId: string, discoverySource?: string, sourceSignalId?: string) {
  const ctx = await requireUser()
  if (!ctx) return false
  const { error } = await ctx.db.from('user_relics').upsert(
    {
      user_id: ctx.userId,
      relic_id: relicId,
      discovery_source: discoverySource ?? null,
      source_signal_id: sourceSignalId ?? null,
    },
    { onConflict: 'user_id,relic_id', ignoreDuplicates: true },
  )
  if (!error) void logActivity('relic_unlocked', { relic_id: relicId }, { source: discoverySource ?? null })
  return !error
}

export async function listUserRelics() {
  const ctx = await requireUser()
  if (!ctx) return []
  const { data } = await ctx.db
    .from('user_relics')
    .select('*, relics(*)')
    .eq('user_id', ctx.userId)
    .order('unlocked_at', { ascending: false })
  return data ?? []
}

export async function setRelicFavorite(userRelicId: string, isFavorite: boolean) {
  const ctx = await requireUser()
  if (!ctx) return false
  const { error } = await ctx.db
    .from('user_relics')
    .update({ is_favorite: isFavorite })
    .eq('id', userRelicId)
    .eq('user_id', ctx.userId)
  if (!error && isFavorite) void logActivity('relic_favorited', {})
  return !error
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function archiveItem(itemType: ArchiveItemType, itemId: string, note?: string) {
  const ctx = await requireUser()
  if (!ctx) return false
  const { error } = await ctx.db
    .from('archive_items')
    .upsert({ user_id: ctx.userId, item_type: itemType, item_id: itemId, note: note ?? null }, { onConflict: 'user_id,item_type,item_id' })
  if (!error) void logActivity('item_archived', {}, { itemType, itemId })
  return !error
}

export async function unarchiveItem(itemType: ArchiveItemType, itemId: string) {
  const ctx = await requireUser()
  if (!ctx) return false
  const { error } = await ctx.db
    .from('archive_items')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('item_type', itemType)
    .eq('item_id', itemId)
  if (!error) void logActivity('item_unarchived', {}, { itemType, itemId })
  return !error
}

export async function listArchive() {
  const ctx = await requireUser()
  if (!ctx) return []
  const { data } = await ctx.db
    .from('archive_items')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('archived_at', { ascending: false })
  return data ?? []
}
