// Phantom Carrier drift job — see docs/PHANTOM_CARRIER.md for full setup.
// Deploy:  supabase functions deploy phantom-drift --no-verify-jwt
// Secrets: supabase secrets set PHANTOM_SECRET=... PHANTOM_USER_ID=...
// Schedule it every 5-15 minutes (Supabase cron or an external pinger)
// with the header  Authorization: Bearer <PHANTOM_SECRET>
//
// This is a Deno file (Supabase Edge Function) — excluded from the app's
// TypeScript project and ESLint config.

// @ts-expect-error Deno npm specifier, resolved at deploy time
import { createClient } from 'npm:@supabase/supabase-js@2'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

const REACTION_WORDS = ['…', 'same', 'static', 'drift', 'faint', 'hmm', 'still', 'warm', 'cold', 'lost']

Deno.serve(async (req: Request) => {
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('PHANTOM_SECRET')}`) {
    return new Response('forbidden', { status: 403 })
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const phantomId = Deno.env.get('PHANTOM_USER_ID')
  if (!phantomId) return new Response('PHANTOM_USER_ID not set', { status: 500 })

  // 1. leave a reaction on a random public signal (surfaces in everyone's
  //    realtime live-echo chip because is_public = true)
  const { data: signals } = await db.from('signals').select('id').eq('visibility', 'public').limit(50)
  if (signals && signals.length > 0) {
    const target = signals[Math.floor(Math.random() * signals.length)]
    const word = REACTION_WORDS[Math.floor(Math.random() * REACTION_WORDS.length)]
    await db.from('activity_events').insert({
      type: 'voice_reaction',
      user_id: phantomId,
      signal_id: target.id,
      metadata: { label: `carrier_null left "${word}" on a drifting signal` },
      is_public: true,
    })
  }

  // 2. one run in five: register one of the pre-uploaded seed clips
  //    (signal-audio/<phantomId>/seed-01.webm … seed-10.webm) as a signal
  if (Math.random() < 0.2) {
    const n = String(1 + Math.floor(Math.random() * 10)).padStart(2, '0')
    const { data: audio } = await db
      .from('audio_files')
      .insert({
        owner_id: phantomId,
        bucket: 'signal-audio',
        path: `${phantomId}/seed-${n}.webm`,
        title: 'a transmission from nowhere',
        duration_seconds: 3,
        kind: 'signal',
        is_public: true,
      })
      .select()
      .maybeSingle()
    if (audio) {
      await db.from('signals').insert({
        creator_id: phantomId,
        audio_file_id: audio.id,
        type: 'voice_note',
        title: 'carrier_null',
        caption: 'this one was already playing when you tuned in.',
        mood: 'static',
        visibility: 'public',
      })
    }
  }

  // 3. touch last-active
  await db.from('profiles').update({ updated_at: new Date().toISOString() }).eq('id', phantomId)

  return new Response('ok')
})
