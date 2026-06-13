# Backend smoke test

A manual, end-to-end checklist to run once after enabling the Supabase backend,
and again after any migration or function change. It verifies the things unit
tests can't: real auth, storage, RLS isolation, realtime, and audio moderation.

Everything here is local-first, so a failure at any step degrades gracefully —
the app keeps working in simulated mode. The goal is to confirm the *real*
paths before relying on them.

## 0. Prerequisites

- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in the deploy env
      (Vercel) and locally in `.env`.
- [ ] `supabase/setup-all.sql` run in the SQL editor (through migration
      **202606130017**). Re-running is safe (idempotent).
- [ ] Auth providers: **Anonymous sign-ins** ON; **Manual linking** ON (for the
      anon→Google upgrade); **Google** configured per `docs/GOOGLE_AUTH.md`.
- [ ] Buckets exist: `signal-audio` (private), `capsule-audio`, `profile-cores`,
      and `group-audio` (public, migration 0016).
- [ ] For group voice: `moderate-audio` deployed with `OPENAI_API_KEY` or
      `DEEPGRAM_API_KEY` (see `docs/GROUP_ROOMS.md`).

Use two browsers (or a normal + incognito window) so you can act as **two
anonymous users** — call them A and B.

## 1. Anonymous session + boot

- [ ] Load the app as user A. It passes the 18+ gate and loads with no errors in
      the console.
- [ ] In the SQL editor: `select count(*) from profiles;` — an anonymous row
      exists for A (or appears after the first write).
- [ ] DevTools → Application → Local Storage shows the supabase auth token.

## 2. Google sign-in (identity upgrade, anonymity preserved)

- [ ] As A, go to **Pod** → **Continue with Google**, complete OAuth.
- [ ] You return signed in; the hub builds; the URL lands on `/pod`.
- [ ] The Google **email is NOT shown** anywhere public — only in Settings
      ("signed in") and the hub account row.
- [ ] SQL: the same `auth.users` id now has a Google identity linked (no new
      duplicate user). `select id, email from auth.users;`
- [ ] Sign out from Settings; you drop back to an anonymous session cleanly.

## 3. Recording upload + private playback

- [ ] As A, record a voice note (Unsent room or Pod). It uploads.
- [ ] SQL: `select id, owner_id, is_public, bucket from audio_files order by
      created_at desc limit 5;` — your row, `is_public = false`,
      `bucket = signal-audio`.
- [ ] Replay it in your own library — it plays (signed URL works for the owner).

## 4. RLS isolation (the important one)

- [ ] As B (second browser), confirm B **cannot** read A's private rows: with
      B's session, a select on `audio_files` returns only B's own + public rows.
- [ ] Storage: B cannot create a signed URL for A's `signal-audio` object
      (owner-scoped policy) — it errors.
- [ ] B cannot update or delete A's rows (RLS `for all` is owner-scoped).

## 5. Group voice — screen-before-public (audio moderation)

- [ ] As A, open **Rooms → a group → drop your voice**, record a short clean
      line ("just saying hi to the room"), add a caption, consent, drop.
- [ ] Button shows **screening…**; on success the clip appears in the list.
- [ ] SQL: that `audio_files` row has `room_id = 'g_<topic>'`,
      `ai_moderation_status = 'passed'`, `is_public = true`.
- [ ] As B, open the same group — B **hears A's clip** (public bucket URL).
- [ ] **Negative test:** as A, drop a clip that says a blocked phrase (e.g. a
      slur or "add me on snapchat"). Result: **rejected** ("didn't pass the
      room's voice screen"); SQL shows `ai_moderation_status = 'flagged'`,
      `is_public = false`, and the storage object is gone.
- [ ] **Fail-closed test:** temporarily remove the STT secret (or test before
      deploying `moderate-audio`). A drop returns "voice screening isn't set up
      yet — your clip stayed private" and never becomes public.

## 6. Realtime

- [ ] With A and B both in the same group, A's newly-cleared clip appears for B
      without a manual refresh (broadcast nudge).
- [ ] Public activity (a save/reaction) surfaces as a live echo chip across
      sessions (`subscribeToEcosphereActivity`).

## 7. Edge functions (if deployed)

- [ ] Help chat (Settings → Help) answers via `help-bot` when deployed (and
      still answers locally when not).
- [ ] Semantic search returns results after the one-time
      `{"action":"seed"}` call (see `docs/SEMANTIC_SEARCH.md`).

## 8. Account deletion

- [ ] As A, Settings → **erase cloud data**. Confirm.
- [ ] SQL: A's rows are gone from `audio_files`, `signals`, `profiles`,
      `saved_signals`, etc.; storage folders under A's id are empty across all
      buckets.
- [ ] Settings → **clear local data** wipes the device; reload returns to the
      18+ gate.

## Pass criteria

Real cross-user voice is safe to enable when **§5 passes in full** — including
the negative and fail-closed tests — and **§4 (RLS isolation)** shows no
cross-user leakage. Until then, keep group voice drops disabled or treat them as
private-only.
