import { useState } from 'react'
import type { CSSProperties } from 'react'
import { GRADIENT_SPEEDS, GRADIENT_STYLES, gradientColorsForHz, resolveGradientColors, saveGradientSettings } from '../lib/frequencyGradient'
import type { GradientSettings } from '../lib/frequencyGradient'
import './hz.css'

type FrequencyGradientModalProps = {
  settings: GradientSettings
  hz: number
  onChange: (next: GradientSettings) => void
  onClose: () => void
}

/** Owner-only background settings: color lock, angle, drift speed. */
export default function FrequencyGradientModal({ settings, hz, onChange, onClose }: FrequencyGradientModalProps) {
  const [draft, setDraft] = useState<GradientSettings>(settings)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const autoColors = gradientColorsForHz(hz)
  const [previewStart, previewEnd] = resolveGradientColors(draft, hz)
  const previewAngle = draft.angle ?? 135

  const patch = (next: Partial<GradientSettings>) => setDraft(prev => ({ ...prev, ...next }))

  const save = async () => {
    setBusy(true)
    const error = await saveGradientSettings(draft)
    setBusy(false)
    if (error) { setNote(error); return }
    onChange(draft)
    onClose()
  }

  return (
    <div className="hz-modal-overlay" role="dialog" aria-label="Background gradient settings">
      <div className="hz-modal">
        <div className="hz-modal-head">
          <span>frequency gradient</span>
          <button type="button" onClick={onClose}>close</button>
        </div>

        <div
          className="fg-preview"
          aria-hidden="true"
          style={{ background: `linear-gradient(${previewAngle}deg, ${previewStart}, ${previewEnd})` } as CSSProperties}
        />

        <div className="hz-field">
          <span>design</span>
          <div className="fg-speeds" role="radiogroup" aria-label="Background design">
            {GRADIENT_STYLES.map(option => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={draft.style === option.value}
                className={`fg-speed${draft.style === option.value ? ' active' : ''}`}
                onClick={() => patch({ style: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hz-field fg-row">
          <span>color lock — {draft.locked ? 'manual colors' : `auto from ${hz.toFixed(1)} Hz`}</span>
          <button
            type="button"
            className={`toggle ${draft.locked ? 'on' : ''}`}
            aria-pressed={draft.locked}
            onClick={() => patch({
              locked: !draft.locked,
              colorStart: !draft.locked ? (draft.colorStart ?? autoColors[0]) : draft.colorStart,
              colorEnd: !draft.locked ? (draft.colorEnd ?? autoColors[1]) : draft.colorEnd,
            })}
          />
        </div>

        {draft.locked && (
          <div className="fg-colors">
            <label className="hz-field">
              <span>start</span>
              <input type="color" value={draft.colorStart ?? autoColors[0]} onChange={e => patch({ colorStart: e.target.value })} />
            </label>
            <label className="hz-field">
              <span>end</span>
              <input type="color" value={draft.colorEnd ?? autoColors[1]} onChange={e => patch({ colorEnd: e.target.value })} />
            </label>
          </div>
        )}

        <div className="hz-field fg-row">
          <span>drift — {draft.angle == null ? 'rotating' : 'pinned angle'}</span>
          <button
            type="button"
            className={`toggle ${draft.angle == null ? 'on' : ''}`}
            aria-pressed={draft.angle == null}
            onClick={() => patch({ angle: draft.angle == null ? 135 : null })}
          />
        </div>

        {draft.angle != null ? (
          <label className="hz-field">
            <span>angle · {draft.angle}°</span>
            <input
              type="range"
              min={0}
              max={360}
              value={draft.angle}
              onChange={e => patch({ angle: Number(e.target.value) })}
            />
          </label>
        ) : (
          <div className="hz-field">
            <span>drift speed</span>
            <div className="fg-speeds" role="radiogroup" aria-label="Drift speed">
              {GRADIENT_SPEEDS.map(speed => (
                <button
                  key={speed.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.speed === speed.value}
                  className={`fg-speed${draft.speed === speed.value ? ' active' : ''}`}
                  onClick={() => patch({ speed: speed.value })}
                >
                  {speed.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {note && <p className="hz-note" role="status">{note}</p>}

        <div className="hz-modal-actions">
          <button type="button" disabled={busy} onClick={() => { void save() }}>save</button>
        </div>
      </div>
    </div>
  )
}
