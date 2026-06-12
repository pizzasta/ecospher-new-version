// Google sign-in via Supabase OAuth, built for an anonymous-first app:
// an existing anonymous session is UPGRADED in place (linkIdentity), so the
// user id — and every saved signal, echo, reaction, relic note, and capsule
// tied to it — stays connected. Email and real name never render publicly;
// the only public identity is the chosen signal name.

import { getOptionalSupabaseClient } from './supabase'

export type GoogleAuthResult = { ok: true } | { ok: false; error: string }

/** Human-readable message for every known failure mode. Pure — testable. */
export function googleAuthErrorMessage(raw: string | null | undefined): string {
  const msg = (raw ?? '').toLowerCase()
  if (msg.includes('not configured')) {
    return "google sign-in needs the backend keys — this deploy is running local-only (missing supabase environment variables)"
  }
  if (msg.includes('popup')) {
    return 'your browser blocked the sign-in window — allow popups for this site, then try again'
  }
  if (msg.includes('provider is not enabled') || msg.includes('unsupported provider') || msg.includes('validation_failed')) {
    return "google sign-in isn't switched on in supabase yet — dashboard → authentication → providers → google"
  }
  if (msg.includes('identity_already_exists') || msg.includes('already been linked')) {
    return 'that google account is already tied to another signal — sign out here first, then sign in with google directly'
  }
  if (msg.includes('manual_linking_disabled') || msg.includes('linking is disabled')) {
    return 'identity linking is off in supabase (auth → settings) — enable it, or sign out before connecting google'
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return "the band couldn't reach google — check your connection and try again"
  }
  return raw ? `sign-in failed: ${raw}` : 'sign-in failed — try again in a moment'
}

/**
 * Start Google sign-in (redirect flow — no popup to get blocked).
 * Anonymous session present → upgrade it in place; otherwise a fresh OAuth
 * sign-in. Either way the browser leaves for Google and returns to /pod.
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  const client = getOptionalSupabaseClient()
  if (!client) return { ok: false, error: googleAuthErrorMessage('not configured') }
  const redirectTo = `${window.location.origin}/pod`

  try {
    const { data } = await client.auth.getSession()
    const current = data.session?.user
    if (current?.is_anonymous) {
      // upgrade: same user id, all existing rows stay owned by this signal
      const { error } = await client.auth.linkIdentity({ provider: 'google', options: { redirectTo } })
      if (!error) return { ok: true }
      // linking unavailable (disabled, or google already used elsewhere):
      // fall back to a plain sign-in under the google identity
      const { error: oauthError } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
      if (oauthError) return { ok: false, error: googleAuthErrorMessage(oauthError.message) }
      return { ok: true }
    }
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) return { ok: false, error: googleAuthErrorMessage(error.message) }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: googleAuthErrorMessage(err instanceof Error ? err.message : null) }
  }
}

/** Fallback signal name when a brand-new google user has no local identity. */
export function defaultUsernameFor(userId: string): string {
  return `signal_${userId.replace(/-/g, '').slice(0, 6).toLowerCase()}`
}

export type ProfileBootstrap = {
  status: 'ready' | 'needs-claim' | 'skipped' | 'failed'
  username?: string
}

/**
 * After sign-in: make sure the profile/hub row exists and carries a signal
 * name. Existing profile → adopt its username locally. No profile yet →
 * create one (default settings come from the table's column defaults), using
 * the device's local identity when there is one. A fresh device with no
 * local identity gets 'needs-claim' so the claim screen can take over.
 */
export async function ensureProfileAfterAuth(userId: string): Promise<ProfileBootstrap> {
  const client = getOptionalSupabaseClient()
  if (!client) return { status: 'skipped' }

  try {
    const { data: existing } = await client
      .from('profiles')
      .select('id, username')
      .eq('id', userId)
      .maybeSingle()

    if (existing?.username) {
      try { window.localStorage.setItem('signalIdentity', existing.username) } catch { /* session only */ }
      return { status: 'ready', username: existing.username }
    }

    let local: string | null = null
    try { local = window.localStorage.getItem('signalIdentity') } catch { /* unavailable */ }
    const username = local || defaultUsernameFor(userId)

    const { error } = await client
      .from('profiles')
      .upsert({ id: userId, username, updated_at: new Date().toISOString() })
    if (error) return { status: 'failed' }

    if (local) {
      return { status: 'ready', username }
    }
    // brand-new signal: leave local identity unset so the claim screen runs
    return { status: 'needs-claim', username }
  } catch {
    return { status: 'failed' }
  }
}
