import { readPref } from '../hooks/useEcoPrefs'
import { useRef, useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import {
  loadNotes, loadOrSeed, addNote, updateNote, deleteNote, reorderNotes, saveOrder, NOTE_COLORS, NOTE_MAX,
} from '../lib/stickyNotes'
import type { StickyNote } from '../lib/stickyNotes'
import { noteSyncEnabled, publishNote } from '../lib/noteSync'
import Resonate from './Resonate'
import './StickyNotes.css'

// Drift Board - a memory wall of thoughts left at 2am.
// Notes are physically imperfect, temporally alive, emotionally real.
// Private by default; release one to drift, or anchor one that matters.
// Idle motion lives entirely in CSS (smooth, dreamlike) — JS only drives drags.

type NoteState = 'private' | 'drifting' | 'anchored'

interface NoteLayout {
  x: number          // % position on board
  y: number
  rot: number        // resting tilt (deg)
  rotV: number       // extra tilt at the far end of the float (deg)
  floatX: number     // idle drift amplitude (px)
  floatY: number
  floatDur: number   // idle float duration (s) — slow
  floatDelay: number // negative offset so notes desync
  age: number        // 0..1 over a week
  wearLevel: number  // 0..1 grain/wrinkle intensity
  ink: number        // per-note ink opacity variance
  blur: number       // per-note micro-blur on handwriting (px)
  variant: 'plain' | 'tape' | 'folded' | 'torn'
}

const VARIANTS = ['plain', 'tape', 'folded', 'torn'] as const
const AGE_ONE_WEEK = 7 * 24 * 60 * 60 * 1000

function makeLayout(note: StickyNote, index: number, total: number): NoteLayout {
  const seed = note.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const rng = (offset = 0) => {
    const x = Math.sin(seed * 9.301 + offset * 49.918) * 43758.545
    return x - Math.floor(x)
  }
  const cols = Math.max(2, Math.ceil(Math.sqrt(total)))
  const col = index % cols
  const row = Math.floor(index / cols)
  const colW = 88 / cols
  const rowH = 44
  const baseX = 4 + col * colW + rng(1) * (colW * 0.35)
  const baseY = 6 + row * rowH + rng(2) * (rowH * 0.45)
  const ageSecs = (Date.now() - note.createdAt) / AGE_ONE_WEEK
  // anchored notes age slower — emotionally important, kept clean
  const age = Math.min(1, ageSecs * (note.anchored ? 0.4 : 1))
  return {
    x: Math.min(baseX, 84),
    y: Math.min(baseY, 78),
    rot: (rng(3) - 0.5) * 9,
    rotV: (rng(9) - 0.5) * 2.4,
    floatX: (rng(4) - 0.5) * 5,
    floatY: (rng(5) - 0.5) * 4,
    floatDur: 13 + rng(6) * 9,
    floatDelay: -(rng(10) * 22),
    age,
    wearLevel: Math.min(1, age * 0.8 + rng(7) * 0.3),
    ink: (rng(11) - 0.7) * 0.16,   // mostly fades ink a touch, sometimes darkens
    blur: rng(12) * 0.4,           // 0–0.4px — barely-there handwriting blur
    variant: VARIANTS[Math.floor(rng(8) * VARIANTS.length)],
  }
}

function noteState(n: StickyNote): NoteState {
  if (n.anchored) return 'anchored'
  return n.public ? 'drifting' : 'private'
}

interface Dust { id: number; x: number; y: number; opacity: number; size: number; dur: number }

function useDustParticles(count = 8) {
  const [particles] = useState<Dust[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      opacity: 0.03 + Math.random() * 0.06,
      size: 1 + Math.random() * 2,
      dur: 18 + Math.random() * 24,
    }))
  )
  return particles
}

// gentle collision spacing: nudge a just-dropped note out of any neighbour it
// landed on top of, so the board stays loosely arranged, never a chaotic stack.
function spaceOut(id: string, layouts: Map<string, NoteLayout>): Map<string, NoteLayout> {
  const me = layouts.get(id)
  if (!me) return layouts
  const MIN_X = 13, MIN_Y = 16
  let { x, y } = me
  for (const [otherId, other] of layouts) {
    if (otherId === id) continue
    let dx = x - other.x
    let dy = y - other.y
    if (Math.abs(dx) < MIN_X && Math.abs(dy) < MIN_Y) {
      // push along the shallower axis so the move feels minimal
      if (Math.abs(dx) / MIN_X > Math.abs(dy) / MIN_Y) {
        const push = (MIN_X - Math.abs(dx)) * (dx >= 0 ? 1 : -1) * 0.6
        x = Math.max(0, Math.min(88, x + push))
      } else {
        const push = (MIN_Y - Math.abs(dy)) * (dy >= 0 ? 1 : -1) * 0.6
        y = Math.max(0, Math.min(82, y + push))
      }
      dx = x - other.x; dy = y - other.y
    }
  }
  if (x === me.x && y === me.y) return layouts
  const next = new Map(layouts)
  next.set(id, { ...me, x, y })
  return next
}

