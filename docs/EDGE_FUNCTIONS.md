# Edge Functions — advanced processing

Nine small, self-contained Deno functions. Deploy any subset:

```sh
supabase functions deploy waveform chain-mix export-render emotion-tags \
  replay-heat subtitles nightly-recap signal-decay relic-resurface
```

(Plus the earlier ones: `ai-bio`, `help-bot`, `send-push`, `phantom-drift`, `semantic-search`.)

| Function | Does | Auth | Needs |
|---|---|---|---|
| `waveform` | Visual peaks for a stored recording (energy distribution over the encoded bytes — fast, no decoding; not sample-accurate) | user JWT + storage RLS | — |
| `chain-mix` | Mix plan for chain layers (entry timing, gain curve, imperfections kept); Claude adds an arrangement note when keyed | any session | optional `ANTHROPIC_API_KEY` |
| `export-render` | 1080×1920 story card as SVG, server-rendered | any session | — |
| `emotion-tags` | Feeling tags for text — lexicon always, Claude refinement when keyed | any session | optional `ANTHROPIC_API_KEY` |
| `replay-heat` | Anonymized 24h heat scores + replay-storm detection per signal (aggregates only — no user ids leave the function) | any session | service role (auto-injected) |
| `subtitles` | Timed drifting-subtitle cues from a transcript; STT plug point marked | any session | — |
| `nightly-recap` | The caller's own 24h recap from THEIR rows (JWT + RLS); `{"file":true}` also files it as a notification | signed-in user | — |
| `signal-decay` | Cools `signals.heat` 12%/run after 24h idle; fades below 0.08. Batched (200), idempotent | scheduled | migration 0014 |
| `relic-resurface` | One server-decided "resurfaces tonight" relic + room per UTC day, so all clients agree | any session | — |

## Scheduling (pg_cron + pg_net)

Run in the SQL editor once (replace `<ref>` and `<anon-key>`):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- decay: hourly
select cron.schedule('signal-decay-hourly', '5 * * * *', $$
  select net.http_post(
    url := 'https://<ref>.supabase.co/functions/v1/signal-decay',
    headers := '{"Authorization": "Bearer <anon-key>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb);
$$);
```

`nightly-recap` is designed to be called by the client when the user
arrives (it reads their JWT), so it needs no cron; `relic-resurface`
is deterministic per day and cache-friendly (5-minute CDN header).

## Production-safety notes

- Every function validates input, caps sizes, and returns JSON errors.
- Service-role usage is confined to aggregate reads (`replay-heat`),
  batched writes (`signal-decay`), and corpus seeding (`semantic-search`);
  user-scoped functions pass the caller's JWT through so RLS decides.
- All are independent modules — deploy, version, and disable separately.
- `verify_jwt` stays on by default: only app sessions can invoke them.
