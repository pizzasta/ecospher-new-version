// Promotion of personal post-it notes to the Relics page. Only public notes are
// eligible (they've already passed screening); a small set is featured per day
// with a rotation so the shelf never crowds. Local-first here (your own public
// notes); a backend would rank the whole app's notes by reactions + recency and
// substitute the pool below.

import { loadNotes } from './stickyNotes'

export interface FeaturedNote { id: string; text: string; color: string }

function day(now: number): number { return Math.floor(now / 86400000) }

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * The featured reactions for the Relics page: public notes only, at least a few
 * words (anti-spam), capped and rotated by day so it stays curated.
 */
export function featuredNotes(now = Date.now(), cap = 3): FeaturedNote[] {
  const eligible = loadNotes().filter(n => n.public && wordCount(n.text) >= 3)
  if (eligible.length === 0) return []
  const start = day(now) % eligible.length
  const rotated = [...eligible.slice(start), ...eligible.slice(0, start)]
  return rotated.slice(0, cap).map(n => ({ id: n.id, text: n.text, color: n.color }))
}
