# Ecosphere Security Model

The app is a Vite single-page app talking directly to Supabase under Row
Level Security. There is no server of our own — so there are no API routes,
no cookies, and no SSR middleware. Auth uses bearer tokens managed by
supabase-js (not cookies), which makes classic CSRF inapplicable.

## Authentication
- **Anonymous-first**: the app silently creates an anonymous Supabase session
  before any backend write (`ensureBackendSession`). Users never see a login
  wall — that's the product.
- **Email/password** sign-up & sign-in live in the Soul Pod, with sign-out.
  Supabase's built-in rate limiting covers brute force on these endpoints.
- Sessions auto-refresh via supabase-js; expiry is configured in the Supabase
  dashboard (Auth → Sessions).
- Google sign-in can be added by enabling the provider in the dashboard.

## Row Level Security
- RLS is enabled on every table (`setup-all.sql`).
- Reads: public rows or your own. Writes: owner-scoped (`auth.uid()`).
- `202606110003`: insert policies restricted to the `authenticated` role —
  the public anon key alone (no session) cannot write.
- `202606110004`: delete-own policies so account erasure can remove
  activity, replays, relics, and the profile row.

## Storage
- All three buckets (`signal-audio`, `capsule-audio`, `profile-cores`) are
  **private**. Playback uses short-lived signed URLs (10 min), fetched on
  demand. Upload/read/delete policies are scoped to the user's own folder
  (`{userId}/...`) and the `authenticated` role.

## Upload hardening (`src/lib/library.ts`)
- MIME allowlist: `audio/webm`, `audio/mp4`, `audio/ogg`, `audio/mpeg`
  (prefix match for codec suffixes).
- Size ≤ 2 MB, duration 3–60 s, validated before any storage call.
- Filenames are `crypto.randomUUID()` — original names are never trusted.
- `room_id` must match `^[a-z0-9_-]{1,64}$` or it is dropped.
- `kind` is constrained by a Postgres CHECK plus a TypeScript union.
- Client-side rate limit: 10 uploads per rolling minute. (Server-side rate
  limiting would need a Supabase Edge Function — recommended next step.)

## XSS / input handling
- React escapes all rendered text; no `dangerouslySetInnerHTML` anywhere.
- The vendored VR layer escapes user text via `_escapeHtml` before
  `innerHTML`.
- Identities: normalized to `[a-z0-9_]`, validated 3–24 chars at the claim
  screen and the settings rename (client) — the DB stores them as plain text.

## Headers (`vercel.json`)
CSP (self-only scripts, Supabase connect, blob media, Google Fonts),
`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (microphone same-origin only). Vercel enforces HTTPS.

## Environment variables
- Only the Supabase URL and **anon public** key are exposed (`VITE_`
  prefixed) — that is by design; security comes from RLS, not key secrecy.
- The service-role key is never referenced anywhere in this codebase.
- `scripts/check-env.mjs` runs before every build: it fails the build on a
  partial Supabase config or if any service-role variable is present.

## Account deletion
Settings → **Erase Cloud Data** calls `deleteAccountData()`: removes every
storage object across all buckets, deletes all owned rows (dependents first,
profile last), then signs out. Every step is RLS-scoped, so it can only ever
touch the caller's own data. The bare `auth.users` row remains (deleting it
requires the service-role key — do it from the dashboard or an Edge Function
if full erasure is required). "Clear Local Data" wipes this device.

## Known gaps / next steps
- Server-side rate limiting + moderation (Edge Function) — current
  moderation and rate limits run client-side.
- Per-user reaction de-duplication needs a backend reactions table with a
  unique constraint (reactions are currently local-first).
- Sentry (or similar) for security-event logging in production.

## Child safety
Layered precautions, enforced at every level the app controls:

- **18+ age gate** before onboarding. Self-attestation (the strongest check
  a client can run); declining is remembered and sticky, not a retry prompt.
- **No private channels, by design.** There are no DMs, no friend requests,
  no photo sharing, no user search, and no way to browse or contact a
  specific person. Predation requires a private channel; this app has none.
  Treat this as a load-bearing safety property when adding features.
- **Predator-pattern screening** in the AI moderation rules (client AND the
  database trigger from `202606110011`): age solicitation ("how old are
  you", "asl"), off-platform contact pulls (snap/kik/instagram/whatsapp/
  telegram/discord), photo requests, meet-up pressure, and minor
  self-identification. Flagged content can never become public and the
  warning explains why without echoing the content.
- **Every free-text vector is screened**: public signals (client + server
  trigger), room whispers, and passing thoughts.
- **Anonymity as protection**: no real names, no photos, no profiles
  browsable by name, no location features.
- **Instant reporting** with a dedicated "child safety" reason — content
  hides immediately, no human review needed to act.
- **Data minimalism**: no birthdates collected, no contact graphs, audio
  private by default.

Known limits: self-attestation cannot verify age, and audio content is not
transcribed/screened (an Edge Function with a speech-to-text + moderation
pass is the upgrade path if the app grows).
