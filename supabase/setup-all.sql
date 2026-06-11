create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  signal_core text,
  profile_energy text,
  onboarding_complete boolean not null default false,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    username,
    signal_core,
    profile_energy,
    onboarding_complete
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'signal_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'signal_core',
    new.raw_user_meta_data->>'profile_energy',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create table if not exists public.audio_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  bucket text not null,
  path text not null,
  duration_seconds integer,
  mime_type text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bucket, path)
);

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  audio_file_id uuid references public.audio_files(id) on delete set null,
  type text not null,
  title text not null,
  caption text,
  mood text,
  frequency text,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'unlisted')),
  is_anonymous boolean not null default true,
  is_public boolean generated always as (visibility = 'public') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.replays (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.signals(id) on delete cascade,
  listener_id uuid references public.profiles(id) on delete set null,
  session_id text,
  source_page text,
  created_at timestamptz not null default now()
);

create table if not exists public.relics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rarity text not null check (rarity in ('common', 'rare', 'mythic', 'forbidden')),
  description text not null,
  unlock_condition text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_relics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  relic_id uuid not null references public.relics(id) on delete cascade,
  source_signal_id uuid references public.signals(id) on delete set null,
  unlocked_at timestamptz not null default now(),
  unique(user_id, relic_id)
);

create table if not exists public.soul_pods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null,
  signal_id uuid references public.signals(id) on delete cascade,
  audio_file_id uuid references public.audio_files(id) on delete set null,
  relic_id uuid references public.relics(id) on delete set null,
  note text,
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.archived_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  archive_reason text,
  is_private boolean not null default true,
  archived_at timestamptz not null default now(),
  unique(user_id, signal_id)
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  user_id uuid references public.profiles(id) on delete set null,
  signal_id uuid references public.signals(id) on delete cascade,
  audio_file_id uuid references public.audio_files(id) on delete set null,
  relic_id uuid references public.relics(id) on delete set null,
  metadata jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_audio_files_updated_at before update on public.audio_files for each row execute function public.set_updated_at();
create trigger set_signals_updated_at before update on public.signals for each row execute function public.set_updated_at();
create trigger set_relics_updated_at before update on public.relics for each row execute function public.set_updated_at();
create trigger set_soul_pods_updated_at before update on public.soul_pods for each row execute function public.set_updated_at();

