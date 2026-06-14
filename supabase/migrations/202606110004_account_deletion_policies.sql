-- Account deletion support: users must be able to erase everything they own.
-- audio_files / soul pods / archives already have owner-scoped "for all"
-- policies; these tables were missing delete (or any write) paths.

drop policy if exists "users can delete their own activity" on public.activity_events;
create policy "users can delete their own activity" on public.activity_events
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "users can delete their own replays" on public.replays;
create policy "users can delete their own replays" on public.replays
  for delete to authenticated
  using (listener_id = auth.uid());

drop policy if exists "users can delete their own profile" on public.profiles;
create policy "users can delete their own profile" on public.profiles
  for delete to authenticated
  using (id = auth.uid());

drop policy if exists "users can manage their relics" on public.user_relics;
create policy "users can manage their relics" on public.user_relics
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
