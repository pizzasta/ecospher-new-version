// AI Bio Edge Function — generates a one-sentence neutral bio from the
// user's recent signal texts. The LLM key never reaches the client.
//
// Deploy:  supabase functions deploy ai-bio
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...
// Called via supabase.functions.invoke('ai-bio', { body: { texts: [...] } })
// (verify_jwt is on by default, so only signed-in app sessions can call it.)
//
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500 })

  let texts: string[] = []
  try {
    const body = await req.json()
    if (Array.isArray(body?.texts)) {
      texts = body.texts.filter((t: unknown) => typeof t === 'string').slice(0, 10).map((t: string) => t.slice(0, 280))
    }
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400 })
  }
  if (texts.length === 0) return new Response(JSON.stringify({ error: 'texts required' }), { status: 400 })

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Here are short anonymous voice-signal transcripts from one user of a late-night audio app:\n\n${texts.map(t => `- ${t}`).join('\n')}\n\nWrite a single-sentence profile bio for this user in a neutral, observational tone. Lowercase, under 150 characters, no hashtags, no emoji, no quotation marks. Reply with the bio sentence only.`,
      }],
    }),
  })

  if (!response.ok) return new Response(JSON.stringify({ error: 'llm request failed' }), { status: 502 })

  const result = await response.json()
  const bio = result?.content?.[0]?.text?.trim()
  if (!bio) return new Response(JSON.stringify({ error: 'empty completion' }), { status: 502 })

  return new Response(JSON.stringify({ bio: bio.slice(0, 200) }), {
    headers: { 'content-type': 'application/json' },
  })
})
