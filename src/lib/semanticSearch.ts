// Semantic emotional search client: asks the semantic-search Edge Function
// (pgvector + gte-small embeddings) what *feels* like the query. Falls back
// to nothing on any failure — the keyword search always still works.

import { getOptionalSupabaseClient } from './supabase'
import { isSupabaseConfigured } from './supabase-env'
import type { SearchEntry } from './searchIndex'
import type { SampleKind } from './sampleAudio'

export type SemanticResult = SearchEntry & { similarity: number }

type RawRow = { id?: string; title?: string; sub?: string; page?: string; kind?: string; seed?: number; similarity?: number }

const KINDS: SampleKind[] = ['voice', 'whisper', 'laugh', 'static', 'zone', 'tone']

/** Pure mapper — keeps the wire format honest and testable. */
export function mapSemanticRows(rows: unknown): SemanticResult[] {
  if (!Array.isArray(rows)) return []
  return rows
    .filter((r): r is RawRow => !!r && typeof r === 'object')
    .filter(r => typeof r.id === 'string' && typeof r.title === 'string' && typeof r.page === 'string')
    .map(r => ({
      id: `sem-${r.id}`,
      title: r.title as string,
      sub: r.sub ?? '',
      page: r.page as string,
      kind: (KINDS.includes(r.kind as SampleKind) ? r.kind : 'voice') as SampleKind,
      seed: typeof r.seed === 'number' && r.seed > 0 ? r.seed : 97,
      tags: [],
      similarity: typeof r.similarity === 'number' ? r.similarity : 0,
    }))
    .sort((a, b) => b.similarity - a.similarity)
}

let lastQuery = ''
let lastResult: SemanticResult[] = []

export async function semanticSearch(query: string): Promise<SemanticResult[]> {
  const trimmed = query.trim().slice(0, 120)
  if (!trimmed || trimmed.length < 3 || !isSupabaseConfigured) return []
  if (trimmed === lastQuery) return lastResult
  const client = getOptionalSupabaseClient()
  if (!client) return []
  try {
    const { data, error } = await client.functions.invoke<{ results?: unknown }>('semantic-search', {
      body: { query: trimmed },
    })
    if (error) return []
    const mapped = mapSemanticRows(data?.results)
    lastQuery = trimmed
    lastResult = mapped
    return mapped
  } catch {
    return []
  }
}
