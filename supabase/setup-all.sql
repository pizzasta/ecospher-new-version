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

-- ─── Audio message metadata (migration 202606110002) ────────────────────────
alter table public.audio_files
  add column if not exists kind text not null default 'signal',
  add column if not exists room_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audio_files_kind_check'
  ) then
    alter table public.audio_files
      add constraint audio_files_kind_check
      check (kind in ('signal', 'echo', 'capsule', 'drift_note'));
  end if;
end $$;

create index if not exists audio_files_kind_idx on public.audio_files (kind);
create index if not exists audio_files_room_idx on public.audio_files (room_id) where room_id is not null;

-- Realtime: stream public activity inserts to connected clients
do $$
begin
  alter publication supabase_realtime add table public.activity_events;
exception
  when duplicate_object then null;
end $$;

-- ─── Security hardening (migration 202606110003) ────────────────────────────
-- Restrict insert policies to the authenticated role; the public anon key
-- alone (no session) can no longer write.

drop policy if exists "users can create their own signals" on public.signals;
create policy "users can create their own signals" on public.signals
  for insert to authenticated
  with check (creator_id = auth.uid() or creator_id is null);

drop policy if exists "replays are insertable by signed in users" on public.replays;
create policy "replays are insertable by signed in users" on public.replays
  for insert to authenticated
  with check (listener_id = auth.uid() or listener_id is null);

drop policy if exists "users can create their own activity" on public.activity_events;
create policy "users can create their own activity" on public.activity_events
  for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- ─── Account deletion policies (migration 202606110004) ─────────────────────
drop policy if exists "users can delete their own activity" on public.activity_events;
create policy "users can delete their own activity" on public.activity_events
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "users can delete their own replays" on public.replays;
create policy "users can delete their own replays" on public.replays
  for delete to authenticated
  using (listener_id = auth.uid());

drop policy if exists "users can delete their own profile" on public.profiles;
create policy "users can delete their own profile" on public.profiles
  for delete to authenticated
  using (id = auth.uid());

drop policy if exists "users can manage their relics" on public.user_relics;
create policy "users can manage their relics" on public.user_relics
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── Faded signals (migration 202606110005) ─────────────────────────────────
create table if not exists public.faded_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  signal_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, signal_id)
);

alter table public.faded_signals enable row level security;

drop policy if exists "users manage their own faded signals" on public.faded_signals;
create policy "users manage their own faded signals" on public.faded_signals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists faded_signals_user_idx on public.faded_signals (user_id);

-- ─── Profile hub (migration 202606110006) ───────────────────────────────────
alter table public.profiles
  add column if not exists bio text,
  add column if not exists lurker_mode boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_length') then
    alter table public.profiles
      add constraint profiles_bio_length check (bio is null or char_length(bio) <= 200);
  end if;
end $$;

create table if not exists public.listens (
  listener_id uuid not null references public.profiles(id) on delete cascade,
  tuned_to_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listener_id, tuned_to_id),
  check (listener_id <> tuned_to_id)
);

alter table public.listens enable row level security;

drop policy if exists "users manage who they are tuned to" on public.listens;
create policy "users manage who they are tuned to" on public.listens
  for all to authenticated
  using (listener_id = auth.uid())
  with check (listener_id = auth.uid());

drop policy if exists "users can see their own listeners" on public.listens;
create policy "users can see their own listeners" on public.listens
  for select to authenticated
  using (tuned_to_id = auth.uid());

create index if not exists listens_tuned_to_idx on public.listens (tuned_to_id);

-- ─── Notifications (migration 202606110007) ─────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('new_reaction', 'new_listener', 'new_listener_follow', 'new_capsule', 'phantom_interaction')),
  actor_id uuid references public.profiles(id) on delete set null,
  signal_id uuid references public.signals(id) on delete cascade,
  capsule_id uuid references public.capsules(id) on delete cascade,
  metadata jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "recipients read their notifications" on public.notifications;
create policy "recipients read their notifications" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "recipients update read state" on public.notifications;
create policy "recipients update read state" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "recipients delete their notifications" on public.notifications;
create policy "recipients delete their notifications" on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- realtime: stream new notifications to the signed-in recipient
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

