-- Personal Hz Signature: a data-derived frequency identity per profile.
-- hz_signature = (avg signal duration s * 2) + (reactions received * 0.5) + 20,
-- clamped 20.00-200.00. Initial value is random; recalculated on demand.

alter table public.profiles
  add column if not exists hz_signature numeric(5,2) default (20 + random() * 180),
  add column if not exists hz_display_name text,
  add column if not exists hz_color text default '#66ccff';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_hz_display_name_check') then
    alter table public.profiles
      add constraint profiles_hz_display_name_check
      check (hz_display_name is null or hz_display_name ~ '^[a-zA-Z0-9 ]{1,20}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_hz_color_check') then
    alter table public.profiles
      add constraint profiles_hz_color_check
      check (hz_color ~ '^#[0-9a-fA-F]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_hz_signature_range') then
    alter table public.profiles
      add constraint profiles_hz_signature_range
      check (hz_signature is null or (hz_signature >= 20 and hz_signature <= 200));
  end if;
end $$;
