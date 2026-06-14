// Relic resurfacing logic — the server decides which relic resurfaces
// tonight and where, so every client agrees (no clock drift, no spoofing).
// Deterministic per UTC day; replay-heat data nudges the pick when the
// listens table has activity.
// POST {} → { relicId, room, until }
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: { env: { get(n: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void }
import { createClient } from 'jsr:@supabase/supabase-js@2'

const RELIC_IDS = ['rl1', 'rl2', 'rl3', 'rl4', 'rl5', 'rl6', 'rl7', 'rl8', 'rl9', 'rl10']
const ROOMS = ["Can't Sleep", '3am Thoughts', 'Missing Someone', 'Background Voices', 'Comfort Room', 'Late Night Driving']

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const day = Math.floor(Date.now() / 86400000)
  let pick = day % RELIC_IDS.length

  // nudge: if last night had real listening activity, shift the rotation
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { count } = await admin.from('listens').select('id', { count: 'exact', head: true }).gte('created_at', since)
    if (typeof count === 'number' && count > 0) pick = (day + count) % RELIC_IDS.length
  } catch { /* deterministic rotation stands */ }

  const until = new Date((day + 1) * 86400000).toISOString()
  return new Response(JSON.stringify({
    relicId: RELIC_IDS[pick],
    room: ROOMS[(day * 7 + pick) % ROOMS.length],
    until,
  }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' } })
})