-- ─── push subscriptions (opt-in web push) ────────────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "users manage their push subscriptions" on public.push_subscriptions;
create policy "users manage their push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── triggers: notifications are created where the events happen ─────────────
-- (Alternative: create them client/API-side next to each action. Triggers
-- were chosen so the phantom job and any future writer get them for free.)

create or replace function public.notify_on_replay()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
begin
  select creator_id into owner from public.signals where id = new.signal_id;
  if owner is not null and owner is distinct from new.listener_id then
    insert into public.notifications (user_id, type, actor_id, signal_id)
    values (owner, 'new_listener', new.listener_id, new.signal_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_on_replay on public.replays;
create trigger trg_notify_on_replay
  after insert on public.replays
  for each row execute function public.notify_on_replay();

create or replace function public.notify_on_listen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, actor_id)
  values (new.tuned_to_id, 'new_listener_follow', new.listener_id);
  return new;
end $$;

drop trigger if exists trg_notify_on_listen on public.listens;
create trigger trg_notify_on_listen
  after insert on public.listens
  for each row execute function public.notify_on_listen();

create or replace function public.notify_on_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  phantom boolean;
begin
  if new.type <> 'voice_reaction' or new.signal_id is null then
    return new;
  end if;
  select creator_id into owner from public.signals where id = new.signal_id;
  if owner is null or owner = new.user_id then
    return new;
  end if;
  select coalesce((u.raw_user_meta_data ->> 'phantom')::boolean, false) into phantom
    from auth.users u where u.id = new.user_id;
  insert into public.notifications (user_id, type, actor_id, signal_id, metadata)
  values (owner, case when phantom then 'phantom_interaction' else 'new_reaction' end, new.user_id, new.signal_id, new.metadata);
  return new;
end $$;

drop trigger if exists trg_notify_on_reaction on public.activity_events;
create trigger trg_notify_on_reaction
  after insert on public.activity_events
  for each row execute function public.notify_on_reaction();

-- ─── Hz signature (migration 202606110008) ──────────────────────────────────
alter table public.profiles
  add column if not exists hz_signature numeric(5,2) default (20 + random() * 180),
  add column if not exists hz_display_name text,
  add column if not exists hz_color text default '#66ccff';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_hz_display_name_check') then
    alter table public.profiles
      add constraint profiles_hz_display_name_check
      check (hz_display_name is null or hz_display_name ~ '^[a-zA-Z0-9 ]{1,20}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_hz_color_check') then
    alter table public.profiles
      add constraint profiles_hz_color_check
      check (hz_color ~ '^#[0-9a-fA-F]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_hz_signature_range') then
    alter table public.profiles
      add constraint profiles_hz_signature_range
      check (hz_signature is null or (hz_signature >= 20 and hz_signature <= 200));
  end if;
end $$;

-- ─── Frequency gradient (migration 202606110009) ────────────────────────────
alter table public.profiles
  add column if not exists gradient_settings jsonb
  default '{"locked": false, "color_start": null, "color_end": null, "angle": null, "speed": 60}';

-- ─── Server-side guardian (migration 202606110010) ──────────────────────────
-- mirrors src/lib/signalModeration.ts — keep the two rule sets in sync
create or replace function public.moderate_signal_text(content text)
returns text[]
language plpgsql immutable as $$
declare
  normalized text := lower(coalesce(content, ''));
  flags text[] := '{}';
begin
  if normalized ~ '\m(kill|hurt|attack|stab|shoot|bomb|threat)\M' then
    flags := array_append(flags, 'threats');
  end if;
  if normalized ~ '\m(hate you|idiot|stupid|worthless|trash|loser)\M' then
    flags := array_append(flags, 'harassment');
  end if;
  if content ~ '\d{3}[-.\s]?\d{3}[-.\s]?\d{4}'
     or content ~* '[\w.-]+@[\w.-]+\.\w{2,}'
     or content ~* '\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\M' then
    flags := array_append(flags, 'explicit_personal_information');
  end if;
  if content ~* '(https?://|www\.|free money|promo code|buy now|subscribe now)' then
    flags := array_append(flags, 'spam');
  end if;
  if normalized ~ '\m(self harm|suicide|overdose|exploit|blackmail)\M' then
    flags := array_append(flags, 'unsafe_content');
  end if;
  return flags;
