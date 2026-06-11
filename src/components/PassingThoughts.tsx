import { useEffect, useRef, useState } from 'react'
import './PassingThoughts.css'

// Passing Thoughts: text-only letters that can be opened exactly once and
// dissolve 60 seconds later. Nothing is stored — not localStorage, not the
// backend. Leave the page and they're gone. That's the point.

type Letter = {
  id: string
  text: string
  from: 'you' | 'a stranger'
  openedAt: number | null
}

const OPEN_SECONDS = 60
const MAX_LETTERS = 5

const STRANGER_THOUGHTS = [
  'i walked past your building once. the light was on. that was enough.',
  "today was fine. i just didn't want fine to go unrecorded.",
  'if you find this, the answer was yes. it was always yes.',
  "i'm not sad. i'm just at the part of the night where everything sounds like a question.",
  'someone laughed exactly like you on the bus today. i almost said your name.',
  'i kept the receipt. not the thing. the receipt.',
  "tomorrow i'll pretend i didn't write this. tonight it's true.",
  'the song ended and i just sat there in the quiet it left.',
  'i forgive you. you just never asked, so i never got to say it.',
  'this thought has been circling for an hour. landing it here so it stops.',
]

export default function PassingThoughts() {
  const [letters, setLetters] = useState<Letter[]>([])
  const [draft, setDraft] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const strangerTimerRef = useRef<number | null>(null)

  // one shared ticker drives every countdown
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  // strangers' thoughts drift in occasionally (in-memory only, max 5 held)
  useEffect(() => {
    const schedule = () => {
      strangerTimerRef.current = window.setTimeout(() => {
        setLetters(prev => {
          if (prev.length >= MAX_LETTERS) return prev
          const text = STRANGER_THOUGHTS[Math.floor(Math.random() * STRANGER_THOUGHTS.length)]
          return [...prev, { id: `pt-${Date.now()}`, text, from: 'a stranger', openedAt: null }]
        })
        schedule()
      }, (90 + Math.random() * 150) * 1000)
    }
    schedule()
    return () => {
      if (strangerTimerRef.current !== null) window.clearTimeout(strangerTimerRef.current)
    }
  }, [])

  // expired letters dissolve permanently
  useEffect(() => {
    setLetters(prev => prev.filter(l => l.openedAt === null || now - l.openedAt < OPEN_SECONDS * 1000))
  }, [now])

  const release = () => {
    const text = draft.trim()
    if (!text) return
    setLetters(prev => [...prev.slice(-(MAX_LETTERS - 1)), { id: `pt-${Date.now()}`, text, from: 'you', openedAt: null }])
    setDraft('')
  }

  const openLetter = (id: string) => {
    setLetters(prev => prev.map(l => (l.id === id && l.openedAt === null ? { ...l, openedAt: Date.now() } : l)))
  }

  return (
    <section className="passing-thoughts" aria-label="Passing thoughts">
      <div className="pt-head">
        <span className="pt-kicker">PASSING THOUGHTS</span>
        <span className="pt-note">open once · gone in 60s · never stored</span>
      </div>

      <div className="pt-compose">
        <textarea
          value={draft}
          maxLength={280}
          placeholder="write something you don't need to keep…"
          onChange={e => setDraft(e.target.value)}
          rows={2}
        />
        <button type="button" disabled={!draft.trim()} onClick={release}>let it pass</button>
      </div>

      {letters.length > 0 && (
        <div className="pt-letters">
          {letters.map(letter => {
            const opened = letter.openedAt !== null
            const remaining = opened ? Math.max(0, OPEN_SECONDS - Math.floor((now - (letter.openedAt ?? now)) / 1000)) : null
            return opened ? (
              <div key={letter.id} className={`pt-letter pt-letter--open${(remaining ?? 0) <= 10 ? ' pt-letter--fading' : ''}`}>
                <p>{letter.text}</p>
                <span className="pt-letter-meta">from {letter.from} · dissolves in {remaining}s</span>
              </div>
            ) : (
              <button key={letter.id} type="button" className="pt-letter pt-letter--sealed" onClick={() => openLetter(letter.id)}>
                <i aria-hidden="true">✉</i>
                <span>a passing thought from {letter.from} — open once, then it's gone</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
