-- Transmissions: messaging with no addressing. A transmission is sent into a
-- BAND (a feeling), never at a person; routing is by band only. Root rows
-- (reply_to null) are "open" — anyone on that band may echo one, which inserts
-- a reply row pointing back via reply_to. Anonymous like sea_lines/public_notes:
-- the author marker is private (SELECT revoked) and used only for the shared
-- moderation + rate-limit guards.

create table if not exists public.transmissions (
  id uuid primary key default gen_random_uuid(),
  band text not null,
  text text not null default '' check (char_length(text) <= 200),
  audio_file_id uuid references public.audio_files(id) on delete set null,
  reply_to uuid references public.transmissions(id) on delete cascade,
  author uuid,
  created_at timestamptz not null default now()
);

alter table public.transmissions enable row level security;

drop policy if exists "transmissions are readable" on public.transmissions;
create policy "transmissions are readable" on public.transmissions for select using (true);

drop policy if exists "anyone signed in can transmit" on public.transmissions;
create policy "anyone signed in can transmit"
  on public.transmissions for insert to authenticated
  with check (char_length(text) <= 200);

-- author marker is for rate-limiting only and must never reach clients
revoke select (author) on public.transmissions from anon, authenticated;

create index if not exists transmissions_open_idx on public.transmissions (band, created_at desc) where reply_to is null;
create index if not exists transmissions_reply_idx on public.transmissions (reply_to, created_at desc);
create index if not exists transmissions_author_idx on public.transmissions (author, created_at desc);

-- reuse the shared, table-agnostic guards (defined in 202606140020/021):
--   guard_public_text()              → rejects flagged text on insert/update
--   enforce_public_text_rate_limit() → stamps author = auth.uid(), 15/hour cap
drop trigger if exists trg_guard_transmission on public.transmissions;
create trigger trg_guard_transmission
  before insert or update of text on public.transmissions
  for each row execute function public.guard_public_text();

drop trigger if exists trg_transmission_rate_limit on public.transmissions;
create trigger trg_transmission_rate_limit
  before insert on public.transmissions
  for each row execute function public.enforce_public_text_rate_limit();

-- broadcast inserts over Realtime (idempotent)
do $$
begin
  alter publication supabase_realtime add table public.transmissions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
