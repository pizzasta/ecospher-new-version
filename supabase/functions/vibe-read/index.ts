// Vibe Read Edge Function — turns three onboarding answers (and an optional
// one-line mood) into node settings, choosing ONLY from the option lists the
// app sends. The client validates the reply again and falls back on-device.
//
// Deploy:  supabase functions deploy vibe-read
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...   (shared with ai-bio)
// Called via supabase.functions.invoke('vibe-read', { body: { answers, line, options } })
// Nothing is stored. verify_jwt stays on, so only app sessions can call it.
//
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const FIELDS = ['mood', 'energy', 'drift', 'aura', 'stability', 'sigil', 'paletteId', 'style', 'scene3d', 'firstStop'] as const

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not set' }, 500)

  let answers: Record<string, string> = {}
  let line = ''
  let options: Record<string, string[]> = {}
  try {
    const body = await req.json()
    for (const k of ['hour', 'weather', 'need']) {
      const v = body?.answers?.[k]
      if (typeof v === 'string') answers[k] = v.slice(0, 24)
    }
    line = typeof body?.line === 'string' ? body.line.slice(0, 140) : ''
    for (const f of FIELDS) {
      const list = body?.options?.[f]
      if (!Array.isArray(list) || list.length === 0 || list.length > 40) return json({ error: `options.${f} required` }, 400)
      options[f] = list.filter((x: unknown) => typeof x === 'string').map((x: string) => x.slice(0, 24))
    }
  } catch {
    return json({ error: 'invalid body' }, 400)
  }

  const prompt = `You set up the profile for a new user of EchoSphere, an anonymous late-night voice app with a cyber-noir look.
Their answers:
- most themselves at: ${answers.hour ?? '(skipped)'}
- weather in their head: ${answers.weather ?? '(skipped)'}
- tonight they want to: ${answers.need ?? '(skipped)'}
- in their own words: ${line ? JSON.stringify(line) : '(nothing)'}

Pick exactly one value for each field, ONLY from these lists:
${FIELDS.map(f => `${f}: ${options[f].join(', ')}`).join('\n')}

Also write "reading": one or two short lowercase sentences in second person that tell them how they come across tonight and why their node looks the way it does. Atmospheric, warm, specific to their answers. No therapy talk, no diagnosis, no emoji, under 170 characters.

Reply with a single JSON object with keys ${[...FIELDS, 'reading'].join(', ')} and nothing else.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!response.ok) return json({ error: 'llm request failed' }, 502)

  const result = await response.json()
  const text: string = result?.content?.[0]?.text ?? ''
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return json({ error: 'no json in completion' }, 502)
  let vibe: Record<string, unknown>
  try { vibe = JSON.parse(text.slice(start, end + 1)) } catch { return json({ error: 'bad json in completion' }, 502) }

  // server-side check too: every field must be one of the offered options
  for (const f of FIELDS) {
    if (typeof vibe[f] !== 'string' || !options[f].includes(vibe[f] as string)) return json({ error: `invalid ${f}` }, 502)
  }
  if (typeof vibe.reading !== 'string') return json({ error: 'missing reading' }, 502)
  vibe.reading = (vibe.reading as string).slice(0, 180)

  return json({ vibe })
})
