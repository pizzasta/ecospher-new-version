# Group rooms — real shared voices on a topic

Tap a topic in **Rooms → Group conversations** and a small anonymous group
talks about it — simulated, deterministic scripts read by the device's own
voices over a low murmur. On top of that, two real layers:

1. **Custom groups** (no backend) — anyone can start a group from a title +
   first line, and add more lines. Stored on the device, screened by the same
   text moderation as public signals.
2. **Real human voices** (backend) — when Supabase is configured, people can
   drop a short (≤10s) screened voice clip into a group that everyone in that
   group can actually hear.

## What makes the real layer work

- A **public `group-audio` storage bucket** (migration `202606130016`). The
  private `signal-audio` bucket is owner-only, so cross-user playback needs a
  bucket whose objects are publicly readable. Inserts/deletes are still scoped
  to the uploader's own folder, so no one can write or remove on another
  person's behalf.
- Clips are ordinary **public `audio_files` rows** tagged `room_id = 'g_<topic>'`,
  `is_public = true`, with the screened one-line caption in `title`. The
  existing "public audio files are readable" policy already exposes them.
- A tiny **Realtime broadcast** (`group_<topic>`) nudges open listeners to
  refetch when a clip lands — no identifying payload on the wire.

## Enabling it

1. Run `supabase/setup-all.sql` (now through migration `202606130016`) — or just
   that migration — in the SQL editor. It creates the public bucket + policies.
2. That's it for the basic feature. With no backend it stays invisible and the
   simulated conversations carry on.

## Screening (screen-before-public)

Group voice clips are **private until screened**. The flow:

1. The drop **requires a typed caption** that is text-moderated client-side
   (defense in depth), plus an explicit "others can hear this once it's
   screened" consent.
2. The clip uploads with `is_public = false` — invisible to everyone but the
   uploader's backend.
3. The client invokes the **`moderate-audio` Edge Function**, which:
   transcribes the clip (speech-to-text) → screens the transcript with the same
   rules as public text → **promotes to `is_public = true` on a clean pass**, or
   **deletes the audio object and marks the row `flagged`**.
4. **Fail-closed:** if no STT provider is configured (or transcription fails),
   the clip stays private and never appears for others. So enabling real group
   voice REQUIRES deploying this function with an STT key.

Deploy it with a transcription provider (Whisper or Deepgram):

```
supabase functions deploy moderate-audio
supabase secrets set OPENAI_API_KEY=...      # Whisper  — or —
supabase secrets set DEEPGRAM_API_KEY=...    # Deepgram
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically for
deployed functions. Verdicts are recorded on `audio_files`
(`ai_moderation_status` / `ai_moderation_flags` / `ai_moderation_checked_at`,
migration `202606130017`).

Residual note: the `group-audio` bucket is public, so a clip's bytes are
reachable by its exact (random UUID) URL during the brief screening window even
though the app never surfaces that URL until the clip clears, and flagged
objects are deleted immediately. For stricter isolation, stage drops in a
private bucket and have the function copy to the public bucket only on a pass.
