-- Public post-it notes: a note a user releases to drift. Anonymous, short,
-- screened client-side before publish. Reactions accrue via a definer function
-- (no broad UPDATE policy), and the Relics page features the top-reacted few.

create table if not exists public.public_notes (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 120),
  color text,
  day integer not null,
  reactions integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.public_notes enable row level security;

drop policy if exists "public notes are readable" on public.public_notes;
create policy "public notes are readable" on public.public_notes for select using (true);

drop policy if exists "anyone signed in can publish a note" on public.public_notes;
create policy "anyone signed in can publish a note"
  on public.public_notes for insert to authenticated
  with check (char_length(text) between 1 and 120);

create index if not exists public_notes_rank_idx on public.public_notes (reactions desc, created_at desc);

-- reacting bumps the count safely (no arbitrary client UPDATE of reactions)
create or replace function public.react_to_note(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.public_notes set reactions = reactions + 1 where id = p_id;
$$;
grant execute on function public.react_to_note(uuid) to authenticated;
