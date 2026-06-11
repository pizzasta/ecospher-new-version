-- Fade button: signals a user chose to never see again. signal_id is text
-- because feed signals include client-side ids (curated + ghost archive)
-- alongside backend uuids.

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
