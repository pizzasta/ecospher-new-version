import { describe, expect, it } from 'vitest'
import { mapSemanticRows } from '../semanticSearch'

describe('semantic search mapper', () => {
  it('maps valid rows, sorts by similarity, prefixes ids', () => {
    const rows = mapSemanticRows([
      { id: 'rm5', title: 'Comfort Room', sub: 'soft', page: 'rooms', kind: 'whisper', seed: 565, similarity: 0.71 },
      { id: 'rl6', title: 'answering machine, 1999', sub: 'kinder', page: 'relics', kind: 'voice', seed: 366, similarity: 0.84 },
    ])
    expect(rows.map(r => r.id)).toEqual(['sem-rl6', 'sem-rm5'])
    expect(rows[0].page).toBe('relics')
  })

  it('rejects malformed rows and unknown kinds fall back to voice', () => {
    const rows = mapSemanticRows([
      null,
      { title: 'no id' },
      { id: 'x', title: 'odd kind', page: 'rooms', kind: 'plasma', seed: -3 },
      'garbage',
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('voice')
    expect(rows[0].seed).toBeGreaterThan(0)
  })

  it('returns empty for non-arrays', () => {
    expect(mapSemanticRows(undefined)).toEqual([])
    expect(mapSemanticRows({ rows: [] })).toEqual([])
  })
})
