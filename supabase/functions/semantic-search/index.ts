// Semantic emotional search — embeds queries AND the corpus with Supabase's
// built-in gte-small model (384 dims, runs inside the Edge runtime, no
// external API key), then matches by cosine similarity in pgvector.
//
// Deploy:  supabase functions deploy semantic-search
// Seed:    invoke once with { "action": "seed" } (idempotent upsert)
// Search:  invoke with { "query": "people trying not to cry" }
//
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}
// Supabase Edge runtime built-in embedding model
declare const Supabase: {
  ai: { Session: new (model: string) => { run(input: string, opts?: { mean_pool?: boolean; normalize?: boolean }): Promise<number[]> } }
}

import { createClient } from 'jsr:@supabase/supabase-js@2'

// the corpus: every emotional surface of the app, written as feelings.
// content = what gets embedded; the rest is what the client renders/routes.
const CORPUS: Array<{ id: string; title: string; sub: string; page: string; kind: string; seed: number; content: string }> = [
  { id: 'rl1', title: 'unlabeled tape, side B', sub: 'a second voice hums along underneath', page: 'relics', kind: 'tone', seed: 311, content: 'a mysterious comforting hum, background company, someone quietly there with you, warm static, never alone' },
  { id: 'rl2', title: 'heartbeat on the night bus', sub: 'still keeps time', page: 'relics', kind: 'whisper', seed: 322, content: 'calm heartbeat, insomnia comfort, slowing your breathing down, quiet steady company at night, falling asleep to a sound' },
  { id: 'rl3', title: 'voicemail, number unknown', sub: 'one name, three times', page: 'relics', kind: 'voice', seed: 333, content: 'a lonely voicemail, sounds lonely, missing someone, unresolved goodbye, a voice you cannot call back' },
  { id: 'rl5', title: 'half a confession', sub: 'cut off where it mattered', page: 'relics', kind: 'voice', seed: 355, content: 'an unfinished conversation, a confession cut short, what they never got to say, holding something back, trying not to cry' },
  { id: 'rl6', title: 'answering machine, 1999', sub: 'eleven saved messages, each kinder', page: 'relics', kind: 'voice', seed: 366, content: 'heartbreak, old saved messages from someone gone, grief and tenderness, people trying not to cry, love left on tape' },
  { id: 'rl7', title: 'the hold music', sub: 'people replay the cough at minute 22', page: 'relics', kind: 'tone', seed: 377, content: 'background comfort, waiting together, gentle boredom, soft repetitive music, ambient company' },
  { id: 'rl8', title: 'wind through a screen door', sub: "someone's whole summer, by accident", page: 'relics', kind: 'static', seed: 388, content: 'quiet comfort, nostalgia for a summer you never had, peaceful background sound, home noises, missing a feeling' },
  { id: 'rl9', title: 'last bus announcement', sub: 'a route cancelled the next morning', page: 'relics', kind: 'zone', seed: 399, content: 'late night driving, lonely transit, the last ride home, endings, empty roads at night' },
  { id: 'rl10', title: 'sealed birthday tape', sub: 'nobody ever came back for it', page: 'relics', kind: 'static', seed: 410, content: 'something never said, almost sent, a gift never opened, waiting forever, quiet grief' },
  { id: 'rm1', title: "Can't Sleep room", sub: 'for everyone staring at the ceiling', page: 'rooms', kind: 'whisper', seed: 521, content: 'insomnia, cannot sleep, awake at 3am, restless night, tired but wired, everyone too tired to sleep' },
  { id: 'rm2', title: 'Missing Someone room', sub: "for whoever's on your mind", page: 'rooms', kind: 'voice', seed: 532, content: 'sounds lonely, missing someone badly, heartbreak at night, thinking about a person who left, people trying not to cry' },
  { id: 'rm3', title: 'Late Night Driving room', sub: 'voices for the empty highway', page: 'rooms', kind: 'zone', seed: 543, content: 'late night driving, music loud in an empty car, highway loneliness, clearing your head on the road' },
  { id: 'rm4', title: 'Oversharing Hour room', sub: 'no context, no shame', page: 'rooms', kind: 'laugh', seed: 554, content: 'chaotic laughter, people laughing too hard, ridiculous stories, joyful mess, group laughter in the distance' },
  { id: 'rm5', title: 'Comfort Room', sub: "a weighted blanket but it's voices", page: 'rooms', kind: 'whisper', seed: 565, content: 'quiet comfort, soft reassurance, gentle voices, feeling held, late night comfort, being okay slowly' },
  { id: 'rm6', title: 'Songwriters Awake room', sub: 'unfinished songs tonight', page: 'rooms', kind: 'tone', seed: 576, content: 'unfinished songs, a melody that will not resolve, creative 2am energy, humming an idea, songs people stayed in' },
  { id: 'rm7', title: 'Post Argument room', sub: 'just had a fight. decompress', page: 'rooms', kind: 'static', seed: 587, content: 'arguing softly, after a fight, unresolved tension, what i wish i had said, unfinished conversation' },
  { id: 'cp1', title: 'the rare frequency drop', sub: '24 hours, then gone forever', page: 'capsules', kind: 'tone', seed: 611, content: 'urgent and temporary, hear it before it disappears, replay storm, once in a lifetime sound' },
  { id: 'ch1', title: 'insomnia chain', sub: 'strangers layering voices instead of sleeping', page: 'chains', kind: 'whisper', seed: 711, content: 'insomnia, awake together, strangers at 3am, layered whispers, everyone too tired to sleep' },
  { id: 'ch2', title: 'anonymous choir', sub: 'the internet accidentally singing together', page: 'chains', kind: 'tone', seed: 722, content: 'strangers singing together, accidental harmony, messy beautiful choir, human voices piling up' },
  { id: 'ch3', title: 'breakup chain', sub: 'what nobody got to say, layered', page: 'chains', kind: 'voice', seed: 733, content: 'heartbreak, breakup feelings, what nobody got to say, unresolved endings, people trying not to cry' },
  { id: 'sea1', title: 'the frequency sea', sub: 'live emotional audio drifting nearby', page: 'frequencies', kind: 'static', seed: 811, content: 'drifting through distant voices, overhearing humanity, ambient ocean of sound, quiet signals nearby, background voices' },
  { id: 'sea2', title: 'group laughter, far away', sub: 'somewhere across the water', page: 'frequencies', kind: 'laugh', seed: 822, content: 'people laughing in the distance, warmth far away, joy you can almost touch, distant party' },
  { id: 'dr2', title: 'silence, but nobody leaves', sub: 'on the radar right now', page: 'drift', kind: 'static', seed: 922, content: 'comfortable silence together, nobody hanging up, staying on the line, quiet company, presence without words' },
  { id: 'dz1', title: 'dead zones', sub: 'rooms that went quiet', page: 'zones', kind: 'zone', seed: 1011, content: 'abandoned places, conversations that faded, what got left behind, recovering lost fragments, gone quiet' },
  { id: 'un1', title: 'the unsent room', sub: 'say the thing you never sent', page: 'unsent', kind: 'voice', seed: 1111, content: 'unsent message, unfinished conversation, what i never told you, almost sent it, things left unsaid, trying not to cry' },
]

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  let body: { query?: string; action?: string } = {}
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400 }) }

  const session = new Supabase.ai.Session('gte-small')
  const embed = async (text: string) => session.run(text, { mean_pool: true, normalize: true })

  // one-time idempotent seeding (service role writes; RLS keeps clients read-only)
  if (body.action === 'seed') {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    for (const entry of CORPUS) {
      const embedding = await embed(`${entry.title}. ${entry.sub}. ${entry.content}`)
      const { error } = await admin.from('semantic_entries').upsert({ ...entry, embedding, updated_at: new Date().toISOString() })
      if (error) return new Response(JSON.stringify({ error: error.message, at: entry.id }), { status: 500 })
    }
    return new Response(JSON.stringify({ seeded: CORPUS.length }), { headers: { 'content-type': 'application/json' } })
  }

  const query = (body.query ?? '').slice(0, 120).trim()
  if (!query) return new Response(JSON.stringify({ error: 'query required' }), { status: 400 })

  const queryEmbedding = await embed(query)
  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data, error } = await client.rpc('match_semantic_entries', {
    query_embedding: queryEmbedding,
    match_count: 6,
    min_similarity: 0.55,
  })
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  return new Response(JSON.stringify({ results: data ?? [] }), { headers: { 'content-type': 'application/json' } })
})
