// AI Bio: generates a one-sentence, neutral-tone bio. Tries the `ai-bio`
// Edge Function first (real LLM, key stays server-side — see
// supabase/functions/ai-bio/index.ts); falls back to a local template
// generator built from the user's actual activity so the feature works
// without any backend at all.

import { getOptionalSupabaseClient } from './supabase'
import { isSupabaseConfigured } from './supabase-env'
import { BIO_MAX_LENGTH } from './library'

export type BioInput = {
  username: string
  recordingCount: number
  topPage: string | null
  streak: number
  joinedLabel: string | null
}

const PAGE_NOUNS: Record<string, string> = {
  rooms: 'late-night rooms',
  unsent: 'the unsent room',
  frequencies: 'the frequency sea',
  zones: 'dead zones',
  capsules: 'the capsule archive',
  relics: 'the relic shelf',
  drift: 'the drift field',
  home: 'the observatory',
  signals: 'the signal feed',
}

const OPENERS = ['Mostly found in', 'Usually drifting through', 'A regular presence in', 'Often tuned to', 'Keeps returning to']
const VOICE_CLAUSES = [
  (n: number) => `${n} transmission${n === 1 ? '' : 's'} released so far`,
  (n: number) => `${n} signal${n === 1 ? '' : 's'} on record`,
  (n: number) => `has left ${n} recording${n === 1 ? '' : 's'} on the band`,
]
const QUIET_CLAUSES = ['listening more than speaking', 'no transmissions yet, all ears', 'a quiet receiver for now']

/** Deterministic for a given seed so "regenerate" cycles distinct options. */
export function generateLocalBio(input: BioInput, seed = 0): string {
  const place = PAGE_NOUNS[input.topPage ?? ''] ?? 'the observatory'
  const opener = OPENERS[Math.abs(seed) % OPENERS.length]
  const voice = input.recordingCount > 0
    ? VOICE_CLAUSES[Math.abs(seed) % VOICE_CLAUSES.length](input.recordingCount)
    : QUIET_CLAUSES[Math.abs(seed) % QUIET_CLAUSES.length]
  const streak = input.streak >= 2 ? `, ${input.streak} nights running` : ''
  return `${opener} ${place} — ${voice}${streak}.`.slice(0, BIO_MAX_LENGTH)
}

/**
 * Real LLM bio via the Edge Function (when deployed). Returns null when
 * unavailable so callers fall back to generateLocalBio.
 */
export async function requestAiBio(recentTexts: string[]): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const client = getOptionalSupabaseClient()
  if (!client) return null
  try {
    const { data, error } = await client.functions.invoke<{ bio?: string }>('ai-bio', {
      body: { texts: recentTexts.slice(0, 10).map(t => t.slice(0, 280)) },
    })
    if (error || !data?.bio) return null
    return String(data.bio).slice(0, BIO_MAX_LENGTH)
  } catch {
    return null
  }
}
