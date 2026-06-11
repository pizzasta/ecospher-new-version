-- Profile Hub: bio + lurker flag on profiles, and the listens graph
-- ("listeners" / "tuned to" — this app does not use follower terminology).
-- Listening history needs no new table: public.replays already records
-- (listener_id, signal_id, created_at) for every playback.

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
