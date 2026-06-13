import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { featuredNotes } from '../lib/relicNotes'
import type { FeaturedNote } from '../lib/relicNotes'
import { noteSyncEnabled, fetchTopNotes, reactToNote } from '../lib/noteSync'
import Resonate from './Resonate'
import './FeaturedNotes.css'

// Featured reactions on the Relics page: a small, capped, rotating cluster of
// public notes. With a backend it's the top-reacted across the app (and you can
// resonate with one); without, it rotates your own public notes locally.

export default function FeaturedNotes() {
  const [notes, setNotes] = useState<FeaturedNote[]>(() => (noteSyncEnabled ? [] : featuredNotes()))

  useEffect(() => {
    if (!noteSyncEnabled) return
    void fetchTopNotes(3).then(rows => setNotes(rows.map(r => ({ id: r.id, text: r.text, color: r.color }))))
  }, [])

  if (notes.length === 0) return null
  return (
    <div className="featured-notes">
      <span className="featured-notes-kicker">FEATURED REACTIONS · what's drifting tonight</span>
      <div className="featured-notes-row">
        {notes.map((n, i) => (
          <div key={n.id} className="featured-note" style={{ '--note': n.color, '--i': i } as CSSProperties}>
            <span className="featured-note-mark" aria-hidden="true">◌</span>
            {n.text}
            <Resonate noteId={n.id} onResonate={noteSyncEnabled ? () => { void reactToNote(n.id) } : undefined} />
          </div>
        ))}
      </div>
    </div>
  )
}
