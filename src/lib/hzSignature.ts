// Personal Hz Signature: a data-derived frequency identity.
// Formula: (avg signal duration s * 2) + (reactions received * 0.5) + 20,
// clamped to 20.0-200.0. Local-first with backend sync when configured.

import { getOptionalSupabaseClient } from './supabase'
import { ensureBackendSession } from './session'
import { isSupabaseConfigured } from './supabase-env'
import { listLocalRecordings } from './localAudioStore'

export const HZ_MIN = 20
export const HZ_MAX = 200
export const HZ_NAME_MAX = 20
export const HZ_DEFAULT_COLOR = '#66ccff'

export const HZ_PRESET_COLORS = [
  { name: 'cyan', value: '#66ccff' },
  { name: 'purple', value: '#c084fc' },
  { name: 'amber', value: '#fbbf24' },
  { name: 'green', value: '#86efac' },
  { name: 'pink', value: '#ff2d78' },
] as const

export type HzProfile = {
  hz: number
  displayName: string | null
  color: string
}

export function computeHzSignature(avgDurationSeconds: number, totalReactions: number): number {
  const raw = avgDurationSeconds * 2 + totalReactions * 0.5 + 20
  return Math.round(Math.min(HZ_MAX, Math.max(HZ_MIN, raw)) * 10) / 10
}

/** Stable Hz + color for synthetic handles (feed ghosts, carriers). */
export function hzForHandle(handle: string): HzProfile {
  let hash = 5
  for (let i = 0; i < handle.length; i += 1) hash = (hash * 31 + handle.charCodeAt(i)) % 99991
  const hz = Math.round((HZ_MIN + (hash % ((HZ_MAX - HZ_MIN) * 10)) / 10) * 10) / 10
  return { hz, displayName: null, color: HZ_PRESET_COLORS[hash % HZ_PRESET_COLORS.length].value }
}

/** The phantom's signature never changes. */
export const PHANTOM_HZ: HzProfile = { hz: 33.3, displayName: 'null', color: '#c084fc' }

export function validateHzDisplayName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return null // empty clears the name — valid
  if (trimmed.length > HZ_NAME_MAX) return `max ${HZ_NAME_MAX} characters`
  if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) return 'letters, numbers, and spaces only'
  return null
}

export function isPresetColor(color: string): boolean {
  return HZ_PRESET_COLORS.some(preset => preset.value === color)
}

// ─── local-first persistence ──────────────────────────────────────────────────

const HZ_KEY = 'ecosphere:hzProfile'

function readLocalHz(): Partial<HzProfile> {
  try { return JSON.parse(window.localStorage.getItem(HZ_KEY) ?? '{}') } catch { return {} }
}

function writeLocalHz(profile: HzProfile) {
  try { window.localStorage.setItem(HZ_KEY, JSON.stringify(profile)) } catch { /* session only */ }
  try { window.dispatchEvent(new CustomEvent('ecosphere:hz', { detail: profile })) } catch { /* non-browser */ }
}

/**
 * Seed the local signature once — onboarding previews an Hz derived from the
 * chosen name, and this makes that the Hz the hub shows afterwards instead of
 * the 20.0 floor. Never overwrites a signature that already exists; the next
 * recalc from real activity replaces it either way.
 */
export function seedHzSignature(hz: number): void {
  const previous = readLocalHz()
  if (typeof previous.hz === 'number') return
  const clamped = Math.round(Math.min(HZ_MAX, Math.max(HZ_MIN, hz)) * 10) / 10
  writeLocalHz({ hz: clamped, displayName: previous.displayName ?? null, color: previous.color ?? HZ_DEFAULT_COLOR })
}

/** Synchronous local profile — instant render; backend refresh follows. */
export function getLocalHzProfile(identity: string): HzProfile {
  const local = readLocalHz()
  if (typeof local.hz === 'number') {
    return { hz: local.hz, displayName: local.displayName ?? null, color: local.color ?? HZ_DEFAULT_COLOR }
  }
  return hzForHandle(identity)
}

/** Current Hz profile: backend row when available, else local, else seeded. */
export async function getHzProfile(identity: string): Promise<HzProfile> {
  if (isSupabaseConfigured) {
    const client = getOptionalSupabaseClient()
    const userId = await ensureBackendSession()
    if (client && userId) {
      try {
        const { data } = await client.from('profiles').select('hz_signature, hz_display_name, hz_color').eq('id', userId).maybeSingle()
        if (data?.hz_signature != null) {
          const profile = { hz: Number(data.hz_signature), displayName: data.hz_display_name, color: data.hz_color ?? HZ_DEFAULT_COLOR }
          writeLocalHz(profile)
          return profile
        }
      } catch { /* fall through to local */ }
    }
  }
  const local = readLocalHz()
  if (typeof local.hz === 'number') {
    return { hz: local.hz, displayName: local.displayName ?? null, color: local.color ?? HZ_DEFAULT_COLOR }
  }
  return hzForHandle(identity)
}

/** Recompute from actual stats and persist. Returns the new value. */
export async function recalcHzSignature(): Promise<number> {
  const recordings = await listLocalRecordings()
  let avgDuration = recordings.length > 0
    ? recordings.reduce((sum, r) => sum + r.durationMs / 1000, 0) / recordings.length
    : 0
  let reactions = 0

  if (isSupabaseConfigured) {
    const client = getOptionalSupabaseClient()
    const userId = await ensureBackendSession()
    if (client && userId) {
      try {
        const [audio, notif] = await Promise.all([
          client.from('audio_files').select('duration_seconds').eq('owner_id', userId).limit(200),
          client.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('type', ['new_reaction', 'phantom_interaction']),
        ])
        const rows = audio.data ?? []
        if (rows.length > 0) {
          avgDuration = rows.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0) / rows.length
        }
        reactions = notif.count ?? 0
      } catch { /* local stats only */ }
    }
  }

  const hz = computeHzSignature(avgDuration, reactions)
  const previous = readLocalHz()
  writeLocalHz({ hz, displayName: previous.displayName ?? null, color: previous.color ?? HZ_DEFAULT_COLOR })

  if (isSupabaseConfigured) {
    const client = getOptionalSupabaseClient()
    const userId = await ensureBackendSession()
    if (client && userId) {
      try { await client.from('profiles').update({ hz_signature: hz }).eq('id', userId) } catch { /* synced next recalc */ }
    }
  }
  return hz
}

/** Update display name + color (validated). Returns an error string or null. */
export async function updateHzSettings(displayName: string, color: string): Promise<string | null> {
  const nameError = validateHzDisplayName(displayName)
  if (nameError) return nameError
  if (!isPresetColor(color)) return 'pick one of the preset colors'

  const trimmed = displayName.trim()
  const previous = readLocalHz()
  writeLocalHz({ hz: typeof previous.hz === 'number' ? previous.hz : computeHzSignature(0, 0), displayName: trimmed || null, color })

  if (isSupabaseConfigured) {
    const client = getOptionalSupabaseClient()
    const userId = await ensureBackendSession()
    if (client && userId) {
      try {
        await client.from('profiles').update({ hz_display_name: trimmed || null, hz_color: color }).eq('id', userId)
      } catch { /* synced on next save */ }
    }
  }
  return null
}
