-- Server-side guardian: the client already AI-screens public signals, but a
-- client can be bypassed. This enforces the same rules at the database, so
-- nothing flagged can ever become public regardless of what inserts it —
-- fully automated, no human review. Plus per-user insert rate caps so bots
-- can't flood the band.

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
