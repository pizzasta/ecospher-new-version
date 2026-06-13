-- Group rooms: real anonymous voices dropped into a topic, heard by anyone in
-- that group. Unlike private signal audio (owner-only storage), these clips are
-- deliberately shared, so they live in a PUBLIC bucket — readable by everyone,
-- but still only insertable/deletable inside the uploader's own folder so no
-- one can write or remove on someone else's behalf.
--
-- The clips themselves are ordinary public audio_files rows (is_public = true,
-- room_id = 'g_<topic>', bucket = 'group-audio', title = the screened line that
-- accompanies every drop). The existing "public audio files are readable"
-- policy already lets anyone read those rows; this migration only adds the
-- storage bucket + its policies.

insert into storage.buckets (id, name, public)
  values ('group-audio', 'group-audio', true)
  on conflict (id) do nothing;

drop policy if exists "group audio is publicly readable" on storage.objects;
create policy "group audio is publicly readable"
  on storage.objects for select
  using (bucket_id = 'group-audio');

drop policy if exists "users upload group audio in their own folder" on storage.objects;
create policy "users upload group audio in their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'group-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete their own group audio" on storage.objects;
create policy "users delete their own group audio"
  on storage.objects for delete
  using (
    bucket_id = 'group-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- room_id is already indexed (202606110002); group clips reuse it as 'g_<topic>'.