end $$;

create or replace function public.guard_public_signal()
returns trigger language plpgsql as $$
declare
  flags text[];
begin
  flags := public.moderate_signal_text(coalesce(new.title, '') || ' ' || coalesce(new.caption, ''));
  new.ai_moderation_flags := flags;
  new.ai_moderation_checked_at := now();
  if array_length(flags, 1) > 0 then
    new.ai_moderation_status := 'flagged';
    -- flagged content can exist, but never publicly
    if new.visibility = 'public' then
      new.visibility := 'private';
    end if;
  else
    new.ai_moderation_status := 'passed';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_public_signal on public.signals;
create trigger trg_guard_public_signal
  before insert or update of title, caption, visibility on public.signals
  for each row execute function public.guard_public_signal();

-- ─── bot pressure valves: per-user hourly insert caps ────────────────────────

create index if not exists signals_creator_created_idx
  on public.signals (creator_id, created_at desc);
create index if not exists audio_files_owner_created_idx
  on public.audio_files (owner_id, created_at desc);

create or replace function public.enforce_signal_rate_limit()
returns trigger language plpgsql as $$
begin
  if new.creator_id is not null and (
    select count(*) from public.signals
    where creator_id = new.creator_id and created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'rate limit: too many signals this hour';
  end if;
  return new;
end $$;

drop trigger if exists trg_signal_rate_limit on public.signals;
create trigger trg_signal_rate_limit
  before insert on public.signals
  for each row execute function public.enforce_signal_rate_limit();

create or replace function public.enforce_audio_rate_limit()
returns trigger language plpgsql as $$
begin
  if new.owner_id is not null and (
    select count(*) from public.audio_files
    where owner_id = new.owner_id and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'rate limit: too many uploads this hour';
  end if;
  return new;
end $$;

drop trigger if exists trg_audio_rate_limit on public.audio_files;
create trigger trg_audio_rate_limit
  before insert on public.audio_files
  for each row execute function public.enforce_audio_rate_limit();

-- ─── Child safety screening (migration 202606110011) ────────────────────────
create or replace function public.moderate_signal_text(content text)
returns text[]
language plpgsql immutable as $$
declare
  normalized text := lower(coalesce(content, ''));
  flags text[] := '{}';
begin
  if normalized ~ '\m(kill|hurt|attack|stab|shoot|bomb|threat)\M' then
    flags := array_append(flags, 'threats');
  end if;
  if normalized ~ '\m(hate you|idiot|stupid|worthless|trash|loser)\M' then
    flags := array_append(flags, 'harassment');
  end if;
  if content ~ '\d{3}[-.\s]?\d{3}[-.\s]?\d{4}'
     or content ~* '[\w.-]+@[\w.-]+\.\w{2,}'
     or content ~* '\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\M' then
    flags := array_append(flags, 'explicit_personal_information');
  end if;
  if content ~* '(https?://|www\.|free money|promo code|buy now|subscribe now)' then
    flags := array_append(flags, 'spam');
  end if;
  if normalized ~ '\m(self harm|suicide|overdose|exploit|blackmail)\M' then
    flags := array_append(flags, 'unsafe_content');
  end if;
  if normalized ~ '\m(how old are you|whats your age|what''s your age|asl)\M'
     or normalized ~ 'are you a (girl|boy)'
     or (normalized ~ '\m(add me on|dm me|message me on|find me on)\M' and normalized ~ '\m(snap|snapchat|kik|insta|instagram|whatsapp|telegram|discord)\M')
     or (normalized ~ '\m(snap|snapchat|kik|whatsapp|telegram)\M' and normalized ~ '\m(me|you)\M')
     or normalized ~ '\m(send|show) (me )?(a |your )?(pic|pics|picture|photo|photos|selfie)'
     or normalized ~ '\m(meet (up|me)|where do you live|what school)\M'
     or normalized ~ '\m(im|i m|i am) (1[0-7]|a minor)\M' then
    flags := array_append(flags, 'child_safety');
  end if;
  return flags;
end $$;

-- ─── Sexual content screening (migration 202606110012) ──────────────────────
create or replace function public.moderate_signal_text(content text)
returns text[]
language plpgsql immutable as $$
declare
  normalized text := lower(coalesce(content, ''));
  flags text[] := '{}';
begin
  if normalized ~ '\m(kill|hurt|attack|stab|shoot|bomb|threat)\M' then
    flags := array_append(flags, 'threats');
  end if;
  if normalized ~ '\m(hate you|idiot|stupid|worthless|trash|loser)\M' then
    flags := array_append(flags, 'harassment');
  end if;
  if content ~ '\d{3}[-.\s]?\d{3}[-.\s]?\d{4}'
     or content ~* '[\w.-]+@[\w.-]+\.\w{2,}'
     or content ~* '\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\M' then
    flags := array_append(flags, 'explicit_personal_information');
  end if;
  if content ~* '(https?://|www\.|free money|promo code|buy now|subscribe now)' then
    flags := array_append(flags, 'spam');
  end if;
  if normalized ~ '\m(self harm|suicide|overdose|exploit|blackmail)\M' then
    flags := array_append(flags, 'unsafe_content');
  end if;
  if normalized ~ '\m(nudes?|sexting|sext|horny|dick pic)\M'
     or normalized ~ '\m(nude|naked) (pic|pics|photo|photos)\M'
     or normalized ~ '\m(blow ?job|hand ?job|jerk(ing)? off|cumming|tits|pussy|cock)\M'
     or normalized ~ '\mcum\M'
     or normalized ~ 'send (me )?something (sexy|hot)'
     or normalized ~ '\m(wanna sext|fuck me|fuck you tonight)\M'
     or normalized ~ '\m(onlyfans|check (out )?my of)\M' then
    flags := array_append(flags, 'sexual_content');
  end if;
  if normalized ~ '\m(how old are you|whats your age|what''s your age|asl)\M'
     or normalized ~ 'are you a (girl|boy)'
     or (normalized ~ '\m(add me on|dm me|message me on|find me on)\M' and normalized ~ '\m(snap|snapchat|kik|insta|instagram|whatsapp|telegram|discord)\M')
     or (normalized ~ '\m(snap|snapchat|kik|whatsapp|telegram)\M' and normalized ~ '\m(me|you)\M')
     or normalized ~ '\m(send|show) (me )?(a |your )?(pic|pics|picture|photo|photos|selfie)'
     or normalized ~ '\m(meet (up|me)|where do you live|what school)\M'
     or normalized ~ '\m(im|i m|i am) (1[0-7]|a minor)\M' then
    flags := array_append(flags, 'child_safety');
  end if;
  return flags;
end $$;
-- Semantic emotional search: pgvector + a small curated corpus that the
-- semantic-search Edge Function embeds with Supabase's built-in gte-small
-- model (384 dimensions, no external API key needed).

create extension if not exists vector;

create table if not exists public.semantic_entries (
  id text primary key,
  title text not null,
  sub text not null default '',
  page text not null,
  kind text not null default 'voice',
  seed int not null default 1,
  content text not null,
  embedding vector(384),
  updated_at timestamptz not null default now()
);

-- everyone can read the corpus; only the service role (the Edge Function)
-- can write it
alter table public.semantic_entries enable row level security;

drop policy if exists "semantic entries are readable" on public.semantic_entries;
create policy "semantic entries are readable"
  on public.semantic_entries for select
  to anon, authenticated
  using (true);

create index if not exists semantic_entries_embedding_idx
  on public.semantic_entries
  using hnsw (embedding vector_cosine_ops);

-- nearest-neighbour match by cosine similarity
create or replace function public.match_semantic_entries(
  query_embedding vector(384),
  match_count int default 6,
  min_similarity float default 0.55
)
returns table (
  id text,
  title text,
  sub text,
  page text,
  kind text,
  seed int,
  similarity float
)
language sql stable
as $$
  select
    e.id, e.title, e.sub, e.page, e.kind, e.seed,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.semantic_entries e
  where e.embedding is not null
    and 1 - (e.embedding <=> query_embedding) >= min_similarity
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
-- Signal decay fields: replay heat cools over time; long-cold public
-- signals fade. Written only by the signal-decay Edge Function
-- (service role); clients read them like any other signal column.

alter table public.signals add column if not exists heat double precision not null default 1;
alter table public.signals add column if not exists faded_at timestamptz;

create index if not exists signals_decay_idx
  on public.signals (visibility, faded_at, updated_at)
  where faded_at is null;
-- Audio lifecycle: soft-delete marker for cleanup of failed/abandoned
-- uploads. (file_size_bytes, kind/upload type, is_archived, owner_id,
-- duration_seconds, path, created_at, is_public already exist.)

alter table public.audio_files add column if not exists deleted_at timestamptz;

create index if not exists audio_files_usage_idx
  on public.audio_files (owner_id, created_at desc)
  where deleted_at is null;


-- ═══ 202606130016_group_rooms.sql ═══
-- Group rooms: real anonymous voices dropped into a topic, heard by anyone in
-- that group. Unlike private signal audio (owner-only storage), these clips are
-- deliberately shared, so they live in a PUBLIC bucket — readable by everyone,
-- but still only insertable/deletable inside the uploader's own folder so no
-- one can write or remove on someone else's behalf.
--
-- The clips themselves are ordinary public audio_files rows (is_public = true,
-- room_id = 'g_<topic>', bucket = 'group-audio', title = the screened line that
-- accompanies every drop). The existing "public audio files are readable"
-- policy already lets anyone read those rows; this migration only adds the
-- storage bucket + its policies.

insert into storage.buckets (id, name, public)
  values ('group-audio', 'group-audio', true)
  on conflict (id) do nothing;

drop policy if exists "group audio is publicly readable" on storage.objects;
create policy "group audio is publicly readable"
  on storage.objects for select
  using (bucket_id = 'group-audio');

drop policy if exists "users upload group audio in their own folder" on storage.objects;
create policy "users upload group audio in their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'group-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete their own group audio" on storage.objects;
create policy "users delete their own group audio"
  on storage.objects for delete
  using (
    bucket_id = 'group-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- room_id is already indexed (202606110002); group clips reuse it as 'g_<topic>'.


-- ═══ 202606130017_audio_moderation.sql ═══
-- Audio moderation metadata for group voice clips. Group drops now upload
-- PRIVATE (is_public = false) and are only promoted to public by the
-- moderate-audio Edge Function after speech-to-text + screening passes — so a
-- clip is never heard by others until it has been screened. These columns
-- record the verdict; the function writes them with the service role.

alter table public.audio_files
  add column if not exists ai_moderation_status text not null default 'not_checked'
  check (ai_moderation_status in ('not_checked', 'passed', 'flagged'));

alter table public.audio_files
  add column if not exists ai_moderation_flags text[] not null default '{}'::text[];

alter table public.audio_files
  add column if not exists ai_moderation_checked_at timestamptz;

create index if not exists audio_files_moderation_idx
  on public.audio_files (ai_moderation_status, created_at desc);


-- ═══ 202606130018_sea_lines.sql ═══
-- Cast a Line: tiny public text lines that drift in the Frequency Sea. They're
-- anonymous (no user id), ephemeral (kept by day), and screened client-side
-- before insert. Realtime fan-out lets a cast reach everyone drifting right now.

create table if not exists public.sea_lines (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 90),
  day integer not null,
  created_at timestamptz not null default now()
);

alter table public.sea_lines enable row level security;

drop policy if exists "sea lines are readable" on public.sea_lines;
create policy "sea lines are readable" on public.sea_lines for select using (true);

-- any signed-in session (anonymous sessions included) may cast a short line
drop policy if exists "anyone signed in can cast a line" on public.sea_lines;
create policy "anyone signed in can cast a line"
  on public.sea_lines for insert to authenticated
  with check (char_length(text) between 1 and 90);

create index if not exists sea_lines_day_idx on public.sea_lines (day, created_at desc);

-- broadcast inserts over Realtime (idempotent)
do $$
begin
  alter publication supabase_realtime add table public.sea_lines;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
