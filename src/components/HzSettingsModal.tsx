import { useState } from 'react'
import type { CSSProperties } from 'react'
import { HZ_NAME_MAX, HZ_PRESET_COLORS, recalcHzSignature, updateHzSettings } from '../lib/hzSignature'
import type { HzProfile } from '../lib/hzSignature'
import './hz.css'

type HzSettingsModalProps = {
  profile: HzProfile
  onChange: (next: HzProfile) => void
  onClose: () => void
}

/** Owner-only settings: display name, preset color, manual Hz recalc. */
export default function HzSettingsModal({ profile, onChange, onClose }: HzSettingsModalProps) {
  const [name, setName] = useState(profile.displayName ?? '')
  const [color, setColor] = useState(profile.color)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const error = await updateHzSettings(name, color)
    setBusy(false)
    if (error) { setNote(error); return }
    onChange({ ...profile, displayName: name.trim() || null, color })
    onClose()
  }

  const recalc = async () => {
    setBusy(true)
    const hz = await recalcHzSignature()
    setBusy(false)
    onChange({ ...profile, hz })
    setNote(`recalculated · ${hz.toFixed(1)} Hz`)
  }

  return (
    <div className="hz-modal-overlay" role="dialog" aria-label="Hz signature settings">
      <div className="hz-modal" style={{ '--hz-color': color } as CSSProperties}>
        <div className="hz-modal-head">
          <span>hz signature</span>
          <button type="button" onClick={onClose}>close</button>
        </div>

        <div className="hz-modal-value">
          <strong>{profile.hz.toFixed(1)} Hz</strong>
          <div className="hz-preview" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} style={{ height: `${20 + ((Math.round(profile.hz * 10) * (i + 3)) % 70)}%` }} />
            ))}
          </div>
        </div>

        <label className="hz-field">
          <span>display name (optional)</span>
          <input
            type="text"
            value={name}
            maxLength={HZ_NAME_MAX}
            placeholder="e.g. driftwave"
            onChange={e => setName(e.target.value)}
          />
        </label>

        <div className="hz-field">
          <span>waveform color</span>
          <div className="hz-colors" role="radiogroup" aria-label="Waveform color">
            {HZ_PRESET_COLORS.map(preset => (
              <button
                key={preset.value}
                type="button"
                role="radio"
                aria-checked={color === preset.value}
                title={preset.name}
                className={`hz-color-swatch${color === preset.value ? ' active' : ''}`}
                style={{ '--swatch': preset.value } as CSSProperties}
                onClick={() => setColor(preset.value)}
              />
            ))}
          </div>
        </div>

        {note && <p className="hz-note" role="status">{note}</p>}

        <div className="hz-modal-actions">
          <button type="button" disabled={busy} onClick={() => { void save() }}>save</button>
          <button type="button" disabled={busy} onClick={() => { void recalc() }}>recalculate hz</button>
        </div>
      </div>
    </div>
  )
}
