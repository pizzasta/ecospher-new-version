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
