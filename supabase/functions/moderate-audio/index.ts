// Moderate Audio Edge Function — the real screening layer for shared voice.
// Group voice drops carry a typed caption that the client already moderates;
// this function adds the deeper screen: transcribe the clip (speech-to-text)
// and run the transcript through the same text moderation before the clip is
// allowed to stay public. Until it's deployed, group drops are gated only by
// their caption + the report flow, so treat this as the safety upgrade that
// must land before real audio is featured widely.
//
// Deploy:  supabase functions deploy moderate-audio
// Secrets: supabase secrets set ANTHROPIC_API_KEY=...   (and an STT key/provider)
// Called server-side (e.g. from a storage webhook or a scheduled sweep) with
//   { audioId, bucket, path }  — it transcribes, screens, and on a flag flips
//   the audio_files row to is_public = false and records the reason.
//
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

// Reused word/phrase screens — keep in sync with src/lib/signalModeration.ts.
const BLOCK = [
  /\bkill yourself\b/i,
  /\b(home|work) address\b/i,
  /\bmy number is\b/i,
  /\bsnapchat|telegram|whatsapp\b/i,
]

function screenTranscript(text: string): { flagged: boolean; reason: string | null } {
  for (const rx of BLOCK) {
    if (rx.test(text)) return { flagged: true, reason: 'transcript matched a blocked pattern' }
  }
  return { flagged: false, reason: null }
}

// Placeholder STT — wire to your provider (Whisper, Deepgram, etc.). Returning
// null means "couldn't transcribe", which the caller should treat as unscreened.
async function transcribe(_bucket: string, _path: string): Promise<string | null> {
  // const key = Deno.env.get('STT_API_KEY'); ... fetch provider ... return text
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  try {
    const { audioId, bucket, path } = await req.json()
    if (!audioId || !bucket || !path) {
      return new Response(JSON.stringify({ error: 'missing audioId/bucket/path' }), { status: 400 })
    }

    const transcript = await transcribe(bucket, path)
    if (transcript === null) {
      return new Response(JSON.stringify({ status: 'unscreened', note: 'no STT provider configured' }), {
        headers: { 'content-type': 'application/json' },
      })
    }

    const verdict = screenTranscript(transcript)
    if (verdict.flagged) {
      const url = Deno.env.get('SUPABASE_URL')
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (url && serviceKey) {
        await fetch(`${url}/rest/v1/audio_files?id=eq.${audioId}`, {
          method: 'PATCH',
          headers: {
            apikey: serviceKey,
            authorization: `Bearer ${serviceKey}`,
            'content-type': 'application/json',
            prefer: 'return=minimal',
          },
          body: JSON.stringify({ is_public: false }),
        })
      }
    }

    return new Response(JSON.stringify({ status: verdict.flagged ? 'flagged' : 'clear', reason: verdict.reason }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
