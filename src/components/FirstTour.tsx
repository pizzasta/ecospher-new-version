import { useState } from 'react'
import './FirstTour.css'

// First-visit tour: five cards, one pass, then never again (unless the
// intro is replayed). An introduction, not a tutorial — the app explains
// itself after this.

const TOUR_CARDS = [
  {
    glyph: '◉',
    title: "you're on the grid",
    text: 'signal command is your base. anonymous voices, live after dark. one daily drop to intercept, carriers coming online and going dark. one transmission a night keeps your streak alive.',
  },
  {
    glyph: '∿',
    title: 'the dead drop',
    text: 'say what you never sent. record it, release it, let strangers react. a new prompt drops every week — and it can only be answered here.',
  },
  {
    glyph: '◌',
    title: 'the stream',
    text: 'no mission here. voices stream past — intercept one before it leaves the screen. traffic spikes after midnight.',
  },
  {
    glyph: '◬',
    title: 'everything runs on a timer',
    text: "time locks open on their own countdown. rare frequencies go live for 24 hours, then they're gone for good. artifacts degrade the more they get played.",
  },
  {
    glyph: '◈',
    title: 'your node',
    text: 'no selfies, no bio. your node shows how you listen, not who you claim to be. record a ten-second intro tape, set your colors, and the rest builds itself from your activity.',
  },
  {
    glyph: '⚑',
    title: 'security protocol',
    text: 'everything public is screened automatically — harassment, sexual content and anything involving minors never hits the grid. report or block anyone in one tap. and everything you make can be wiped from system settings, completely, any time.',
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
