# Production Deploy Checklist

The frontend deploys to Vercel automatically on push to `main` and runs fully in
**local-only** mode with no backend. To light up the multi-user backend (feed
fan-out, cross-user reactions + notifications, public voice, moderation, quotas)
do the following. See `SUPABASE_SETUP.md` for the longer walkthrough.

## 1. Database schema + policies (one paste)
Supabase Dashboard → **SQL Editor** → New query → paste **all** of
`supabase/setup-all.sql` → **Run**. It's idempotent (safe to re-run) and now
includes every migration through:
- `guard_public_text` — server-side moderation on `sea_lines` + `public_notes`
  (rejects flagged inserts; the client screen is bypassable).
- `enforce_audio_monthly_quota` — 60 MB/user/month server cap on `audio_files`.
- `enforce_public_text_rate_limit` — 15 posts/hour/author on the anon text tables
  (uses a private `author` column; its SELECT is revoked so anonymity holds).

Equivalent via CLI: `supabase link --project-ref <ref>` then `supabase db push`.

## 2. Anonymous sign-in
Dashboard → **Authentication → Sign In / Up → Anonymous sign-ins** → enable.
(The app creates anonymous sessions silently; inserts require an authenticated
role, including anon.)

## 3. Storage buckets
`setup-all.sql` creates them, but verify in **Storage**: `signal-audio`,
`capsule-audio`, `profile-cores`, `group-audio`.
- For **public voice posts** to play for other users, the **`signal-audio`**
  bucket needs public read for promoted clips (same pattern as `group-audio`).
  `moderate-audio` only flips a clip public after it passes screening.

## 4. Edge functions (needed for audio moderation, etc.)
`supabase functions deploy` (all) or at minimum **`moderate-audio`** for
public-voice screening. Others: `semantic-search`, `nightly-recap`, `send-push`,
`signal-decay`, `replay-heat`, `phantom-drift`, etc.

## 5. Vercel environment variables
Vercel → project → **Settings → Environment Variables** (all environments), then
**Redeploy**:
```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```
Optional (defaults shown, only set to override):
```
VITE_SUPABASE_SIGNAL_AUDIO_BUCKET=signal-audio
VITE_SUPABASE_CAPSULE_AUDIO_BUCKET=capsule-audio
VITE_SUPABASE_PROFILE_CORES_BUCKET=profile-cores
VITE_SUPABASE_GROUP_AUDIO_BUCKET=group-audio
VITE_VAPID_PUBLIC_KEY=<web-push public key>   # only for push notifications
```
The Vercel × Supabase native integration's `NEXT_PUBLIC_SUPABASE_*` names are
also accepted automatically — if you use it, no manual vars are needed.

## 6. Verify in production
- Feed leads with seeded "from the network" signals; releasing a post shows it
  to others; reacting to someone's post creates a `new_reaction` notification.
- Try posting flagged text → it should be rejected (server guardian), confirming
  step 1 applied.
- Recordings upload to Storage; `activity_events` rows appear.

Without steps 1–5 the app still works end-to-end on localStorage/IndexedDB — the
backend simply stays dark.
