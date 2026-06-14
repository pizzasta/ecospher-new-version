// Visitor static: when someone passes through your frequency — a listen,
// a reaction, the phantom drifting by — they leave a faint anonymous grain
// on your profile gradient for 24 hours. No names, no counts, no list.
// Just texture. A visited profile feels visited.

import { getOptionalSupabaseClient } from './supabase'
import { ensureBackendSession } from './session'
import { isSupabaseConfigured } from './supabase-env'

const DAY_MS = 24 * 60 * 60 * 1000
export const MAX_GRAINS = 40

/** How many grains your gradient carries right now (capped). */
export async function visitorGrainCount(now = Date.now()): Promise<number> {
  let count = 0

  // local traces: phantom passes + system events on this device
  try {
    const local = JSON.parse(window.localStorage.getItem('ecosphere:localNotifications') ?? '[]') as Array<{ createdAt?: number }>
    count += local.filter(n => typeof n.createdAt === 'number' && now - n.createdAt < DAY_MS).length
  } catch { /* none */ }

  // remote traces: anyone who listened / reacted / tuned in the last 24h
  if (isSupabaseConfigured) {
    const client = getOptionalSupabaseClient()
    const userId = await ensureBackendSession()
    if (client && userId) {
      try {
        const { count: remote } = await client
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', new Date(now - DAY_MS).toISOString())
        count += remote ?? 0
      } catch { /* offline */ }
    }
  }

  return Math.min(MAX_GRAINS, count)
}

export type Grain = { x: number; y: number; size: number; opacity: number }

/**
 * Deterministic grain placement for the day — the same static all day,
 * redrawn tomorrow. Positions scatter, sizes and opacities stay faint.
 */
export function grainPositions(count: number, daySeed: number): Grain[] {
  const grains: Grain[] = []
  let state = (daySeed * 2654435761) % 0x7fffffff || 7
  const next = () => {
    state = (state * 1103515245 + 12345) % 0x7fffffff
    return state / 0x7fffffff
  }
  for (let i = 0; i < Math.min(count, MAX_GRAINS); i += 1) {
    grains.push({
      x: Math.round(next() * 100),
      y: Math.round(next() * 100),
      size: 1 + Math.round(next() * 2),
      opacity: 0.12 + next() * 0.22,
    })
  }
  return grains
}

export function daySeed(now = new Date()): number {
  return now.getFullYear() * 1000 + now.getMonth() * 50 + now.getDate()
}
