// Nightly recap creation — builds the caller's last-24h recap from THEIR
// rows (user JWT + RLS; the function never sees anyone else's data) and
// optionally files it as a notification. Cron-friendly: see docs.
// POST { file?: boolean } → { recap: { lines, plays, reactions } }
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: { env: { get(n: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void }
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: auth } = await client.auth.getUser()
  if (!auth?.user) return json({ error: 'sign in first' }, 401)

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const [{ data: listens }, { data: notifications }] = await Promise.all([
    client.from('listens').select('signal_id, created_at').gte('created_at', since).limit(500),
    client.from('notifications').select('kind, created_at').gte('created_at', since).limit(200),
  ])

  const plays = listens?.length ?? 0
  const touched = notifications?.length ?? 0
  const counts = new Map<string, number>()
  for (const row of listens ?? []) counts.set(String(row.signal_id), (counts.get(String(row.signal_id)) ?? 0) + 1)
  const topCount = Math.max(0, ...counts.values())
  const lateNight = (listens ?? []).filter(l => { const h = new Date(l.created_at).getHours(); return h >= 0 && h < 5 }).length

  const lines: string[] = []
  if (plays === 0) lines.push('the band barely heard you tonight. that counts too.')
  else lines.push(`${plays} replay${plays === 1 ? '' : 's'} in the last 24 hours`)
  if (topCount >= 3) lines.push(`you replayed one signal ${topCount} times — it has its hooks in you`)
  if (lateNight > 0) lines.push(`${lateNight} of those happened after midnight`)
  if (touched > 0) lines.push(`${touched} thing${touched === 1 ? '' : 's'} touched your signals while you were away`)

  let filed = false
  try {
    if ((await req.clone().json())?.file) {
      const { error } = await client.from('notifications').insert({ user_id: auth.user.id, kind: 'recap', body: lines.join(' · ') })
      filed = !error
    }
  } catch { /* not filed */ }

  return json({ recap: { lines, plays, reactions: touched }, filed })
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}
