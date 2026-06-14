# Supabase Setup (≈5 minutes)

## 1. Create the project
Go to https://supabase.com/dashboard → **New project** (any name, e.g. `ecosphere`). Wait for it to provision.

## 2. Run the schema
Dashboard → **SQL Editor** → New query → paste the entire contents of
`supabase/setup-all.sql` (all migrations in order) → **Run**.
This creates every table, RLS policy, storage bucket, and seeds demo public signals.

## 3. Enable anonymous sign-in
Dashboard → **Authentication → Sign In / Up → Anonymous sign-ins** → enable.
(The app silently creates anonymous sessions so users never see a login wall.)

## 4. Connect Vercel
Project Settings → **API**: copy the *Project URL* and *anon public* key.
Vercel → your project → **Settings → Environment Variables** (all environments):

```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Then **Redeploy** from the Vercel dashboard.

## 5. Verify
Open the live site → claim a signal → the feed should lead with the seeded
"from the network" signals; recordings in the Unsent Room upload to Storage;
activity appears in the `activity_events` table.

Everything degrades gracefully — without these steps the app keeps running
fully on localStorage/IndexedDB.

## 6. Audio messages + realtime (migration 202606110002)
Run `supabase/migrations/202606110002_audio_message_metadata.sql` (or re-run
`setup-all.sql`, which is idempotent). It adds:

- `audio_files.kind` — classifies uploads as `signal`, `echo`, `capsule`, or
  `drift_note` (room recordings carry `room_id`).
- Realtime replication on `activity_events`, so the app's live-echo chip can
  stream public activity to connected clients without a reload. If you manage
  replication in the dashboard instead, enable **Database → Replication →
  supabase_realtime** for the `activity_events` table.

Upload limits are enforced client-side before any storage call: 2MB max file
size, 3–60 second duration. Failed uploads stay in IndexedDB and retry
automatically when the connection returns.
