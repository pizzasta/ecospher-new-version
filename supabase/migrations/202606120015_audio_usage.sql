-- Audio lifecycle: soft-delete marker for cleanup of failed/abandoned
-- uploads. (file_size_bytes, kind/upload type, is_archived, owner_id,
-- duration_seconds, path, created_at, is_public already exist.)

alter table public.audio_files add column if not exists deleted_at timestamptz;

create index if not exists audio_files_usage_idx
  on public.audio_files (owner_id, created_at desc)
  where deleted_at is null;
