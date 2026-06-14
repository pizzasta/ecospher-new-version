import { getOptionalSupabaseClient } from './supabase'

/**
 * Returns the current authenticated user id, signing in anonymously when no
 * session exists yet. Resolves to null when Supabase is not configured or
 * anonymous sign-in is unavailable, so callers can fall back to localStorage.
 */
export async function ensureBackendSession(): Promise<string | null> {
  const client = getOptionalSupabaseClient()
  if (!client) return null

  try {
    const { data } = await client.auth.getSession()
    if (data.session?.user) return data.session.user.id

    const { data: anonData, error } = await client.auth.signInAnonymously()
    if (error) return null
    return anonData.user?.id ?? null
  } catch {
    return null
  }
}

export async function getBackendUserId(): Promise<string | null> {
  const client = getOptionalSupabaseClient()
  if (!client) return null

  try {
    const { data } = await client.auth.getSession()
    return data.session?.user?.id ?? null
  } catch {
    return null
  }
}
