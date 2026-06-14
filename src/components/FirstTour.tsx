import { useState } from 'react'
import './FirstTour.css'

// First-visit tour: five cards, one pass, then never again (unless the
// intro is replayed). An introduction, not a tutorial — the app explains
// itself after this.

const TOUR_CARDS = [
  {
    glyph: '◉',
    title: 'the observatory',
    text: 'the band lives here. a daily signal to tune into, live windows into what others are replaying, carriers drifting in and out. come back nightly — the streak notices.',
  },
  {
    glyph: '∿',
    title: 'the unsent room',
    text: "say the thing you never sent. record it, release it, let strangers leave reactions. there's a new prompt every week that can only be answered here.",
  },
  {
    glyph: '◌',
    title: 'the frequency sea',
    text: 'nothing to do here — float. things drift past; catch one before it leaves the screen. the sea is busier after midnight.',
  },
  {
    glyph: '◬',
    title: 'things on clocks',
    text: 'capsules form and open on their own schedules. rare frequencies appear for 24 hours and never again. relics wear down the more they get handled.',
  },
  {
    glyph: '◈',
    title: 'your hub',
    text: "your page doesn't show who you say you are — it shows how you listen. record a ten-second intro tape, pick your colors, and let the rest build itself from your behavior.",
  },
  {
    glyph: '⚑',
    title: 'one more thing',
    text: 'everything public is screened automatically — harassment, sexual content, and anything involving minors never reaches the band. report anything with one tap. and everything you make can be erased in settings, completely, any time.',
  },
] as const

export default function FirstTour({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const card = TOUR_CARDS[index]
  const last = index === TOUR_CARDS.length - 1

  return (
    <div className="first-tour" role="dialog" aria-label="Welcome tour">
      <div className="first-tour-card" key={index}>
        <span className="first-tour-glyph" aria-hidden="true">{card.glyph}</span>
        <h2>{card.title}</h2>
        <p>{card.text}</p>
        <div className="first-tour-dots" aria-hidden="true">
          {TOUR_CARDS.map((_, i) => <i key={i} className={i === index ? 'active' : ''} />)}
        </div>
        <div className="first-tour-actions">
          <button type="button" className="first-tour-skip" onClick={onDone}>skip</button>
          <button
            type="button"
            className="first-tour-next"
            onClick={() => (last ? onDone() : setIndex(i => i + 1))}
          >
            {last ? '◉ start drifting' : 'next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
