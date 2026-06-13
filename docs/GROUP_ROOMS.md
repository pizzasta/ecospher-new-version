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

## Screening (important)

Every drop **requires a typed caption** that is text-moderated client-side and
shown to listeners — that's the interim screen, plus the existing one-tap
report/hide and an explicit "others will hear this" consent before upload.

The **full** screen is the `moderate-audio` Edge Function
(`supabase/functions/moderate-audio`): transcribe the clip (speech-to-text) →
run the transcript through moderation → flip the row to `is_public = false` on a
flag. It ships as a scaffold — wire an STT provider and deploy it before
featuring real audio widely:

```
supabase functions deploy moderate-audio
supabase secrets set ANTHROPIC_API_KEY=...   # plus your STT provider key
```

Call it from a storage webhook on new `group-audio` objects, or as a scheduled
sweep over recent public group clips.
