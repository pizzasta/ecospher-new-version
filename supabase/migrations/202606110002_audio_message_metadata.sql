-- Audio message metadata: classify uploads (signal / echo / capsule / drift_note)
-- and optionally tie them to a room, so room drift notes and capsule audio can
-- be queried separately from plain library recordings.

alter table public.audio_files
  add column if not exists kind text not null default 'signal',
  add column if not exists room_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'audio_files_kind_check'
  ) then
    alter table public.audio_files
      add constraint audio_files_kind_check
      check (kind in ('signal', 'echo', 'capsule', 'drift_note'));
  end if;
end $$;

create index if not exists audio_files_kind_idx on public.audio_files (kind);
create index if not exists audio_files_room_idx on public.audio_files (room_id) where room_id is not null;

-- Realtime: stream public activity inserts to connected clients
do $$
begin
  alter publication supabase_realtime add table public.activity_events;
exception
  when duplicate_object then null;
end $$;
