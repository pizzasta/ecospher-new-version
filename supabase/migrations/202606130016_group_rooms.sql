-- Group rooms: real anonymous voices dropped into a topic, heard by anyone in
-- that group. Unlike private signal audio (owner-only storage), these clips are
-- shared after screening, so they live in a PRIVATE bucket and playback uses signed URLs,
-- but still only insertable/deletable inside the uploader's own folder so no
-- one can write or remove on someone else's behalf.
--
-- The clips themselves are ordinary public audio_files rows (is_public = true,
-- room_id = 'g_<topic>', bucket = 'group-audio', title = the screened line that
-- accompanies every drop). The existing "public audio files are readable"
-- policy already lets anyone read those rows; this migration only adds the
-- storage bucket + its policies.

insert into storage.buckets (id, name, public)
  values ('group-audio', 'group-audio', false)
  on conflict (id) do update set public = excluded.public;

drop policy if exists "group audio is publicly readable" on storage.objects;
drop policy if exists "users read screened group audio" on storage.objects;
create policy "users read screened group audio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'group-audio'
    and exists (
      select 1 from public.audio_files a
      where a.bucket = bucket_id
        and a.path = name
        and a.is_public = true
        and a.ai_moderation_status = 'passed'
    )
  );

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
