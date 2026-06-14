# Ecosphere Backend Implementation Plan

Ecosphere is a cinematic emotional audio-social app. The backend should support real people, real audio, replayed memories, anonymous signals, Soul Pod archives, relic unlocks, and realtime ambient activity without turning the app into a corporate dashboard.

This plan is backend-only. Do not change the frontend experience until the backend foundation is ready.

## Recommended Backend

Use Supabase first.

Supabase is the best fit because it gives Ecosphere:

- Auth for user accounts and signal identities
- Postgres for relational app data
- Storage for audio files
- Realtime for replay activity, rooms, and transmissions
- Edge Functions for protected logic such as relic unlocks
- Row-level security for private Soul Pod and capsule data

Firebase is also strong, but Ecosphere has relational concepts such as signals, replay counts, relic ownership, archives, rooms, and user-linked memories. Supabase/Postgres should stay cleaner.

Vercel Blob can be useful later for audio storage, but it should not be the core backend by itself because the app also needs auth, database rules, realtime, and backend logic.

## Current Frontend State

The app currently uses:

- Local mock data in `src/App.tsx`
- `localStorage` for onboarding/profile prototype data
- Browser-generated Web Audio previews for feed and room sounds
- Web Speech API for the cassette voice prototype
- Mock relics, capsules, rooms, alerts, replay counts, and Soul Pod items

The next backend phase should replace mock data gradually instead of rewriting the whole app at once.

## Core Backend Features

### 1. User Accounts

Support:

- email/password or magic link sign-in
- guest identity later if desired
- profile creation after onboarding
- saved signal identity
- private account state

### 2. Signal Identity

Persist:

- username / signal name
- signal core visual
- profile energy
- onboarding completion
- created date
- optional bio later, but keep the app identity non-social-media-like

### 3. Audio Uploads

Support:

- voice signal uploads
- capsule uploads
- private and public audio files
- signed URLs for playback
- duration metadata
- waveform metadata later

### 4. Audio Feed

Support:

- public signals
- anonymous or named signals
- emotional tags
- frequency/mood
- audio URL
- replay counts
- created timestamp
- visibility rules

### 5. Replay Counts

Track:

- signal id
- listener id if known
- anonymous session id if not signed in
- replay timestamp
- source page

Replay counts should update the feed and transmissions center.

### 6. Relic Unlocks

Support:

- relic definitions
- rarity
- unlock condition
- user-owned relics
- unlock timestamp
- source signal/capsule/event

Relic unlock checks should move to backend logic so the client cannot fake unlocks.

### 7. Soul Pod Data

Support private user-owned:

- saved echoes
- saved relics
- capsules
- notes
- archived signals
- emotional fragments

Soul Pod should default private.

### 8. Archived Signals

Support:

- archived public/private signals
- saved capsules
- hidden memories
- deleted-but-preserved states later if needed

### 9. Realtime Activity

Support realtime updates for:

- new feed signals
- replay count changes
- listening room presence
- relic unlocks
- capsule opened events
- transmissions / notifications

Do not make every animation realtime. Only meaningful emotional/social events should come from the backend.

## Suggested Database Tables

### `profiles`

- `id` uuid primary key, references auth user
- `username` text unique
- `signal_core` text
- `profile_energy` text
- `onboarding_complete` boolean
- `created_at` timestamp
- `updated_at` timestamp

### `signals`

- `id` uuid primary key
- `creator_id` uuid nullable references profiles
- `type` text
- `title` text
- `caption` text
- `audio_path` text nullable
- `duration_seconds` integer nullable
- `mood` text
- `frequency` text nullable
- `visibility` text: public, private, unlisted
- `is_anonymous` boolean
- `created_at` timestamp

### `signal_replays`

- `id` uuid primary key
- `signal_id` uuid references signals
- `listener_id` uuid nullable references profiles
- `session_id` text nullable
- `source_page` text
- `replayed_at` timestamp

### `capsules`

- `id` uuid primary key
- `user_id` uuid references profiles
- `title` text
- `audio_path` text nullable
- `text_note` text nullable
- `emotional_tag` text
- `status` text: saved, archived, private, new
- `created_at` timestamp

### `relics`

- `id` uuid primary key
- `name` text
- `rarity` text: common, rare, mythic, forbidden
- `description` text
- `unlock_condition` text
- `created_at` timestamp

### `user_relics`

- `id` uuid primary key
- `user_id` uuid references profiles
- `relic_id` uuid references relics
- `source_signal_id` uuid nullable references signals
- `unlocked_at` timestamp

### `soul_pod_items`

