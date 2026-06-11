import { useEffect, useRef, useState } from 'react'
import { apiReact } from '../lib/mockApi'
import './ActiveCarriers.css'

// "tuned to" — the carriers this user listens for (local-first; the listens
// table mirrors this once carriers have real profile ids)
const TUNED_TO_KEY = 'ecosphere:tunedTo'

function readTuned(): string[] {
  try { return JSON.parse(window.localStorage.getItem(TUNED_TO_KEY) ?? '[]') } catch { return [] }
}

function writeTuned(names: string[]) {
  try { window.localStorage.setItem(TUNED_TO_KEY, JSON.stringify(names.slice(0, 100))) } catch { /* session only */ }
}

type CarrierStatus = 'echo' | 'pulse' | 'lost' | 'soft_focus'

type Carrier = {
  id: string
  signalId: string
  name: string
  status: CarrierStatus
  streak: number
  lastActive: string
}

const CARRIER_STATUSES: readonly CarrierStatus[] = ['echo', 'pulse', 'lost', 'soft_focus']

const STATUS_LABELS: Record<CarrierStatus, string> = {
  echo: 'echo',
  pulse: 'pulse',
  lost: 'lost',
  soft_focus: 'soft focus',
}

const LAST_ACTIVE_POOL = ['just now', '40 sec ago', '2 min ago', '6 min ago', '14 min ago', '31 min ago', 'an hour ago']

// the phantom: a carrier that has been on the band longer than the network.
// it drifts between states on its own slow cycle (5-15 min) and its
// last-active never quite resolves. injected into the list like any other
// carrier — no special UI. (see docs/PHANTOM_CARRIER.md for the backend
// version with a real Supabase account + scheduled Edge Function.)
const PHANTOM_CARRIER: Carrier = { id: 'phantom', signalId: 's3', name: 'carrier_null', status: 'soft_focus', streak: 113, lastActive: 'always' }
const PHANTOM_LAST_ACTIVE = ['always', 'just now', 'before you arrived', '∅', 'a moment from now'] as const

const initialCarriers: Carrier[] = [
  { id: 'car1', signalId: 's1', name: 'gasstationoracle', status: 'pulse', streak: 9, lastActive: 'just now' },
  { id: 'car2', signalId: 's2', name: 'blurrywafflehouse', status: 'echo', streak: 5, lastActive: '2 min ago' },
  { id: 'car3', signalId: 's3', name: 'voicemailafter2', status: 'soft_focus', streak: 3, lastActive: '6 min ago' },
  { id: 'car4', signalId: 's4', name: 'deadbatteryangel', status: 'lost', streak: 1, lastActive: '31 min ago' },
  { id: 'car5', signalId: 's5', name: 'porchlightorbit', status: 'echo', streak: 7, lastActive: '40 sec ago' },
  { id: 'car6', signalId: 's1', name: 'fridgehumat3am', status: 'pulse', streak: 2, lastActive: '14 min ago' },
  PHANTOM_CARRIER,
]

function streakEmoji(streak: number) {
  if (streak >= 7) return '🔥'
  if (streak >= 3) return '💫'
  return '🌊'
}

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]
}

export default function ActiveCarriers({ onViewMap }: { onViewMap?: () => void }) {
  const [carriers, setCarriers] = useState(initialCarriers)
  const [pulsedId, setPulsedId] = useState<string | null>(null)
  const [tunedTo, setTunedTo] = useState<string[]>(() => readTuned())
  const pulseResetRef = useRef<number | null>(null)

  const toggleTuned = (name: string) => {
    setTunedTo(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
      writeTuned(next)
      return next
    })
  }

  // carriers drift between states on their own — the panel feels inhabited
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCarriers(prev => {
        const next = prev.map(c => ({ ...c }))
        const mortals = next.filter(c => c.id !== 'phantom')
        const shifts = 1 + Math.floor(Math.random() * 2)
        for (let i = 0; i < shifts; i += 1) {
          const target = mortals[Math.floor(Math.random() * mortals.length)]
          target.status = pick(CARRIER_STATUSES)
          target.lastActive = pick(LAST_ACTIVE_POOL)
        }
        return next
      })
    }, 15000)
    return () => window.clearInterval(timer)
  }, [])

  // the phantom moves on its own slower clock: every 5-15 minutes
  useEffect(() => {
    let timer = 0
    const drift = () => {
      setCarriers(prev => prev.map(c => (c.id === 'phantom'
        ? { ...c, status: pick(['soft_focus', 'echo', 'lost'] as const), lastActive: pick(PHANTOM_LAST_ACTIVE) }
        : c)))
      timer = window.setTimeout(drift, (5 + Math.random() * 10) * 60 * 1000)
    }
    timer = window.setTimeout(drift, (5 + Math.random() * 10) * 60 * 1000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => () => {
    if (pulseResetRef.current !== null) window.clearTimeout(pulseResetRef.current)
  }, [])

  const sendPulse = (carrier: Carrier) => {
    setPulsedId(carrier.id)
    if (pulseResetRef.current !== null) window.clearTimeout(pulseResetRef.current)
    pulseResetRef.current = window.setTimeout(() => setPulsedId(null), 1400)
    void apiReact({ signalId: carrier.signalId, reactionType: 'here' }).then(response => {
      console.log(`[ecosphere] pulse sent to ${carrier.name}`, response)
    })
  }

  return (
    <section className="carriers-panel glass" aria-label="Active carriers">
      <div className="section-head carriers-head">
        <span className="section-kicker">active carriers</span>
        <span className="carriers-live-dot" aria-hidden="true" />
      </div>
      <ul className="carriers-list">
        {carriers.map(carrier => (
          <li key={carrier.id} className={`carrier-row carrier-row--${carrier.status}`}>
            <div className="carrier-identity">
              <span className="carrier-name">{carrier.name}</span>
              <span className="carrier-last">{carrier.lastActive}</span>
            </div>
            <span className={`carrier-status carrier-status--${carrier.status}`}>
              <i aria-hidden="true" />
              {STATUS_LABELS[carrier.status]}
            </span>
            <span className="carrier-streak" title={`${carrier.streak} night streak`}>
              {streakEmoji(carrier.streak)} {carrier.streak}
            </span>
            <div className="carrier-actions">
              <button
                type="button"
                className={tunedTo.includes(carrier.name) ? 'listening' : ''}
                onClick={() => toggleTuned(carrier.name)}
              >
                {tunedTo.includes(carrier.name) ? '◉ listening' : 'listen'}
              </button>
              <button
                type="button"
                className={pulsedId === carrier.id ? 'pulsed' : ''}
                onClick={() => sendPulse(carrier)}
              >
                {pulsedId === carrier.id ? '◉ pulsed' : 'send pulse'}
              </button>
              <button type="button" onClick={onViewMap}>view on map</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
