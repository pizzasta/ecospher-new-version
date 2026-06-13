-- Audio moderation metadata for group voice clips. Group drops now upload
-- PRIVATE (is_public = false) and are only promoted to public by the
-- moderate-audio Edge Function after speech-to-text + screening passes — so a
-- clip is never heard by others until it has been screened. These columns
-- record the verdict; the function writes them with the service role.

alter table public.audio_files
  add column if not exists ai_moderation_status text not null default 'not_checked'
  check (ai_moderation_status in ('not_checked', 'passed', 'flagged'));

alter table public.audio_files
  add column if not exists ai_moderation_flags text[] not null default '{}'::text[];

alter table public.audio_files
  add column if not exists ai_moderation_checked_at timestamptz;

create index if not exists audio_files_moderation_idx
  on public.audio_files (ai_moderation_status, created_at desc);
