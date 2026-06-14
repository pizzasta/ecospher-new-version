// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { addNote, loadNotes, loadOrSeed, updateNote, deleteNote, reorderNotes, NOTE_COLORS } from '../stickyNotes'
import { featuredNotes } from '../relicNotes'

describe('sticky notes', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('pins a note and keeps it private by default', () => {
    const res = addNote('i muted this halfway. came back.', NOTE_COLORS[0], false)
    expect('note' in res).toBe(true)
    if ('note' in res) expect(res.note.public).toBe(false)
    expect(loadNotes()).toHaveLength(1)
  })

  it('rejects too-short notes and screens public ones', () => {
    expect('error' in addNote('x', NOTE_COLORS[0], false)).toBe(true)
    // a flagged phrase can't go public
    const r = addNote('kill yourself you idiot loser', NOTE_COLORS[0], true)
    expect('error' in r).toBe(true)
  })

  it('edits, deletes, and reorders', () => {
    addNote('first note here drifting', NOTE_COLORS[0], false)
    addNote('second note here drifting', NOTE_COLORS[1], false)
    const notes = loadNotes()
    expect(notes).toHaveLength(2)
    // reorder is pure
    const reordered = reorderNotes(notes, notes[1].id, notes[0].id)
    expect(reordered[0].id).toBe(notes[1].id)
    // edit + delete persist
    updateNote(notes[0].id, { text: 'edited note text here' })
    expect(loadNotes().find(n => n.id === notes[0].id)?.text).toBe('edited note text here')
    deleteNote(notes[0].id)
    expect(loadNotes()).toHaveLength(1)
  })

  it('seeds real starter notes once, then never re-seeds a cleared board', () => {
    const seeded = loadOrSeed()
    expect(seeded.length).toBeGreaterThan(0)
    // seeds are ordinary, editable notes
    expect(seeded.every(n => typeof n.id === 'string' && n.public === false)).toBe(true)
    // a second load returns the same stored notes, not a fresh seed
    expect(loadOrSeed()).toHaveLength(seeded.length)
    // clearing the board is respected — no re-seed
    seeded.forEach(n => deleteNote(n.id))
    expect(loadOrSeed()).toHaveLength(0)
  })

  it('only public notes graduate to featured relics, capped + rotated', () => {
    addNote('a private reflection nobody sees', NOTE_COLORS[0], false)
    addNote('why did this actually help me', NOTE_COLORS[1], true)
    addNote('i almost sent this to someone', NOTE_COLORS[2], true)
    const featured = featuredNotes(1_000 * 86400000, 3)
    expect(featured.length).toBeGreaterThanOrEqual(1)
    expect(featured.length).toBeLessThanOrEqual(3)
    // the private one is never featured
    expect(featured.some(f => f.text.includes('private reflection'))).toBe(false)
  })
})
