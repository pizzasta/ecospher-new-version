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
