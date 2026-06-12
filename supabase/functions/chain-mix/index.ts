// AI signal chain mixing — turns a chain's layer list into a mix plan the
// client's playChainBlend applies: entry timing, gain curve, character.
// Deterministic DSP heuristics (imperfection preserved by design); when
// ANTHROPIC_API_KEY is set, Claude adds a one-line arrangement note.
// POST { layers: [{kind, durationMs}], seed } → { plan: [...], note }
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: { env: { get(n: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void }

type Layer = { kind?: string; durationMs?: number }

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  let body: { layers?: Layer[]; seed?: number } = {}
  try { body = await req.json() } catch { return json({ error: 'invalid body' }, 400) }
  const layers = (body.layers ?? []).slice(0, 20)
  if (layers.length === 0) return json({ error: 'layers required' }, 400)
  const seed = Math.abs(Math.floor(body.seed ?? 7)) || 7

  // quiet textures sit underneath, voices in front, laughter wanders;
  // stagger is uneven on purpose — the mess is the identity
  const GAIN: Record<string, number> = { static: 0.08, zone: 0.1, tone: 0.14, whisper: 0.16, voice: 0.22, laugh: 0.18 }
  let cursor = 0
  const plan = layers.map((layer, i) => {
    const kind = layer.kind ?? 'voice'
    const jitter = ((seed * (i + 3) * 2654435761) % 700)
    const delayMs = cursor + jitter
    cursor += 380 + ((seed * (i + 7)) % 520)
    return {
      index: i,
      delayMs,
      volume: Math.round(((GAIN[kind] ?? 0.18) + (((seed * (i + 5)) % 5) - 2) * 0.012) * 1000) / 1000,
      fadeInMs: 120 + ((seed * (i + 2)) % 240),
      keepImperfections: true,
    }
  })

  let note = 'layered loose — quiet textures underneath, voices in front, nothing quantized.'
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (apiKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-opus-4-8', max_tokens: 60,
          messages: [{ role: 'user', content: `An anonymous audio chain has these layers: ${layers.map(l => l.kind).join(', ')}. In one lowercase sentence (<90 chars), describe how the blend should feel. Keep it human, no poetry words like resonance/bloom.` }],
        }),
      })
      if (r.ok) {
        const out = await r.json()
        const text = out?.content?.find((b: { type?: string }) => b?.type === 'text')?.text?.trim()
        if (text) note = text.slice(0, 120)
      }
    } catch { /* heuristics note stands */ }
  }
  return json({ plan, note })
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}
