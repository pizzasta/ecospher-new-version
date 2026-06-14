import { useState } from 'react'
import './AgeGate.css'

// One-time 18+ confirmation, shown before anything else and remembered on the
// device. Terms already require 18+; this makes the confirmation active rather
// than passive. No date of birth is collected or stored — just a yes/no flag.

const KEY = 'ecosphere:ageConfirmed'

export function ageConfirmed(): boolean {
  try { return window.localStorage.getItem(KEY) === 'yes' } catch { return false }
}

export default function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  const [declined, setDeclined] = useState(false)

  const confirm = () => {
    try { window.localStorage.setItem(KEY, 'yes') } catch { /* session only — re-ask next visit */ }
    onConfirm()
  }

  if (declined) {
    return (
      <div className="agegate" role="dialog" aria-modal="true" aria-label="Age check">
        <div className="agegate-card">
          <div className="agegate-glyph" aria-hidden="true">◌</div>
          <h1>come back when you're older.</h1>
          <p>ecosphere is an 18+ space. take care of yourself out there.</p>
          <button type="button" className="agegate-no" onClick={() => setDeclined(false)}>go back</button>
        </div>
      </div>
    )
  }

  return (
    <div className="agegate" role="dialog" aria-modal="true" aria-label="Age check">
      <div className="agegate-bg" aria-hidden="true"><span /><span /><span /></div>
      <div className="agegate-card">
        <div className="agegate-glyph" aria-hidden="true">◉</div>
        <span className="agegate-kicker">ECOSPHERE</span>
        <h1>are you 18 or older?</h1>
        <p>a late-night, anonymous, audio space for adults. you'll hear and share real voices. by entering you confirm you're 18 or older.</p>
        <div className="agegate-actions">
          <button type="button" className="agegate-yes" onClick={confirm}>yes — i'm 18 or older</button>
          <button type="button" className="agegate-no" onClick={() => setDeclined(true)}>i'm under 18</button>
        </div>
        <p className="agegate-fine">
          anonymous voices, ten seconds each. not a crisis service. by entering you agree to the <a href="/terms.html">terms</a> and <a href="/privacy.html">privacy policy</a>.
        </p>
      </div>
    </div>
  )
}
