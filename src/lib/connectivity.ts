// Lightweight connectivity probe. navigator.onLine only knows whether a
// network interface exists — not whether our backend is actually reachable.
// This pings a real endpoint and reports the truth, so the offline banner
// reflects "can we reach the backend" rather than "is there any interface".

import { isSupabaseConfigured, supabaseEnv } from './supabase-env'

const PING_TIMEOUT_MS = 4000

/** Returns true if we can actually reach the network/backend right now. */
export async function probeConnectivity(): Promise<boolean> {
  // SSR / non-browser guard: if the OS is certain we're offline, trust it.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  if (typeof fetch === 'undefined') return true // can't probe; assume online

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)

  try {
    // Prefer the Supabase auth health endpoint (cheap, CORS-friendly) when
    // configured; otherwise hit our own origin with a cache-busting request.
    const url = isSupabaseConfigured
      ? `${supabaseEnv.url}/auth/v1/health`
      : `${location.origin}/favicon.ico?_=${Date.now()}`

    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: isSupabaseConfigured ? { apikey: supabaseEnv.anonKey } : undefined,
    })
    // Any answer from the server proves reachability — even a 401/403 means we
    // got there; only a thrown error (network/timeout) counts as offline.
    return res.ok || res.status === 401 || res.status === 403
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
