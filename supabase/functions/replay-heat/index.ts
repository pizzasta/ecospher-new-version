// Replay heat analysis — anonymized aggregates over the listens table:
// per-signal heat scores + storm detection (many replays, short window).
// POST {} → { heat: [{signal_id, plays, listeners, heat, storm}] }
// Reads with the service role but returns ONLY aggregate counts.
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: { env: { get(n: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void }
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data, error } = await admin
    .from('listens')
    .select('signal_id, user_id, created_at')
    .gte('created_at', since)
    .limit(5000)
  if (error) return json({ error: error.message }, 500)

  const bySignal = new Map<string, { plays: number; listeners: Set<string>; recent: number }>()
  const hourAgo = Date.now() - 3600 * 1000
  for (const row of data ?? []) {
    const id = String(row.signal_id)
    const entry = bySignal.get(id) ?? { plays: 0, listeners: new Set<string>(), recent: 0 }
    entry.plays += 1
    entry.listeners.add(String(row.user_id))
    if (new Date(row.created_at).getTime() > hourAgo) entry.recent += 1
    bySignal.set(id, entry)
  }
  const heat = [...bySignal.entries()]
    .map(([signal_id, v]) => ({
      signal_id,
      plays: v.plays,
      listeners: v.listeners.size,
      heat: Math.min(1, (v.plays * 0.6 + v.listeners.size * 1.4) / 30),
      storm: v.recent >= 8 && v.listeners.size >= 3,
    }))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 50)
  return json({ heat, window: '24h' })
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}
