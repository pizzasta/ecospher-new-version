// Waveform generation — server-side peaks for any stored recording.
// Computes an energy-distribution waveform from the encoded bytes
// (fast, no audio decoding in the Edge runtime); good for visual bars.
// POST { path: "recordings/<uid>/<file>", peaks?: 48 } → { peaks: number[] }
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: { env: { get(n: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void }
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  let body: { path?: string; peaks?: number } = {}
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const path = (body.path ?? '').replace(/\.\./g, '')
  const peakCount = Math.min(128, Math.max(12, body.peaks ?? 48))
  if (!path) return json({ error: 'path required' }, 400)

  // user-scoped client: RLS + storage policies decide what they can read
  const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data, error } = await client.storage.from('recordings').download(path)
  if (error || !data) return json({ error: 'not found or not yours' }, 404)

  const bytes = new Uint8Array(await data.arrayBuffer())
  const window = Math.max(1, Math.floor(bytes.length / peakCount))
  const peaks: number[] = []
  for (let p = 0; p < peakCount; p++) {
    let sum = 0
    const start = p * window
    for (let i = start; i < Math.min(start + window, bytes.length); i += 7) sum += Math.abs(bytes[i] - 128)
    peaks.push(sum / Math.ceil(window / 7))
  }
  const max = Math.max(1, ...peaks)
  return json({ peaks: peaks.map(v => Math.round((v / max) * 100) / 100) })
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}
