-- Signal decay fields: replay heat cools over time; long-cold public
-- signals fade. Written only by the signal-decay Edge Function
-- (service role); clients read them like any other signal column.

alter table public.signals add column if not exists heat double precision not null default 1;
alter table public.signals add column if not exists faded_at timestamptz;

create index if not exists signals_decay_idx
  on public.signals (visibility, faded_at, updated_at)
  where faded_at is null;
