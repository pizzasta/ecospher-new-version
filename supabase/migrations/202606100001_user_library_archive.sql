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
