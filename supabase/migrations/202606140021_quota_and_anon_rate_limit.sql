-- Scale follow-ups from the 50k readiness pass:
--   1. Server-side MONTHLY audio byte quota (the client byte-budget in
--      audioBudget.ts is bypassable by clearing localStorage; this is the real
--      cost guardrail). Mirrors the 60 MB/month client cap.
--   2. Per-author hourly rate limit on the anonymous public-text tables
--      (sea_lines, public_notes). They store no identity by design, so we add a
--      private `author` marker (forced to auth.uid(), column SELECT revoked so
--      it never leaks) used solely to bound flooding — signals/audio already
--      have hourly caps; this closes the same gap here.

-- ─── 1. monthly audio byte quota ────────────────────────────────────────────
create or replace function public.enforce_audio_monthly_quota()
returns trigger language plpgsql as $$
declare
  used bigint;
begin
  if new.owner_id is not null then
    select coalesce(sum(file_size_bytes), 0) into used
    from public.audio_files
    where owner_id = new.owner_id
      and created_at >= date_trunc('month', now())
      and deleted_at is null;
    if used + coalesce(new.file_size_bytes, 0) > 60 * 1024 * 1024 then
      raise exception 'monthly audio quota exceeded';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_audio_monthly_quota on public.audio_files;
create trigger trg_audio_monthly_quota
  before insert on public.audio_files
  for each row execute function public.enforce_audio_monthly_quota();

-- ─── 2. anonymous public-text per-author hourly rate limit ──────────────────
alter table public.sea_lines    add column if not exists author uuid;
alter table public.public_notes add column if not exists author uuid;

-- the author marker is for rate-limiting only and must never reach clients
revoke select (author) on public.sea_lines    from anon, authenticated;
revoke select (author) on public.public_notes from anon, authenticated;

create index if not exists sea_lines_author_idx    on public.sea_lines (author, created_at desc);
create index if not exists public_notes_author_idx on public.public_notes (author, created_at desc);

-- shared trigger: stamps author = auth.uid() (so it can't be spoofed) and caps
-- inserts per author per hour. security definer so the count can read the
-- column whose SELECT is revoked for the caller.
create or replace function public.enforce_public_text_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cnt integer;
begin
  new.author := auth.uid();
  if new.author is null then return new; end if;
  execute format(
    'select count(*) from public.%I where author = $1 and created_at > now() - interval ''1 hour''',
    tg_table_name
  ) into cnt using new.author;
  if cnt >= 15 then
    raise exception 'rate limit: too many posts this hour';
  end if;
  return new;
end $$;

drop trigger if exists trg_sea_line_rate_limit on public.sea_lines;
create trigger trg_sea_line_rate_limit
  before insert on public.sea_lines
  for each row execute function public.enforce_public_text_rate_limit();

drop trigger if exists trg_public_note_rate_limit on public.public_notes;
create trigger trg_public_note_rate_limit
  before insert on public.public_notes
  for each row execute function public.enforce_public_text_rate_limit();
