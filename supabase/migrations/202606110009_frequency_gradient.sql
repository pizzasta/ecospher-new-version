-- Frequency Gradient: per-profile background settings. When locked=false
-- the colors derive from hz_signature; when true the stored colors win.
-- speed is seconds per full rotation (0 = drift off).

alter table public.profiles
  add column if not exists gradient_settings jsonb
  default '{"locked": false, "color_start": null, "color_end": null, "angle": null, "speed": 60}';
