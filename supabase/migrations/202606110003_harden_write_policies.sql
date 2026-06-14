-- Security hardening: the original insert policies for signals, replays, and
-- activity_events applied to every role and accepted rows with a null owner,
-- so the public anon key alone (no session) could insert via the REST API.
-- The app always establishes at least an anonymous auth session before
-- writing, so restricting these to the authenticated role changes nothing
-- for real clients and closes the unauthenticated spam vector.

drop policy if exists "users can create their own signals" on public.signals;
create policy "users can create their own signals" on public.signals
  for insert to authenticated
  with check (creator_id = auth.uid() or creator_id is null);

drop policy if exists "replays are insertable by signed in users" on public.replays;
create policy "replays are insertable by signed in users" on public.replays
  for insert to authenticated
  with check (listener_id = auth.uid() or listener_id is null);

drop policy if exists "users can create their own activity" on public.activity_events;
create policy "users can create their own activity" on public.activity_events
  for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);
