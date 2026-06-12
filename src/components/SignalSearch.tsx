import { useEffect, useMemo, useRef, useState } from 'react'
import { buildSearchIndex, discoverySuggestions, searchSignals } from '../lib/searchIndex'
import type { DiscoveryRow, SearchEntry } from '../lib/searchIndex'
import { playSampleBuffer, stopPreviewBuffer } from '../lib/sampleAudio'
import './SignalSearch.css'

// Signal Search — a glowing command palette that reaches the whole band.
// Open with ⌘K / Ctrl+K, the nav search button, or the quick-create dial.
// Hovering a result leaks a tiny audio preview; Enter drifts you there.

const FEELING_CHIPS = ['quiet', 'heavy', 'comforting', 'chaotic', 'unresolved', 'insomnia', 'abandoned', 'replayed heavily']

const PAGE_LABEL: Record<string, string> = {
  relics: 'relics', rooms: 'rooms', capsules: 'capsules', chains: 'chains',
  frequencies: 'the sea', drift: 'radar', zones: 'dead zones', unsent: 'unsent', pod: 'your hub',
}

const KIND_GLYPH: Record<string, string> = {
  voice: '∿', whisper: '◌', laugh: '☄', static: '▒', zone: '⌖', tone: '♪',
}

export default function SignalSearch({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewTimerRef = useRef(0)
  const index = useMemo(() => buildSearchIndex(), [])

  const results = useMemo(() => searchSignals(query, index), [query, index])
  const discovery = useMemo<DiscoveryRow[]>(() => (open && !query.trim() ? discoverySuggestions() : []), [open, query])
  const rows: Array<SearchEntry & { reason?: string }> = query.trim() ? results : discovery

  // global openers: ⌘K / Ctrl+K and the ecosphere:search event
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(o => !o)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('ecosphere:search', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('ecosphere:search', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      window.setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      stopPreviewBuffer()
    }
  }, [open])

  useEffect(() => setCursor(0), [query])

  // audio preview: a quiet leak from whatever the cursor rests on
  const previewRow = (row: SearchEntry) => {
    window.clearTimeout(previewTimerRef.current)
    previewTimerRef.current = window.setTimeout(() => {
      void playSampleBuffer(row.kind, row.seed * 13, 3200, 0.16)
    }, 220)
  }

  const go = (row: SearchEntry) => {
    stopPreviewBuffer()
    setOpen(false)
    onNavigate(row.page)
  }

  const onInputKey = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = Math.min(cursor + 1, rows.length - 1)
      setCursor(next)
      if (rows[next]) previewRow(rows[next])
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.max(cursor - 1, 0)
      setCursor(next)
      if (rows[next]) previewRow(rows[next])
    } else if (event.key === 'Enter' && rows[cursor]) {
      go(rows[cursor])
    }
  }

  if (!open) return null

  return (
    <div className="sig-search" role="dialog" aria-label="Signal search" onClick={() => setOpen(false)}>
      <div className="sig-search-panel" onClick={event => event.stopPropagation()}>
        <div className="sig-search-wave" aria-hidden="true">
          {Array.from({ length: 26 }, (_, i) => (
            <b key={i} style={{ animationDelay: `${(i % 8) * 0.13}s`, height: `${18 + ((i * 37) % 70)}%` }} />
          ))}
        </div>
        <div className="sig-search-row">
          <span className="sig-search-glyph" aria-hidden="true">⌖</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="search the band — a name, or a feeling…"
            onChange={event => setQuery(event.target.value)}
            onKeyDown={onInputKey}
            aria-label="search signals"
          />
          <kbd>esc</kbd>
        </div>

        {!query.trim() && (
          <div className="sig-search-chips" aria-label="search by feeling">
            {FEELING_CHIPS.map(chip => (
              <button key={chip} type="button" onClick={() => setQuery(chip)}>{chip}</button>
            ))}
          </div>
        )}

        <div className="sig-search-results">
          {!query.trim() && rows.length > 0 && <span className="sig-search-section">tonight, for you</span>}
          {rows.map((row, i) => (
            <button
              key={row.id}
              type="button"
              className={`sig-result${i === cursor ? ' active' : ''}`}
              onMouseEnter={() => { setCursor(i); previewRow(row) }}
              onMouseLeave={() => window.clearTimeout(previewTimerRef.current)}
              onClick={() => go(row)}
            >
              <span className="sig-result-glyph" aria-hidden="true">{KIND_GLYPH[row.kind] ?? '∿'}</span>
              <span className="sig-result-body">
                <strong>{row.title}</strong>
                <em>{row.reason ?? row.sub}</em>
              </span>
              <span className="sig-result-page">{PAGE_LABEL[row.page] ?? row.page}</span>
            </button>
          ))}
          {query.trim() && rows.length === 0 && (
            <p className="sig-search-empty">nothing on that frequency. try a feeling — "quiet", "unresolved", "driving at night".</p>
          )}
        </div>
        <p className="sig-search-foot">↑↓ drift · enter to go · hover to hear a leak · ⌘K anywhere</p>
      </div>
    </div>
  )
}
