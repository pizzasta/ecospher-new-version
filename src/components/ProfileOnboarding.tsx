import { useState } from 'react'
import type { CSSProperties } from 'react'
import { AVATAR_SIGILS, saveAvatar, readAvatar, sigilGlyph } from '../lib/avatar'
import {
  GRADIENT_STYLES, PROFILE_PALETTES, DEFAULT_GRADIENT, SCENE_STYLES, saveGradientSettings,
} from '../lib/frequencyGradient'
import type { GradientStyle, GradientSettings } from '../lib/frequencyGradient'
import ProfileScene from './ProfileScene'
import ColorWave from './ColorWave'
import './ProfileOnboarding.css'

// First-time profile setup: a short, skippable wizard that walks you through a
// mark, colors, and a background — with a live preview at every step. Saves the
// same settings the hub uses, so it's just a friendly front door to what's
// already customizable. Remembered on-device.

const ONBOARD_KEY = 'ecosphere:profileOnboarded'

export function profileOnboarded(): boolean {
  try { return window.localStorage.getItem(ONBOARD_KEY) === 'yes' } catch { return false }
}

export function markProfileOnboarded(): void {
  try { window.localStorage.setItem(ONBOARD_KEY, 'yes') } catch { /* session only */ }
}

type Step = 0 | 1 | 2 | 3

export default function ProfileOnboarding({ onDone, accentColor = '#00d4ff' }: { onDone: () => void; accentColor?: string }) {
  const [step, setStep] = useState<Step>(0)
  const [sigil, setSigil] = useState(() => readAvatar())
  const [paletteId, setPaletteId] = useState(PROFILE_PALETTES[0].id)
  const [style, setStyle] = useState<GradientStyle>('aurora')

  const palette = PROFILE_PALETTES.find(p => p.id === paletteId) ?? PROFILE_PALETTES[0]
  const colors: [string, string, string] = [palette.start, palette.end, accentColor]

  const finish = () => {
    saveAvatar(sigil)
    const settings: GradientSettings = {
      ...DEFAULT_GRADIENT,
      locked: true,
      colorStart: palette.start,
      colorEnd: palette.end,
      style,
      speed: 60,
    }
    void saveGradientSettings(settings)
    markProfileOnboarded()
    onDone()
  }

  const skip = () => { markProfileOnboarded(); onDone() }

  const preview = (
    <div className="po-preview" style={{ '--po-c1': palette.start, '--po-c2': palette.end } as CSSProperties}>
      {style === 'gradient' ? (
        <div className="po-preview-flat" style={{ background: `linear-gradient(135deg, ${palette.start}, ${palette.end})` }} />
      ) : style === 'wave' ? (
        <ColorWave variant="local" colors={colors} />
      ) : (
        <ProfileScene design={style} colors={colors} />
      )}
      <span className="po-preview-sigil" style={{ color: palette.end }}>{sigilGlyph(sigil) || 'hz'}</span>
    </div>
  )

  return (
    <div className="po-overlay" role="dialog" aria-modal="true" aria-label="Set up your profile">
      <div className="po-panel">
        <header className="po-head">
          <span className="po-kicker">SET UP YOUR SIGNAL</span>
          <div className="po-dots" aria-hidden="true">
            {[0, 1, 2, 3].map(d => <i key={d} className={d === step ? 'on' : d < step ? 'done' : ''} />)}
          </div>
          <button type="button" className="po-skip" onClick={skip}>skip</button>
        </header>

        {preview}

        <div className="po-body">
          {step === 0 && (
            <>
              <h2>your mark</h2>
              <p>no photos here, ever — pick a sigil that feels like you.</p>
              <div className="po-sigils" role="radiogroup" aria-label="Sigil">
                {AVATAR_SIGILS.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={sigil === s.id}
                    className={`po-sigil${sigil === s.id ? ' active' : ''}`}
                    title={s.label}
                    onClick={() => setSigil(s.id)}
                  >
                    {s.glyph || 'hz'}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2>your colors</h2>
              <p>a mood for your whole page. you can fine-tune the exact colors later.</p>
              <div className="po-palettes" role="radiogroup" aria-label="Color palette">
                {PROFILE_PALETTES.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={paletteId === p.id}
                    className={`po-palette${paletteId === p.id ? ' active' : ''}`}
                    onClick={() => setPaletteId(p.id)}
                  >
                    <span className="po-palette-swatch" style={{ background: `linear-gradient(135deg, ${p.start}, ${p.end})` }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2>your space</h2>
              <p>the world behind you. every one runs on its own — pick a vibe.</p>
              <div className="po-styles" role="radiogroup" aria-label="Background style">
                {GRADIENT_STYLES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={style === s.value}
                    className={`po-style${style === s.value ? ' active' : ''}${SCENE_STYLES.includes(s.value) ? ' is3d' : ''}`}
                    onClick={() => setStyle(s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2>your signal is set</h2>
              <p>this is your page now. you can change any of it any time from the hub — and record a ten-second intro tape when you're ready.</p>
            </>
          )}
        </div>

        <footer className="po-foot">
          {step > 0 ? (
            <button type="button" className="po-back" onClick={() => setStep((step - 1) as Step)}>back</button>
          ) : <span />}
          {step < 3 ? (
            <button type="button" className="po-next" onClick={() => setStep((step + 1) as Step)}>next</button>
          ) : (
            <button type="button" className="po-next po-finish" onClick={finish}>enter your page</button>
          )}
        </footer>
      </div>
    </div>
  )
}