create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists audio_files_owner_idx on public.audio_files(owner_id);
create index if not exists signals_creator_idx on public.signals(creator_id);
create index if not exists signals_visibility_created_idx on public.signals(visibility, created_at desc);
create index if not exists replays_signal_created_idx on public.replays(signal_id, created_at desc);
create index if not exists replays_listener_idx on public.replays(listener_id);
create index if not exists relics_rarity_idx on public.relics(rarity);
create index if not exists user_relics_user_idx on public.user_relics(user_id);
create index if not exists soul_pods_user_created_idx on public.soul_pods(user_id, created_at desc);
create index if not exists archived_signals_user_idx on public.archived_signals(user_id, archived_at desc);
create index if not exists activity_events_public_created_idx on public.activity_events(is_public, created_at desc);
create index if not exists activity_events_user_idx on public.activity_events(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.audio_files enable row level security;
alter table public.signals enable row level security;
alter table public.replays enable row level security;
alter table public.relics enable row level security;
alter table public.user_relics enable row level security;
alter table public.soul_pods enable row level security;
alter table public.archived_signals enable row level security;
alter table public.activity_events enable row level security;

create policy "profiles are readable when public or owned" on public.profiles for select using (is_private = false or id = auth.uid());
create policy "users can insert their own profile" on public.profiles for insert with check (id = auth.uid());
create policy "users can update their own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "public audio files are readable" on public.audio_files for select using (is_public = true or owner_id = auth.uid());
create policy "users can manage their own audio files" on public.audio_files for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "public and owned signals are readable" on public.signals for select using (visibility = 'public' or creator_id = auth.uid());
create policy "users can create their own signals" on public.signals for insert with check (creator_id = auth.uid() or creator_id is null);
create policy "users can update their own signals" on public.signals for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "users can delete their own signals" on public.signals for delete using (creator_id = auth.uid());
create policy "replays are insertable by signed in users" on public.replays for insert with check (listener_id = auth.uid() or listener_id is null);
create policy "signal owners can read replay rows" on public.replays for select using (listener_id = auth.uid() or exists (select 1 from public.signals where signals.id = replays.signal_id and signals.creator_id = auth.uid()));
create policy "public relics are readable" on public.relics for select using (is_public = true);
create policy "users can read their relics" on public.user_relics for select using (user_id = auth.uid());
create policy "users can read their soul pod" on public.soul_pods for select using (user_id = auth.uid());
create policy "users can manage their soul pod" on public.soul_pods for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users can read their archived signals" on public.archived_signals for select using (user_id = auth.uid());
create policy "users can manage their archived signals" on public.archived_signals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "public activity is readable" on public.activity_events for select using (is_public = true or user_id = auth.uid());
create policy "users can create their own activity" on public.activity_events for insert with check (user_id = auth.uid() or user_id is null);


-- ─── Add dedupe_key to replays ──────────────────────────────────────────────
alter table public.replays add column if not exists dedupe_key text;
create unique index if not exists replays_dedupe_key_idx on public.replays(dedupe_key) where dedupe_key is not null;

-- ─── Replay read policy for public signals ───────────────────────────────────
create policy "anyone can read replays for public signals"
  on public.replays for select
  using (
    exists (
      select 1 from public.signals s
      where s.id = signal_id
        and s.visibility = 'public'
    )
  );

-- ─── signal-audio storage bucket ────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('signal-audio', 'signal-audio', false)
  on conflict (id) do nothing;

-- Upload policy: authenticated users can upload to their own path
create policy "authenticated users upload to own path"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'signal-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Download policy: signed URL access (service role or owner)
create policy "owner or service can download signal audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'signal-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete policy: owner can delete their own uploads
create policy "owner can delete own signal audio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'signal-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── audio_files table ───────────────────────────────────────────────────────
create table if not exists public.audio_files (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references public.signals(id) on delete set null,
  uploader_id uuid references public.profiles(id) on delete set null,
  storage_path text not null,
  mime_type text not null default 'audio/webm',
  size_bytes bigint,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

alter table public.audio_files enable row level security;

create policy "uploader can manage own audio files"
  on public.audio_files
  using (uploader_id = auth.uid());

create policy "anyone can read audio files for public signals"
  on public.audio_files for select
  using (
    exists (
      select 1 from public.signals s
      where s.id = signal_id
        and s.visibility = 'public'
    )
  );
alter table public.signals
add column if not exists ai_moderation_status text not null default 'not_checked'
check (ai_moderation_status in ('not_checked', 'passed', 'flagged'));

alter table public.signals
add column if not exists ai_moderation_flags text[] not null default '{}'::text[];

alter table public.signals
add column if not exists ai_moderation_checked_at timestamptz;

create index if not exists signals_ai_moderation_status_idx
on public.signals(ai_moderation_status, created_at desc);
-- ─── User library, capsules, saved signals, archive, relic favorites ────────
-- Persists the dashboard/library features that currently live in localStorage.

-- ─── Capsules ────────────────────────────────────────────────────────────────
create table if not exists public.capsules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  audio_path text,
  text_note text,
  emotional_tag text,
  status text not null default 'new' check (status in ('saved', 'archived', 'private', 'new')),
  unlock_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_capsules_updated_at before update on public.capsules
for each row execute function public.set_updated_at();

create index if not exists capsules_user_created_idx on public.capsules(user_id, created_at desc);

alter table public.capsules enable row level security;

create policy "users can read their own capsules"
  on public.capsules for select using (user_id = auth.uid());
create policy "users can manage their own capsules"
  on public.capsules for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Saved signals (user library) ────────────────────────────────────────────
create table if not exists public.saved_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  note text,
  saved_at timestamptz not null default now(),
  unique(user_id, signal_id)
);

create index if not exists saved_signals_user_saved_idx on public.saved_signals(user_id, saved_at desc);

alter table public.saved_signals enable row level security;

create policy "users can read their saved signals"
  on public.saved_signals for select using (user_id = auth.uid());
create policy "users can manage their saved signals"
  on public.saved_signals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Audio library metadata ──────────────────────────────────────────────────
alter table public.audio_files add column if not exists title text;
alter table public.audio_files add column if not exists is_archived boolean not null default false;

create index if not exists audio_files_owner_archived_idx
  on public.audio_files(owner_id, is_archived, created_at desc);

-- ─── Relic ownership extras ──────────────────────────────────────────────────
alter table public.user_relics add column if not exists is_favorite boolean not null default false;
alter table public.user_relics add column if not exists discovery_source text;

create policy "users can unlock their own relics"
  on public.user_relics for insert with check (user_id = auth.uid());
create policy "users can update their own relics"
  on public.user_relics for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Generalized archive ─────────────────────────────────────────────────────
create table if not exists public.archive_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('signal', 'audio', 'capsule', 'relic')),
  item_id uuid not null,
  note text,
  archived_at timestamptz not null default now(),
  unique(user_id, item_type, item_id)
);

create index if not exists archive_items_user_archived_idx on public.archive_items(user_id, archived_at desc);

alter table public.archive_items enable row level security;

create policy "users can read their archive"
  on public.archive_items for select using (user_id = auth.uid());
create policy "users can manage their archive"
  on public.archive_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Activity events: capsule linkage ────────────────────────────────────────
alter table public.activity_events add column if not exists capsule_id uuid references public.capsules(id) on delete set null;

-- ─── Storage buckets ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('capsule-audio', 'capsule-audio', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('profile-cores', 'profile-cores', false)
  on conflict (id) do nothing;

create policy "users upload capsule audio to own path"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'capsule-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read own capsule audio"
  on storage.objects for select to authenticated
  using (bucket_id = 'capsule-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own capsule audio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'capsule-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users upload profile cores to own path"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-cores' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read own profile cores"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-cores' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own profile cores"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-cores' and (storage.foldername(name))[1] = auth.uid()::text);
-- Seed demo public signals so a freshly configured project has live content.
-- Idempotent: skips rows that already exist by title.

insert into public.signals (type, title, caption, mood, visibility, is_anonymous)
select v.type, v.title, v.caption, v.mood, 'public', true
from (values
  ('voice_note', 'still awake', 'still awake. the quiet feels different tonight.', 'nocturne'),
  ('voice_note', 'replaying that moment', 'replaying that moment again. i keep landing in the same second.', 'drift'),
  ('voice_note', 'the only honest hour', 'something about 3am feels like the only honest hour.', 'drift'),
  ('voice_note', 'too quiet in here', 'first night in the new apartment. too quiet.', 'lost'),
  ('voice_note', 'good things out loud', 'something good happened today. saying it out loud.', 'bloom'),
  ('voice_note', 'old hoodie', 'still wearing their hoodie. it stopped smelling like them.', 'nocturne')
) as v(type, title, caption, mood)
where not exists (
  select 1 from public.signals s where s.title = v.title
);
