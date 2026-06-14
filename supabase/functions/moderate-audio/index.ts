// Moderate Audio Edge Function — the real screening layer for shared voice.
//
// Group voice clips upload PRIVATE (audio_files.is_public = false). This
// function transcribes the clip (speech-to-text), screens the transcript with
// the same rules as public text, and then either PROMOTES the clip to public
// (is_public = true) on a clean pass, or DELETES the audio object and marks the
// row flagged. Fail-closed: if no STT provider is configured or transcription
// fails, the clip stays private and is never heard by others.
//
// Deploy:  supabase functions deploy moderate-audio
// Secrets: supabase secrets set OPENAI_API_KEY=...     (Whisper)   — or —
//          supabase secrets set DEEPGRAM_API_KEY=...   (Deepgram)
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the
//           platform for deployed functions.)
// Called from the client right after a group voice drop:
//   supabase.functions.invoke('moderate-audio', { body: { audioId, bucket, path, mime } })
//
// This is a Deno file — excluded from the app's TypeScript project and ESLint.

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

// ─── screening: mirrored from src/lib/signalModeration.ts (keep in sync) ──────
function screenTranscript(text: string): { flagged: boolean; flags: string[] } {
  const t = text.toLowerCase()
  const flags = new Set<string>()
  if (/\b(kill|hurt|attack|stab|shoot|bomb|threat)\b/.test(t)) flags.add('threats')
  if (/\b(hate you|idiot|stupid|worthless|trash|loser)\b/.test(t)) flags.add('harassment')
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text) || /\b[\w.-]+@[\w.-]+\.\w{2,}\b/.test(text)) flags.add('explicit_personal_information')
  if (/(https?:\/\/|free money|promo code|buy now|subscribe now)/i.test(text)) flags.add('spam')
  if (/\b(self harm|suicide|overdose|exploit|blackmail)\b/.test(t)) flags.add('unsafe_content')
  if (/\b(nudes?|sexting|sext|horny|dick pic|blow ?job|hand ?job|jerk(ing)? off|cum(ming)?|tits|pussy|cock|onlyfans)\b/.test(t)) flags.add('sexual_content')
  if (
    /\b(how old are you|what'?s your age|\basl\b|are you a (girl|boy))\b/.test(t) ||
    /\b(add me on|dm me|message me on|find me on)\b.*\b(snap|snapchat|kik|insta|instagram|whatsapp|telegram|discord)\b/.test(t) ||
    /\b(send|show) (me )?(a |your )?(pic|pics|picture|photo|photos|selfie)/.test(t) ||
    /\b(meet (up|me)|where do you live|what school)\b/.test(t) ||
    /\b(i'?m|im) (1[0-7]|a minor)\b/.test(t)
  ) flags.add('child_safety')
  return { flagged: flags.size > 0, flags: [...flags] }
}

// ─── speech-to-text: Whisper, then Deepgram, else unscreened ──────────────────
async function transcribe(bytes: Uint8Array, mime: string): Promise<string | null> {
  const openai = Deno.env.get('OPENAI_API_KEY')
  if (openai) {
    const form = new FormData()
    form.append('file', new Blob([bytes], { type: mime || 'audio/webm' }), 'clip.webm')
    form.append('model', 'whisper-1')
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${openai}` },
      body: form,
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.text === 'string' ? data.text : null
  }
  const deepgram = Deno.env.get('DEEPGRAM_API_KEY')
  if (deepgram) {
    const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
      method: 'POST',
      headers: { authorization: `Token ${deepgram}`, 'content-type': mime || 'audio/webm' },
      body: bytes,
    })
    if (!res.ok) return null
    const data = await res.json()
    const alt = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript
    return typeof alt === 'string' ? alt : null
  }
  return null
}

// ─── storage + row helpers (service role) ─────────────────────────────────────
function svc(): { url: string; key: string } | null {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  return { url, key }
}

async function fetchObject(bucket: string, path: string): Promise<Uint8Array | null> {
  // group-audio is a public bucket — fetch the object bytes directly
  const ctx = svc()
  if (!ctx) return null
  const res = await fetch(`${ctx.url}/storage/v1/object/public/${bucket}/${path}`)
  if (!res.ok) return null
  return new Uint8Array(await res.arrayBuffer())
}

async function deleteObject(bucket: string, path: string): Promise<void> {
  const ctx = svc()
  if (!ctx) return
  await fetch(`${ctx.url}/storage/v1/object/${bucket}/${path}`, {
    method: 'DELETE',
    headers: { apikey: ctx.key, authorization: `Bearer ${ctx.key}` },
  })
}

async function patchRow(audioId: string, patch: Record<string, unknown>): Promise<void> {
  const ctx = svc()
  if (!ctx) return
  await fetch(`${ctx.url}/rest/v1/audio_files?id=eq.${audioId}`, {
    method: 'PATCH',
    headers: {
      apikey: ctx.key,
      authorization: `Bearer ${ctx.key}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const json = (status: string, extra: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ status, ...extra }), { headers: { 'content-type': 'application/json' } })

  try {
    const { audioId, bucket, path, mime } = await req.json()
    if (!audioId || !bucket || !path) {
      return new Response(JSON.stringify({ error: 'missing audioId/bucket/path' }), { status: 400 })
    }

    const bytes = await fetchObject(bucket, path)
    if (!bytes) return json('unscreened', { note: 'could not read the audio object' })

    const transcript = await transcribe(bytes, mime || 'audio/webm')
    if (transcript === null) {
      // fail-closed: no STT → clip stays private (not_checked)
      return json('unscreened', { note: 'no STT provider configured or transcription failed' })
    }

    const verdict = screenTranscript(transcript)
    const checkedAt = new Date().toISOString()

    if (verdict.flagged) {
      await deleteObject(bucket, path)
      await patchRow(audioId, {
        is_public: false,
        ai_moderation_status: 'flagged',
        ai_moderation_flags: verdict.flags,
        ai_moderation_checked_at: checkedAt,
      })
      return json('flagged', { flags: verdict.flags })
    }

    // clean pass → promote to public
    await patchRow(audioId, {
      is_public: true,
      ai_moderation_status: 'passed',
      ai_moderation_flags: [],
      ai_moderation_checked_at: checkedAt,
    })
    return json('passed')
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
