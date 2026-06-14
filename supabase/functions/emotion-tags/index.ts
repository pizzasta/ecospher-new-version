// Emotional tagging — text in, feeling tags out. Lexicon scoring runs
// always (fast, free); when ANTHROPIC_API_KEY is set, Claude refines.
// POST { text } → { tags: string[], source: 'lexicon' | 'ai' }
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: { env: { get(n: string): string | undefined }; serve(h: (r: Request) => Promise<Response> | Response): void }

const LEXICON: Array<[string, RegExp]> = [
  ['heartbreak', /\b(miss (you|her|him|them)|breakup|broke up|ex\b|never sent|still love)\b/i],
  ['insomnia', /\b(can'?t sleep|awake|3 ?am|2 ?am|insomnia|tired|sleepless)\b/i],
  ['quiet comfort', /\b(okay|calm|gentle|soft|warm|breathe|safe|slow)\b/i],
  ['unresolved', /\b(never (told|said|asked)|wish i|should have|didn'?t get to|unfinished|almost)\b/i],
  ['lonely', /\b(alone|lonely|empty|nobody|no one)\b/i],
  ['driving', /\b(driving|highway|road|car|bus|train|last stop)\b/i],
  ['chaotic', /\b(lmao|crying laughing|unhinged|chaos|screaming|wild)\b/i],
  ['trying not to cry', /\b(trying not to cry|tear(s|ing)? up|voice crack|almost cried|hold(ing)? it together)\b/i],
  ['nostalgia', /\b(remember when|used to|back then|childhood|summer|years ago)\b/i],
]

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  let text = ''
  try { text = String((await req.json())?.text ?? '').slice(0, 600) } catch { return json({ error: 'invalid body' }, 400) }
  if (!text.trim()) return json({ error: 'text required' }, 400)

  const tags = LEXICON.filter(([, rx]) => rx.test(text)).map(([tag]) => tag).slice(0, 4)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (apiKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-opus-4-8', max_tokens: 60,
          messages: [{ role: 'user', content: `Tag this anonymous late-night voice-note text with 1-3 emotional tags from exactly this set: heartbreak, insomnia, quiet comfort, unresolved, lonely, driving, chaotic, trying not to cry, nostalgia, hopeful. Reply with the tags only, comma-separated.\n\nText: ${text}` }],
        }),
      })
      if (r.ok) {
        const out = await r.json()
        const reply = out?.content?.find((b: { type?: string }) => b?.type === 'text')?.text ?? ''
        const aiTags = reply.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean).slice(0, 3)
        if (aiTags.length > 0) return json({ tags: aiTags, source: 'ai' })
      }
    } catch { /* lexicon stands */ }
  }
  return json({ tags: tags.length > 0 ? tags : ['quiet'], source: 'lexicon' })
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })
}
