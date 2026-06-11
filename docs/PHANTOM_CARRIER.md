# Phantom Carrier — backend version

The client already shows `carrier_null` in the Active Carriers panel with its
own slow drift cycle. To make the phantom *real* — a Supabase account that
leaves reactions and occasionally drops a short audio signal — wire up the
following. This is the only feature in the app that needs the service-role
key, which is why it lives in an Edge Function and not the client.

## 1. Create the phantom account
Edge Functions (and the dashboard) can use the admin API:

```ts
// one-time setup, run anywhere the service role key is available
const { data } = await admin.auth.admin.createUser({
  email: 'phantom@internal.invalid',
  email_confirm: true,
  user_metadata: { phantom: true },
})
// then insert its profile row:
// insert into public.profiles (id, username, onboarding_complete)
// values ('<user-id>', 'carrier_null', true);
```

Store the resulting id as a function secret: `PHANTOM_USER_ID`.

## 2. Pre-generate the phantom's voice
Record (or synthesize) ~10 clips of 3 seconds each and upload them to the
`signal-audio` bucket under `<PHANTOM_USER_ID>/seed-01.webm` … `seed-10.webm`.
Suggested lines, in the app's voice: "…", "still here.", "same.",
"the band is quiet tonight.", "i heard that one too."

## 3. The scheduled function
`supabase functions new phantom-drift`, secured with a bearer secret:

```ts
import { createClient } from 'npm:@supabase/supabase-js'

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('PHANTOM_SECRET')}`) {
    return new Response('forbidden', { status: 403 })
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const phantomId = Deno.env.get('PHANTOM_USER_ID')!

  // 1. pick a random public signal and leave a reaction in activity_events
  const { data: signals } = await db.from('signals').select('id').eq('visibility', 'public').limit(50)
  if (signals?.length) {
    const target = signals[Math.floor(Math.random() * signals.length)]
    const word = ['…', 'same', 'static', 'drift', 'faint', 'hmm', 'still', 'warm', 'cold', 'lost'][Math.floor(Math.random() * 10)]
    await db.from('activity_events').insert({
      type: 'voice_reaction', user_id: phantomId, signal_id: target.id,
      metadata: { label: `carrier_null left "${word}" on a drifting signal` }, is_public: true,
    })
  }

  // 2. one run in five, register one of the seed clips as a new signal
  if (Math.random() < 0.2) {
    const n = String(1 + Math.floor(Math.random() * 10)).padStart(2, '0')
    const { data: audio } = await db.from('audio_files').insert({
      owner_id: phantomId, bucket: 'signal-audio', path: `${phantomId}/seed-${n}.webm`,
      title: 'a transmission from nowhere', duration_seconds: 3, kind: 'signal', is_public: true,
    }).select().maybeSingle()
    if (audio) {
      await db.from('signals').insert({
        creator_id: phantomId, audio_file_id: audio.id, type: 'voice_note',
        title: 'carrier_null', caption: 'this one was already playing when you tuned in.',
        mood: 'static', visibility: 'public',
      })
    }
  }

  // 3. touch last_active
  await db.from('profiles').update({ updated_at: new Date().toISOString() }).eq('id', phantomId)
  return new Response('ok')
})
```

## 4. Schedule it
Either Supabase cron (`select cron.schedule('phantom-drift', '*/10 * * * *', …)`
calling the function via `net.http_post` with the bearer secret) or an
external pinger like cron-job.org hitting the function URL every 5–15 min
with the `Authorization: Bearer <PHANTOM_SECRET>` header.

Because the phantom's reactions land in `activity_events` with
`is_public = true`, the app's existing realtime live-echo chip will surface
them to everyone currently connected — no client changes needed.
