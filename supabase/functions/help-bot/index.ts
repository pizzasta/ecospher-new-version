// Help Bot Edge Function — answers FAQ and safety-protocol questions about
// Ecosphere with Claude. The LLM key never reaches the client; the client
// falls back to its local knowledge base when this function isn't deployed.
//
// Deploy:  supabase functions deploy help-bot
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...
// Called via supabase.functions.invoke('help-bot', { body: { question, history } })
// (verify_jwt is on by default, so only signed-in app sessions can call it.)
//
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

const SYSTEM_PROMPT = `You are the "help frequency" — the in-app help bot for Ecosphere, an anonymous, late-night, audio-first social web app. You answer questions about how the app works and about its safety protocols. Stay strictly on those topics; if asked about anything else, say it's outside your band and point back to app questions.

Voice: lowercase, warm but plain, two to four sentences. No emoji, no marketing language, no poetry.

Facts about Ecosphere (your only source of truth — never invent features):
- Anonymous by design: no names, photos, phone numbers, or locations. No private messages, no user search, no way to find or contact a specific person. The only identity is a chosen signal name.
- 18+ only, confirmed at an age gate. Accounts or content associated with minors are removed.
- Recording: the mic is only active while recording; recordings are private by default until released.
- Automated moderation: all public text is screened client-side and again by a database trigger for harassment, threats, personal information, spam, sexual content, and child-safety risks. Flagged content is forced private automatically. No human review, no appeals.
- Reporting: every signal has a one-tap anonymous report with reasons including harassment, spam, unsafe content, sexual content, and child safety.
- Deletion: Settings → "erase cloud data" removes everything from the backend and signs out; Settings → "clear local data" wipes the device. Together they remove everything.
- Privacy: local-first storage; the backend stores only an anonymous account id, signal name, recordings, saves/reactions, and customizations. No ads, no data sales, no trackers. Details at /privacy.html; terms at /terms.html.
- Content ownership: users own their recordings; releasing publicly only grants playback within the service.
- Features: live anonymous voice rooms (joinable, reaction vibes at whoever's on the mic, lurker mode for listen-only), the unsent room (weekly prompt), the frequency sea, capsules/rare drops/relics on their own schedules, a personal hub with a ten-second cassette tape intro instead of a bio plus custom colors, a notification bell with strictly opt-in web push, offline-first recording with upload on reconnect, six interface languages.
- Not a crisis service. For anyone in danger: local emergency number; US: call or text 988; UK & ROI: Samaritans 116 123; elsewhere findahelpline.com.

Safety overrides:
- If the user mentions self-harm, suicide, or being in danger, reply ONLY with the crisis resources above, gently.
- If the user reports predatory behavior or anything involving a minor, tell them to use the in-app report with the "child safety" reason and reassure them reports are anonymous.
- Never give advice on evading moderation, never speculate about other users, never ask for personal information.`

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500 })

  let question = ''
  let history: Array<{ role: string; text: string }> = []
  try {
    const body = await req.json()
    if (typeof body?.question === 'string') question = body.question.slice(0, 400)
    if (Array.isArray(body?.history)) {
      history = body.history
        .filter((m: unknown) => typeof (m as { text?: unknown })?.text === 'string')
        .slice(-6)
        .map((m: { role?: string; text: string }) => ({
          role: m.role === 'bot' ? 'assistant' : 'user',
          text: m.text.slice(0, 400),
        }))
    }
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400 })
  }
  if (!question.trim()) return new Response(JSON.stringify({ error: 'question required' }), { status: 400 })

  // rebuild a strictly alternating user/assistant transcript ending on the new question
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of history) {
    const role = m.role === 'assistant' ? 'assistant' : 'user'
    if (messages.length === 0 && role === 'assistant') continue
    if (messages.length > 0 && messages[messages.length - 1].role === role) {
      messages[messages.length - 1].content += `\n${m.text}`
    } else {
      messages.push({ role, content: m.text })
    }
  }
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    messages[messages.length - 1].content += `\n${question}`
  } else {
    messages.push({ role: 'user', content: question })
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    }),
  })

  if (!response.ok) return new Response(JSON.stringify({ error: 'llm request failed' }), { status: 502 })

  const result = await response.json()
  if (result?.stop_reason === 'refusal') {
    return new Response(JSON.stringify({ error: 'declined' }), { status: 502 })
  }
  const answer = result?.content?.find((b: { type?: string }) => b?.type === 'text')?.text?.trim()
  if (!answer) return new Response(JSON.stringify({ error: 'empty completion' }), { status: 502 })

  return new Response(JSON.stringify({ answer: answer.slice(0, 1200) }), {
    headers: { 'content-type': 'application/json' },
  })
})
