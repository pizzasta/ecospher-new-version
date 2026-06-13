import type { CSSProperties } from 'react'
import { featuredNotes } from '../lib/relicNotes'
import './FeaturedNotes.css'

// Featured reactions on the Relics page: a small, rotating, capped cluster of
// public post-it notes that travelled — curated so the shelf never crowds.

export default function FeaturedNotes() {
  const notes = featuredNotes()
  if (notes.length === 0) return null
  return (
    <div className="featured-notes">
      <span className="featured-notes-kicker">FEATURED REACTIONS · what's drifting tonight</span>
      <div className="featured-notes-row">
        {notes.map((n, i) => (
          <div key={n.id} className="featured-note" style={{ '--note': n.color, '--i': i } as CSSProperties}>
            <span className="featured-note-mark" aria-hidden="true">◌</span>
            {n.text}
          </div>
        ))}
      </div>
    </div>
  )
}
