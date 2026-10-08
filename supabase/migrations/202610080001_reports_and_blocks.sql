-- Launch readiness: reports that reach a reviewer, and per-user blocking.
--
-- content_reports: any signed-in (incl. anonymous) user can file a report.
--   Nobody can read, change or delete reports from the client — review them
--   in the Supabase dashboard (Table Editor → content_reports) or with the
--   service role. One report per user per signal.
--
-- user_blocks: "block this voice" hides every public signal from that author
--   for the blocker. The author's id never reaches the client: the block is
--   created server-side from the signal id, and the table has no client read
--   policy, so blocking does not de-anonymize anyone.

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  signal_id uuid not null references public.signals(id) on delete cascade,
  reason text not null check (reason in ('harassment', 'spam', 'unsafe content', 'sexual content', 'child safety', 'other')),
  auto_flags text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, signal_id)
);

create index if not exists content_reports_open_idx on public.content_reports(status, created_at desc);

alter table public.content_reports enable row level security;

drop policy if exists "users can file reports" on public.content_reports;
create policy "users can file reports" on public.content_reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;
-- intentionally no client policies: reads/writes go through the functions below

create or replace function public.block_signal_author(p_signal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select creator_id into v_owner from public.signals where id = p_signal_id;
  if v_owner is null or v_owner = auth.uid() then
    return;
  end if;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (auth.uid(), v_owner)
  on conflict do nothing;
end;
$$;

create or replace function public.unblock_all()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.user_blocks where blocker_id = auth.uid();
$$;

create or replace function public.is_blocked_by_me(p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where blocker_id = auth.uid() and blocked_id = p_author
  );
$$;

revoke all on function public.block_signal_author(uuid) from public;
revoke all on function public.unblock_all() from public;
revoke all on function public.is_blocked_by_me(uuid) from public;
grant execute on function public.block_signal_author(uuid) to authenticated;
grant execute on function public.unblock_all() to authenticated;
grant execute on function public.is_blocked_by_me(uuid) to authenticated, anon;

-- hide blocked authors' signals from the blocker (restrictive = ANDed with the
-- existing "public and owned signals are readable" policy)
drop policy if exists "hide signals from blocked authors" on public.signals;
create policy "hide signals from blocked authors" on public.signals
  as restrictive for select
  using (creator_id is null or not public.is_blocked_by_me(creator_id));
