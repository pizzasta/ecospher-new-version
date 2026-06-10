import { getOptionalSupabaseClient } from './supabase'
import { ensureBackendSession } from './session'
import { logActivity, syncProfile } from './library'

const migrationFlagKey = 'ecosphereBackendMigrated'
const signalIdentityKey = 'signalIdentity'
const signalProfileKey = 'ecosphereSignalProfile'
const ecosystemStateKey = 'ecosphere:EcosystemState'

/**
 * One-time, idempotent migration of prototype localStorage data into the
 * backend. Local data is never removed — it stays as the offline fallback.
 * Safe to call on every boot: it exits early when Supabase is not configured,
 * when no session can be established, or when migration already ran.
 */
export async function migrateLocalDataToBackend(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!getOptionalSupabaseClient()) return false
  if (window.localStorage.getItem(migrationFlagKey) === 'true') return false

  const userId = await ensureBackendSession()
  if (!userId) return false

  const username = window.localStorage.getItem(signalIdentityKey)
  if (!username) return false

  let signalCore: string | null = null
  try {
    const profileRaw = window.localStorage.getItem(signalProfileKey)
    if (profileRaw) signalCore = JSON.parse(profileRaw)?.signalCore ?? null
  } catch {
    signalCore = null
  }

  const profile = await syncProfile(username, signalCore)
  if (!profile) return false

  let ecosystemSnapshot: unknown = null
  try {
    const stateRaw = window.localStorage.getItem(ecosystemStateKey)
    if (stateRaw) ecosystemSnapshot = JSON.parse(stateRaw)
  } catch {
    ecosystemSnapshot = null
  }

  await logActivity('local_data_migrated', {}, {
    migratedAt: new Date().toISOString(),
    hadEcosystemState: Boolean(ecosystemSnapshot),
  })

  window.localStorage.setItem(migrationFlagKey, 'true')
  return true
}