- `id` uuid primary key
- `user_id` uuid references profiles
- `item_type` text
- `signal_id` uuid nullable references signals
- `capsule_id` uuid nullable references capsules
- `relic_id` uuid nullable references relics
- `note` text nullable
- `saved_at` timestamp

### `rooms`

- `id` uuid primary key
- `name` text
- `mood` text
- `frequency` text
- `status` text
- `created_at` timestamp

### `room_presence`

- `id` uuid primary key
- `room_id` uuid references rooms
- `user_id` uuid references profiles
- `joined_at` timestamp
- `last_active_at` timestamp

### `activity_events`

- `id` uuid primary key
- `type` text
- `user_id` uuid nullable references profiles
- `signal_id` uuid nullable references signals
- `capsule_id` uuid nullable references capsules
- `relic_id` uuid nullable references relics
- `room_id` uuid nullable references rooms
- `metadata` jsonb
- `created_at` timestamp

## Storage Buckets

Create Supabase Storage buckets:

- `signal-audio`
- `capsule-audio`
- `profile-cores`
- optional later: `waveform-previews`

Keep audio buckets private at first. Use signed URLs for playback.

## Security Rules

Use Supabase Row Level Security.

Important rules:

- Users can read their own private Soul Pod data.
- Users can read public signals.
- Users can read their own private/unlisted signals.
- Users can only insert/update/delete their own capsules.
- Users can only insert replay events as themselves or anonymous session events.
- Relic unlock writes should be protected through backend logic.
- Audio files should use signed URLs unless intentionally public.

## Backend Flow: Onboarding

1. User signs in or starts as a guest identity.
2. User chooses signal name, profile energy, and signal core.
3. Save profile to `profiles`.
4. Set `onboarding_complete = true`.
5. Redirect to Observatory / Identity Chamber.

## Backend Flow: Create Signal

1. User writes caption or records/uploads audio.
2. Audio uploads to private storage bucket.
3. Create `signals` row with metadata.
4. Create `activity_events` row.
5. Realtime pushes new signal to feed where allowed.

## Backend Flow: Replay Signal

1. User presses play.
2. Client creates `signal_replays` row.
3. Replay count updates from database count or materialized counter.
4. Realtime emits activity event.
5. Optional relic unlock check runs.

## Backend Flow: Relic Unlock

1. Signal/capsule/replay event occurs.
2. Edge Function checks unlock conditions.
3. If condition is met, insert `user_relics`.
4. Insert `activity_events` row.
5. Realtime updates Relics and Transmissions.

## Backend Flow: Soul Pod Save

1. User saves echo, capsule, relic, or note.
2. Insert `soul_pod_items` row.
3. Item remains private by default.
4. Soul Pod page loads user-owned items only.

## Implementation Phases

### Phase 1: Backend Foundation

- Create Supabase project
- Add environment variables
- Add Supabase client
- Add database migrations
- Create storage buckets
- Enable RLS
- Add basic policies

### Phase 2: Identity

- Replace `localStorage` onboarding with Supabase profile save/load
- Keep the cinematic onboarding UI
- Add reset/dev escape only for local testing

### Phase 3: Signals Feed

- Move feed mock data to `signals`
- Add real replay rows
- Add replay count display
- Keep current card design

### Phase 4: Audio Uploads

- Add real upload for voice signals and capsules
- Store audio in Supabase Storage
- Use signed URLs for playback
- Keep browser-generated previews only as fallback

### Phase 5: Soul Pod

- Load saved user capsules, relics, echoes, and notes
- Add save-to-Soul-Pod action
- Keep data private by default

### Phase 6: Relics

- Add `relics` and `user_relics`
- Add backend unlock checks
- Add realtime unlock transmissions

### Phase 7: Realtime

- Feed activity
- Replay counts
- Room presence
- Transmissions
- Relic unlocks

### Phase 8: Safety and Scale

- Abuse reporting
- Upload limits
- Audio moderation queue
- Rate limits for replay events
- Signed URL expiration
- Backups and audit logs

## Frontend Migration Principle

Do not rewrite the app.

Replace mock data one area at a time:

1. identity
2. feed signals
3. replay events
4. capsules
5. Soul Pod
6. relics
7. rooms/realtime

Preserve the current visual identity: black/navy, hot pink glow, cyan accents, violet gradients, sparse cinematic layouts, floating particles, glassmorphism, oversized typography, and intimate emotional copy.

## First Code Step Later

When backend implementation begins, start with:

1. Install Supabase client
2. Create `src/lib/supabase.ts`
3. Add environment variables
4. Create database schema migration
5. Convert onboarding profile save/load

Do not begin with audio uploads. Identity and data ownership should come first.
