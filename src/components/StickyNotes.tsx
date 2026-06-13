import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  loadNotes, addNote, updateNote, deleteNote, reorderNotes, saveOrder, NOTE_COLORS, NOTE_MAX,
} from '../lib/stickyNotes'
import type { StickyNote } from '../lib/stickyNotes'
import { noteSyncEnabled, publishNote } from '../lib/noteSync'
import './StickyNotes.css'

// Your own post-its, pinned on the pod: reactions, reflections, half-thoughts.
// Private by default; release one to drift public (screened), and the
// well-travelled ones surface on Relics. Drag to arrange your own wall.

export default function StickyNotes() {
  const [notes, setNotes] = useState<StickyNote[]>(() => loadNotes())
  const [draft, setDraft] = useState('')
  const [color, setColor] = useState(NOTE_COLORS[0])
  const [makePublic, setMakePublic] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const draggedRef = useRef<string | null>(null)

  const add = () => {
    const res = addNote(draft, color, makePublic)
    if ('error' in res) { setError(res.error); return }
    if (res.note.public && noteSyncEnabled) void publishNote(res.note.text, res.note.color)
    setNotes(loadNotes()); setDraft(''); setError(null)
  }

  const commitEdit = (id: string) => { setNotes(updateNote(id, { text: editText })); setEditing(null) }
  const remove = (id: string) => setNotes(deleteNote(id))
  const togglePublic = (n: StickyNote) => {
    const next = updateNote(n.id, { public: !n.public })
    setNotes(next)
    const nowPublic = next.find(x => x.id === n.id)?.public
    if (!n.public && !nowPublic) setError("that one stays private — it can't drift public here")
    else { setError(null); if (!n.public && nowPublic && noteSyncEnabled) void publishNote(n.text, n.color) }
  }

  const onDrop = (toId: string) => {
    const from = draggedRef.current
    if (!from) return
    const next = reorderNotes(notes, from, toId)
    setNotes(next); saveOrder(next); draggedRef.current = null
  }

  return (
    <section className="sticky-notes" aria-label="Your notes">
      <div className="sticky-head">
        <span className="sticky-kicker">YOUR NOTES</span>
        <small>private by default · drag to arrange · release one to drift</small>
      </div>

      <div className="sticky-compose">
        <textarea
          value={draft}
          maxLength={NOTE_MAX}
          placeholder="a reaction, a reflection, a half-thought you don't want to lose…"
          onChange={e => setDraft(e.target.value)}
        />
        <div className="sticky-compose-row">
          <div className="sticky-colors" role="group" aria-label="note color">
            {NOTE_COLORS.map(c => (
              <button key={c} type="button" className={`sticky-swatch${color === c ? ' on' : ''}`} style={{ background: c }} aria-label={`color ${c}`} onClick={() => setColor(c)} />
            ))}
          </div>
          <label className="sticky-public">
            <input type="checkbox" checked={makePublic} onChange={e => setMakePublic(e.target.checked)} /> let it drift public
          </label>
          <button type="button" className="sticky-add" disabled={draft.trim().length < 2} onClick={add}>◷ pin it</button>
        </div>
        {error && <span className="sticky-error">{error}</span>}
      </div>

      {notes.length === 0 ? (
        <p className="sticky-empty">no notes yet. pin the first thought you don't want to lose.</p>
      ) : (
        <div className="sticky-board">
          {notes.map(n => (
            <div
              key={n.id}
              className={`sticky-note${n.public ? ' is-public' : ''}`}
              style={{ '--note': n.color } as CSSProperties}
              draggable
              onDragStart={() => { draggedRef.current = n.id }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(n.id)}
            >
              {editing === n.id ? (
                <textarea
                  autoFocus
                  value={editText}
                  maxLength={NOTE_MAX}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => commitEdit(n.id)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(n.id) } }}
                />
              ) : (
                <button type="button" className="sticky-note-text" onClick={() => { setEditing(n.id); setEditText(n.text) }}>{n.text}</button>
              )}
              <div className="sticky-note-foot">
                <button type="button" className="sticky-toggle" onClick={() => togglePublic(n)} title={n.public ? 'drifting public — tap to make private' : 'private — tap to let it drift'}>
                  {n.public ? '∿ public' : '◌ private'}
                </button>
                <button type="button" className="sticky-del" onClick={() => remove(n.id)} aria-label="remove note">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
