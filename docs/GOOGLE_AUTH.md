# Google Sign-In Setup

Ecosphere uses Supabase Auth with Google OAuth, layered on top of the
existing anonymous-first design: an anonymous session is **upgraded in
place** (`linkIdentity`), so the user id never changes and every saved
signal, echo, reaction, relic note, capsule, listening-history row, and
profile customization stays connected automatically.

## Supabase tables needed

No new tables. Everything ships in `supabase/setup-all.sql`:

- `profiles` — id (= auth.users.id), username, hz/gradient settings,
  lurker_mode, is_private. Created/updated automatically after sign-in.
- `signals`, `recordings`, `reactions`, `listens`, `notifications`,
  `push_subscriptions`, `faded_signals` — all keyed to the same user id,
  protected by RLS.

The user's **email and real name live only in `auth.users`** (managed by
Supabase) and are never copied into `profiles` — nothing public can ever
render them. The only public identity is the signal name.

## Environment variables (already required for the backend)

| Variable | Where |
|---|---|
| `VITE_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Vercel project env |
| `VITE_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | Vercel project env |

No new variables. The Google client secret lives in the Supabase
dashboard, never in this repo or in Vercel.

## Google OAuth setup steps

1. **Google Cloud Console** (console.cloud.google.com):
   - Create/select a project → APIs & Services → OAuth consent screen
     (External, fill app name + support email).
   - Credentials → Create credentials → OAuth client ID → Web application.
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Copy the Client ID + Client Secret.
2. **Supabase dashboard** → Authentication → Providers → Google:
   - Enable, paste Client ID + Secret, save.
3. **Supabase dashboard** → Authentication → URL Configuration:
   - Site URL: `https://ecospher-new-version.vercel.app`
   - Additional redirect URLs: `https://ecospher-new-version.vercel.app/pod`
     (plus `http://localhost:5173/pod` for local dev).
4. **Supabase dashboard** → Authentication → Settings:
   - Keep **anonymous sign-ins** enabled (the app's default mode).
   - Enable **manual linking** so anonymous sessions can upgrade to
     Google without losing their data. (If left off, the app falls back
     to a fresh Google session automatically.)

## What happens on sign-in

1. "Continue with Google" on the Soul Pod login screen → redirect flow
   (no popup, so nothing to block; popup errors are still mapped to a
   clear message just in case).
2. Back at `/pod`, the app detects the new session and shows
   "signed in — connecting your hub…".
3. `ensureProfileAfterAuth` runs: existing profile → adopt its username;
   no profile → create one. New user on a fresh device → sent to the
   Claim Signal screen; everyone else lands on the Soul Pod hub.
4. Settings shows a "Signed In" row (email visible only there) with a
   sign-out button; the hub keeps its existing sign-out too.

## Test checklist

- [ ] Fresh anonymous device → Continue with Google → returns signed in,
      same data still present (echoes, saves, notes), lands on hub
- [ ] Brand-new Google user, fresh browser → after sign-in, Claim Signal
      screen appears; claimed name lands in `profiles.username`
- [ ] Returning Google user on a new device → lands directly on hub with
      their existing username restored locally
- [ ] Email appears ONLY in Settings → Signed In and the hub account row
      — never in feed, rooms, traces, or exports
- [ ] Sign out (Settings or hub) → reload returns to local/anonymous mode
      with local data intact
- [ ] Google provider disabled in Supabase → button shows the
      "providers → google" error message
- [ ] Deploy without Supabase env vars → button shows the
      "missing supabase environment variables" message
- [ ] Vercel production: redirect returns to
      https://ecospher-new-version.vercel.app/pod with a valid session
