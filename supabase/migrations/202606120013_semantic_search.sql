-- Semantic emotional search: pgvector + a small curated corpus that the
-- semantic-search Edge Function embeds with Supabase's built-in gte-small
-- model (384 dimensions, no external API key needed).

create extension if not exists vector;

create table if not exists public.semantic_entries (
  id text primary key,
  title text not null,
  sub text not null default '',
  page text not null,
  kind text not null default 'voice',
  seed int not null default 1,
  content text not null,
  embedding vector(384),
  updated_at timestamptz not null default now()
);

-- everyone can read the corpus; only the service role (the Edge Function)
-- can write it
alter table public.semantic_entries enable row level security;

drop policy if exists "semantic entries are readable" on public.semantic_entries;
create policy "semantic entries are readable"
  on public.semantic_entries for select
  to anon, authenticated
  using (true);

create index if not exists semantic_entries_embedding_idx
  on public.semantic_entries
  using hnsw (embedding vector_cosine_ops);

-- nearest-neighbour match by cosine similarity
create or replace function public.match_semantic_entries(
  query_embedding vector(384),
  match_count int default 6,
  min_similarity float default 0.55
)
returns table (
  id text,
  title text,
  sub text,
  page text,
  kind text,
  seed int,
  similarity float
)
language sql stable
as $$
  select
    e.id, e.title, e.sub, e.page, e.kind, e.seed,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.semantic_entries e
  where e.embedding is not null
    and 1 - (e.embedding <=> query_embedding) >= min_similarity
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
