alter table public.signals
add column if not exists ai_moderation_status text not null default 'not_checked'
check (ai_moderation_status in ('not_checked', 'passed', 'flagged'));

alter table public.signals
add column if not exists ai_moderation_flags text[] not null default '{}'::text[];

alter table public.signals
add column if not exists ai_moderation_checked_at timestamptz;

create index if not exists signals_ai_moderation_status_idx
on public.signals(ai_moderation_status, created_at desc);
