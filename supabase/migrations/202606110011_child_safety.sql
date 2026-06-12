-- Child safety: extends the server-side guardian with predator-pattern
-- screening (age solicitation, off-platform contact pulls, photo requests,
-- meet-up pressure, minor self-identification). Anything flagged can never
-- be public — same enforcement path as 202606110010. Mirrors the client
-- rules in src/lib/signalModeration.ts; change both together.

create or replace function public.moderate_signal_text(content text)
returns text[]
language plpgsql immutable as $$
declare
  normalized text := lower(coalesce(content, ''));
  flags text[] := '{}';
begin
  if normalized ~ '\m(kill|hurt|attack|stab|shoot|bomb|threat)\M' then
    flags := array_append(flags, 'threats');
  end if;
  if normalized ~ '\m(hate you|idiot|stupid|worthless|trash|loser)\M' then
    flags := array_append(flags, 'harassment');
  end if;
  if content ~ '\d{3}[-.\s]?\d{3}[-.\s]?\d{4}'
     or content ~* '[\w.-]+@[\w.-]+\.\w{2,}'
     or content ~* '\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\M' then
    flags := array_append(flags, 'explicit_personal_information');
  end if;
  if content ~* '(https?://|www\.|free money|promo code|buy now|subscribe now)' then
    flags := array_append(flags, 'spam');
  end if;
  if normalized ~ '\m(self harm|suicide|overdose|exploit|blackmail)\M' then
    flags := array_append(flags, 'unsafe_content');
  end if;
  if normalized ~ '\m(how old are you|whats your age|what''s your age|asl)\M'
     or normalized ~ 'are you a (girl|boy)'
     or (normalized ~ '\m(add me on|dm me|message me on|find me on)\M' and normalized ~ '\m(snap|snapchat|kik|insta|instagram|whatsapp|telegram|discord)\M')
     or (normalized ~ '\m(snap|snapchat|kik|whatsapp|telegram)\M' and normalized ~ '\m(me|you)\M')
     or normalized ~ '\m(send|show) (me )?(a |your )?(pic|pics|picture|photo|photos|selfie)'
     or normalized ~ '\m(meet (up|me)|where do you live|what school)\M'
     or normalized ~ '\m(im|i m|i am) (1[0-7]|a minor)\M' then
    flags := array_append(flags, 'child_safety');
  end if;
  return flags;
end $$;
