-- Production hardening: group voice storage must remain private until screening passes.
update storage.buckets set public = false where id = 'group-audio';

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
