import { supabaseEnv } from './supabase-env'
import { getSupabaseClient } from './supabase'

export type EcosphereStorageBucket = keyof typeof supabaseEnv.buckets

export function getStorageClient() {
  return getSupabaseClient().storage
}

export function getStorageBucket(bucket: EcosphereStorageBucket) {
  return getStorageClient().from(supabaseEnv.buckets[bucket])
}

export async function createSignedAudioUrl(bucket: EcosphereStorageBucket, path: string, expiresInSeconds = 60 * 10) {
  const { data, error } = await getStorageBucket(bucket).createSignedUrl(path, expiresInSeconds)

  if (error) {
    throw error
  }

  return data.signedUrl
}
