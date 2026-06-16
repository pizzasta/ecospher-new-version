-- Server-side guard for the anonymous public-text tables (sea_lines +
-- public_notes). Both are screened client-side, but a client is bypassable via
-- the REST API with the anon/auth key — so unscreened harassment, sexual
-- content, or child-safety violations could otherwise be inserted directly and
-- fan out to everyone. Signals and audio already enforce moderation at the DB
-- (202606110010/11/12); this closes the same hole for these two tables.
--
-- Unlike signals, these tables have no private state to fall back to, so
-- flagged content is rejected outright. Reuses the shared, comprehensive
-- public.moderate_signal_text() (threats, harassment, PII, spam, unsafe,
-- sexual_content, child_safety) — keep in sync with src/lib/signalModeration.ts.

create or replace function public.guard_public_text()
returns trigger language plpgsql as $$
begin
  if array_length(public.moderate_signal_text(new.text), 1) > 0 then
    raise exception 'content blocked: failed automated screening';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_sea_line on public.sea_lines;
create trigger trg_guard_sea_line
  before insert or update of text on public.sea_lines
  for each row execute function public.guard_public_text();

drop trigger if exists trg_guard_public_note on public.public_notes;
create trigger trg_guard_public_note
  before insert or update of text on public.public_notes
  for each row execute function public.guard_public_text();
