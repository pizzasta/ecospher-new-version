-- Notification system: in-app notifications + web push subscriptions.
-- Notifications are created by database triggers (below) so every write
-- path — app, Edge Functions, the phantom job — produces them consistently.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('new_reaction', 'new_listener', 'new_listener_follow', 'new_capsule', 'phantom_interaction')),
  actor_id uuid references public.profiles(id) on delete set null,
  signal_id uuid references public.signals(id) on delete cascade,
  capsule_id uuid references public.capsules(id) on delete cascade,
  metadata jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "recipients read their notifications" on public.notifications;
create policy "recipients read their notifications" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "recipients update read state" on public.notifications;
create policy "recipients update read state" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "recipients delete their notifications" on public.notifications;
create policy "recipients delete their notifications" on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- realtime: stream new notifications to the signed-in recipient
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

-- ─── push subscriptions (opt-in web push) ────────────────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "users manage their push subscriptions" on public.push_subscriptions;
create policy "users manage their push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── triggers: notifications are created where the events happen ─────────────
-- (Alternative: create them client/API-side next to each action. Triggers
-- were chosen so the phantom job and any future writer get them for free.)

create or replace function public.notify_on_replay()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
begin
  select creator_id into owner from public.signals where id = new.signal_id;
  if owner is not null and owner is distinct from new.listener_id then
    insert into public.notifications (user_id, type, actor_id, signal_id)
    values (owner, 'new_listener', new.listener_id, new.signal_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_on_replay on public.replays;
create trigger trg_notify_on_replay
  after insert on public.replays
  for each row execute function public.notify_on_replay();

create or replace function public.notify_on_listen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, actor_id)
  values (new.tuned_to_id, 'new_listener_follow', new.listener_id);
  return new;
end $$;

drop trigger if exists trg_notify_on_listen on public.listens;
create trigger trg_notify_on_listen
  after insert on public.listens
  for each row execute function public.notify_on_listen();

create or replace function public.notify_on_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  phantom boolean;
begin
  if new.type <> 'voice_reaction' or new.signal_id is null then
    return new;
  end if;
  select creator_id into owner from public.signals where id = new.signal_id;
  if owner is null or owner = new.user_id then
    return new;
  end if;
  select coalesce((u.raw_user_meta_data ->> 'phantom')::boolean, false) into phantom
    from auth.users u where u.id = new.user_id;
  insert into public.notifications (user_id, type, actor_id, signal_id, metadata)
  values (owner, case when phantom then 'phantom_interaction' else 'new_reaction' end, new.user_id, new.signal_id, new.metadata);
  return new;
end $$;

drop trigger if exists trg_notify_on_reaction on public.activity_events;
create trigger trg_notify_on_reaction
  after insert on public.activity_events
  for each row execute function public.notify_on_reaction();
