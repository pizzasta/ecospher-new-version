// Signal decay processing — scheduled job: cools replay heat with age and
// marks long-cold public signals as faded. Batched + idempotent; safe to
// run hourly via pg_cron (see docs/EDGE_FUNCTIONS.md).
// POST {} → { cooled, faded }   (requires the service role internally)
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: { env: { get(n: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void }
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  // cool: heat decays 12% per run on public signals untouched for 24h+
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data: cooling, error: coolErr } = await admin
    .from('signals')
    .select('id, heat')
    .eq('visibility', 'public')
    .is('faded_at', null)
    .lt('updated_at', dayAgo)
    .gt('heat', 0.05)
    .limit(200)
  if (coolErr) return json({ error: coolErr.message }, 500)

  let cooled = 0
  let faded = 0
  for (const row of cooling ?? []) {
    const next = Math.round((Number(row.heat ?? 1) * 0.88) * 1000) / 1000
    const patch: Record<string, unknown> = { heat: next }
    if (next <= 0.08) { patch.faded_at = new Date().toISOString(); faded += 1 }
    const { error } = await admin.from('signals').update(patch).eq('id', row.id)
    if (!error) cooled += 1
  }
  return json({ cooled, faded, batch: cooling?.length ?? 0 })
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}
