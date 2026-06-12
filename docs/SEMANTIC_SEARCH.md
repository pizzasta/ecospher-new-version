# Semantic Emotional Search

Vector search over the app's emotional corpus using Supabase pgvector +
the Edge runtime's built-in `gte-small` embedding model (384 dims —
no external API key, no extra cost).

The palette (⌘K) blends two layers:
1. **Keyword/feeling search** — instant, local, always works.
2. **Semantic layer** — debounced; results that *feel* like the query
   appear under a "felt like this" divider ("sounds lonely" finds the
   voicemail relic and the Missing Someone room even though neither
   contains the word "lonely"). Fails silently to keyword-only.

## Setup (one time)

1. Run `supabase/setup-all.sql` (now includes migration 0013: the
   `vector` extension, `semantic_entries` table + HNSW index, and the
   `match_semantic_entries` RPC).
2. `supabase functions deploy semantic-search`
3. Seed the corpus once (idempotent):
   ```sh
   curl -X POST "https://<ref>.supabase.co/functions/v1/semantic-search" \
     -H "Authorization: Bearer <anon-key>" -H "Content-Type: application/json" \
     -d '{"action":"seed"}'
   ```
   (Seeding writes with the service-role key inside the function; RLS
   keeps the table read-only for clients.)

## What's embedded

Relic descriptions and stay-quotes, room moods, chain types, sea/radar
signal feelings, dead zones, the unsent room — each written as a
feeling ("heartbreak, old saved messages from someone gone, people
trying not to cry") rather than as metadata, which is what makes
"quiet comfort" or "unfinished conversation" land on the right doors.

Without the backend or before seeding, search keeps working exactly as
before — the semantic layer simply never appears.
