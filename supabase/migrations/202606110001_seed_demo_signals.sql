-- Seed demo public signals so a freshly configured project has live content.
-- Idempotent: skips rows that already exist by title.

insert into public.signals (type, title, caption, mood, visibility, is_anonymous)
select v.type, v.title, v.caption, v.mood, 'public', true
from (values
  ('voice_note', 'still awake', 'still awake. the quiet feels different tonight.', 'nocturne'),
  ('voice_note', 'replaying that moment', 'replaying that moment again. i keep landing in the same second.', 'drift'),
  ('voice_note', 'the only honest hour', 'something about 3am feels like the only honest hour.', 'drift'),
  ('voice_note', 'too quiet in here', 'first night in the new apartment. too quiet.', 'lost'),
  ('voice_note', 'good things out loud', 'something good happened today. saying it out loud.', 'bloom'),
  ('voice_note', 'old hoodie', 'still wearing their hoodie. it stopped smelling like them.', 'nocturne')
) as v(type, title, caption, mood)
where not exists (
  select 1 from public.signals s where s.title = v.title
);