export default function StickyNotes() {
  const [notes, setNotes] = useState<StickyNote[]>(() => loadOrSeed())
  const [layouts, setLayouts] = useState<Map<string, NoteLayout>>(() => {
    const m = new Map<string, NoteLayout>()
    const seeded = loadOrSeed()
    seeded.forEach((n, i) => m.set(n.id, makeLayout(n, i, seeded.length)))
    return m
  })
  const [draft, setDraft] = useState('')
  const [color, setColor] = useState(NOTE_COLORS[0])
  const [makePublic, setMakePublic] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const dust = useDustParticles(10)

  useEffect(() => {
    setLayouts(prev => {
      const next = new Map(prev)
      notes.forEach((n, i) => {
        if (!next.has(n.id)) next.set(n.id, makeLayout(n, i, notes.length))
      })
      for (const k of next.keys()) {
        if (!notes.find(n => n.id === k)) next.delete(k)
      }
      return next
    })
  }, [notes])

  const add = () => {
    const res = addNote(draft, color, makePublic)
    if ('error' in res) { setError(res.error); return }
    if (res.note.public && noteSyncEnabled) void publishNote(res.note.text, res.note.color)
    setNotes(loadNotes())
    setDraft('')
    setError(null)
  }

  const commitEdit = (id: string) => {
    setNotes(updateNote(id, { text: editText }))
    setEditing(null)
  }
  const remove = (id: string) => setNotes(deleteNote(id))

  const togglePublic = (n: StickyNote) => {
    const next = updateNote(n.id, { public: !n.public })
    setNotes(next)
    const nowPublic = next.find(x => x.id === n.id)?.public
    if (!n.public && !nowPublic) setError("that one stays private - it can't drift from here")
    else {
      setError(null)
      if (!n.public && nowPublic && noteSyncEnabled) void publishNote(n.text, n.color)
    }
  }

  const toggleAnchor = (n: StickyNote) => {
    setNotes(updateNote(n.id, { anchored: !n.anchored }))
    setError(null)
  }

  const onPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (editing === id) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const board = boardRef.current
    if (!board) return
    const br = board.getBoundingClientRect()
    const layout = layouts.get(id)
    if (!layout) return
    const noteX = (layout.x / 100) * br.width
    const noteY = (layout.y / 100) * br.height
    dragStartPos.current = { x: e.clientX - br.left - noteX, y: e.clientY - br.top - noteY }
    setDragging(id)
    if ('vibrate' in navigator && readPref('vibrate', true)) navigator.vibrate(8)
  }, [editing, layouts])

  const onPointerMove = useCallback((e: React.PointerEvent, id: string) => {
    if (dragging !== id) return
    const board = boardRef.current
    if (!board) return
    const br = board.getBoundingClientRect()
    const rawX = e.clientX - br.left - dragStartPos.current.x
    const rawY = e.clientY - br.top - dragStartPos.current.y
    const xPct = Math.max(0, Math.min(88, (rawX / br.width) * 100))
    const yPct = Math.max(0, Math.min(82, (rawY / br.height) * 100))
    setLayouts(prev => {
      const m = new Map(prev)
      const l = m.get(id)
      if (l) m.set(id, { ...l, x: xPct, y: yPct })
      return m
    })
  }, [dragging])

  const onPointerUp = useCallback((id: string) => {
    if (dragging !== id) return
    setDragging(null)
    setLayouts(prev => {
      const m = new Map(prev)
      const l = m.get(id)
      if (!l) return prev
      // soft magnetic snap toward a loose grid (lerp, not hard click)
      const snapX = Math.round(l.x / 8) * 8
      const snapY = Math.round(l.y / 10) * 10
      m.set(id, {
        ...l,
        x: l.x + (snapX - l.x) * 0.22,
        y: l.y + (snapY - l.y) * 0.22,
      })
      // then nudge apart from any note it landed on
      return spaceOut(id, m)
    })
    const sorted = [...notes].sort((a, b) => {
      const la = layouts.get(a.id)
      const lb = layouts.get(b.id)
      return ((la?.y ?? 0) - (lb?.y ?? 0)) || ((la?.x ?? 0) - (lb?.x ?? 0))
    })
    const reordered = reorderNotes(notes, id, sorted[0]?.id ?? id)
    saveOrder(reordered)
  }, [dragging, notes, layouts])

  // outer wrapper: position, z-index, drag scale, settle drift on release
  const outerStyle = (n: StickyNote, layout: NoteLayout): CSSProperties => {
    const isDragging = dragging === n.id
    return {
      position: 'absolute',
      left: `${layout.x}%`,
      top: `${layout.y}%`,
      transform: isDragging ? 'scale(1.04)' : 'scale(1)',
      zIndex: isDragging ? 100 : Math.floor(50 + layout.y),
      transition: isDragging
        ? 'transform 0.08s ease'
        // slow settle = "delayed movement after dragging"
        : 'left 2.2s cubic-bezier(0.22,0.61,0.36,1), top 2.2s cubic-bezier(0.22,0.61,0.36,1), transform 0.6s ease',
      cursor: isDragging ? 'grabbing' : 'grab',
      touchAction: 'none',
    }
  }

  // inner paper: carries colour, age, idle-float animation vars
  const floatStyle = (n: StickyNote, layout: NoteLayout): CSSProperties => ({
    '--note': n.color,
    '--wear': layout.wearLevel,
    '--age': layout.age,
    '--rot': `${layout.rot}deg`,
    '--rotv': `${layout.rotV}deg`,
    '--fx': `${layout.floatX}px`,
    '--fy': `${layout.floatY}px`,
    '--float-dur': `${layout.floatDur}s`,
    '--float-delay': `${layout.floatDelay}s`,
    '--ink': layout.ink,
    '--blur': `${layout.blur}px`,
  } as CSSProperties)

  const floatClass = (n: StickyNote, layout: NoteLayout) => {
    const state = noteState(n)
    const stateC = state === 'drifting' ? 'is-drifting' : state === 'anchored' ? 'is-anchored' : 'is-private'
    const ageC = layout.age > 0.7 ? ' is-aged' : layout.age > 0.35 ? ' is-worn' : ''
    const lifted = dragging === n.id ? ' lifted' : ''
    return `note-float ${stateC} note-${layout.variant}${ageC}${lifted}`
  }

  return (
    <section className="drift-section" aria-label="Your notes">
      <div className="drift-head">
        <span className="drift-kicker">YOUR NOTES</span>
        <small className="drift-sub">thoughts left behind · drag to place · release one to drift · anchor what matters</small>
      </div>

      <div className="drift-compose">
        <textarea
          value={draft}
          maxLength={NOTE_MAX}
          placeholder="a reaction. a reflection. a half-thought you don't want to lose..."
          onChange={e => setDraft(e.target.value)}
          className="drift-textarea"
        />
        <div className="drift-compose-row">
          <div className="drift-colors" role="group" aria-label="note color">
            {NOTE_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`drift-swatch${color === c ? ' on' : ''}`}
                style={{ background: c }}
                aria-label={`color ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <label className="drift-public-label">
            <input type="checkbox" checked={makePublic} onChange={e => setMakePublic(e.target.checked)} />
            let it drift
          </label>
          <button
            type="button"
            className="drift-pin-btn"
            disabled={draft.trim().length < 2}
            onClick={add}
          >
            pin it
          </button>
        </div>
        {error && <span className="drift-error">{error}</span>}
      </div>

      {notes.length === 0 ? (
        <p className="drift-empty">no notes yet. pin the first thought you don't want to lose.</p>
      ) : (
        <div className="drift-board" ref={boardRef} aria-label="note drift board">
          <div className="drift-dust-layer" aria-hidden="true">
            {dust.map(d => (
              <span
                key={d.id}
                className="drift-dust"
                style={{
                  left: `${d.x}%`,
                  top: `${d.y}%`,
                  width: d.size,
                  height: d.size,
                  opacity: d.opacity,
                  animationDuration: `${d.dur}s`,
                  animationDelay: `${-d.dur * Math.random()}s`,
                }}
              />
            ))}
          </div>
          {notes.map(n => {
            const layout = layouts.get(n.id)
            if (!layout) return null
            return (
              <div
                key={n.id}
                className="drift-note"
                style={outerStyle(n, layout)}
                onPointerDown={e => onPointerDown(e, n.id)}
                onPointerMove={e => onPointerMove(e, n.id)}
                onPointerUp={() => onPointerUp(n.id)}
              >
                <div className={floatClass(n, layout)} style={floatStyle(n, layout)}>
                  <div className="note-grain" aria-hidden="true" />
                  {layout.variant === 'tape' && <div className="note-tape" aria-hidden="true" />}
                  <div className="note-age-overlay" aria-hidden="true" />
                  {editing === n.id ? (
                    <textarea
                      autoFocus
                      className="note-edit-area"
                      value={editText}
                      maxLength={NOTE_MAX}
                      onChange={e => setEditText(e.target.value)}
                      onBlur={() => commitEdit(n.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(n.id) }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="note-text-btn"
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => { setEditing(n.id); setEditText(n.text) }}
                    >
                      {n.text}
                    </button>
                  )}
                  <div className="note-foot">
                    <button
                      type="button"
                      className="note-state-toggle"
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => togglePublic(n)}
                      title={n.public ? 'drifting publicly - tap to keep it close' : 'private - tap to let it drift'}
                    >
                      {n.public ? 'drifting' : 'private'}
                    </button>
                    <div className="note-foot-actions">
                      <button
                        type="button"
                        className={`note-anchor${n.anchored ? ' on' : ''}`}
                        onPointerDown={e => e.stopPropagation()}
                        onClick={() => toggleAnchor(n)}
                        aria-pressed={!!n.anchored}
                        title={n.anchored ? 'anchored - tap to let it drift with the rest' : 'anchor this one'}
                      >
                        {n.anchored ? '◆' : '◇'}
                      </button>
                      <button
                        type="button"
                        className="note-del"
                        onPointerDown={e => e.stopPropagation()}
                        onClick={() => remove(n.id)}
                        aria-label="remove note"
                      >
                        x
                      </button>
                    </div>
                  </div>
                  {n.public && <Resonate noteId={n.id} readOnly />}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
