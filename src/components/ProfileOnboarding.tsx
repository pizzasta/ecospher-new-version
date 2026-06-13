import { useState } from 'react'
import type { CSSProperties } from 'react'
import { AVATAR_SIGILS, saveAvatar, readAvatar, sigilGlyph } from '../lib/avatar'
import {
  GRADIENT_STYLES, PROFILE_PALETTES, DEFAULT_GRADIENT, SCENE_STYLES, saveGradientSettings,
} from '../lib/frequencyGradient'
import type { GradientStyle, GradientSettings } from '../lib/frequencyGradient'
import { MOOD_FIELDS, ONBOARD_MOOD_FIELDS, readMood, saveMood, moodToVars } from '../lib/profileMood'
import type { Mood } from '../lib/profileMood'
import { castFrequency } from '../lib/frequencyOracle'
import ProfileScene from './ProfileScene'
import ColorWave from './ColorWave'
import './ProfileOnboarding.css'

// First-time profile setup, reframed as tuning into a hidden late-night
// frequency rather than filling out a form. Drifting carrier names, dim pulses,
// fog and grain underneath; a live, faded preview; softer, more human copy.
// Saves the same gradient/avatar/mood the hub reads. Remembered on-device.

const ONBOARD_KEY = 'ecosphere:profileOnboarded'

export function profileOnboarded(): boolean {
  try { return window.localStorage.getItem(ONBOARD_KEY) === 'yes' } catch { return false }
}

export function markProfileOnboarded(): void {
  try { window.localStorage.setItem(ONBOARD_KEY, 'yes') } catch { /* session only */ }
}

const ACTIVITY_KEYS = [
  'ecosphere:gradientSettings', 'ecosphere:avatar', 'ecosphere:tapeIntro', 'ecosphere:hubBoard',
  'ecosphere:voicePrompts', 'ecosphere:preservedSignals', 'ecosphere:relicActivity',
  'ecosphere:chainLayers', 'ecosphere:seaLines', 'ecosphere:driftFound', 'ecosphere:podPulses',
]

function hasPriorActivity(): boolean {
  try {
    for (const key of ACTIVITY_KEYS) {
      const v = window.localStorage.getItem(key)
      if (v && v !== 'null' && v !== '[]' && v !== '{}' && v !== '0' && v !== '') return true
    }
    return false
  } catch { return false }
}

export function shouldAutoOnboard(): boolean {
  if (profileOnboarded()) return false
  if (hasPriorActivity()) { markProfileOnboarded(); return false }
  return true
}

// faint anonymous carriers that drift past while you tune in
const DRIFTERS = [
  'carrier 3:14', 'signal_veil', 'anon 04:48', 'lost_carrier', 'someone awake',
  'drift channel', 'nocturne_7', 'anon 02:09', 'a quiet listener',
]

const STEPS = 5

export default function ProfileOnboarding({ onDone, accentColor = '#b9889b' }: { onDone: () => void; accentColor?: string }) {
  const [step, setStep] = useState(0)
  const [sigil, setSigil] = useState(() => readAvatar())
  const [paletteId, setPaletteId] = useState(PROFILE_PALETTES[0].id)
  const [style, setStyle] = useState<GradientStyle>('aurora')
  const [mood, setMood] = useState<Mood>(() => readMood())

  const palette = PROFILE_PALETTES.find(p => p.id === paletteId) ?? PROFILE_PALETTES[0]
  const colors: [string, string, string] = [palette.start, palette.end, accentColor]
  const moodVars = moodToVars(mood)
  const [oracle, setOracle] = useState<string | null>(null)

  // let the band tune you — one tap casts sigil, colors, space, and mood
  const letFrequencyChoose = () => {
    const cast = castFrequency(Date.now())
    setSigil(cast.sigil); setPaletteId(cast.paletteId); setStyle(cast.style); setMood(cast.mood)
    setOracle(`tuned to ${cast.hz} Hz · ${cast.flavor}`)
  }

  const finish = () => {
    saveAvatar(sigil)
    saveMood(mood)
    const settings: GradientSettings = {
      ...DEFAULT_GRADIENT, locked: true, colorStart: palette.start, colorEnd: palette.end, style, speed: 60,
    }
    void saveGradientSettings(settings)
    markProfileOnboarded()
    onDone()
  }

  const skip = () => { markProfileOnboarded(); onDone() }

  const preview = (
    <div className="po-preview atmo-grain" style={{ '--po-c1': palette.start, '--po-c2': palette.end } as CSSProperties}>
      {style === 'gradient' ? (
        <div className="po-preview-flat" style={{ background: `linear-gradient(135deg, ${palette.start}, ${palette.end})` }} />
      ) : style === 'wave' ? (
        <ColorWave variant="local" colors={colors} />
      ) : (
        <ProfileScene design={style} colors={colors} />
      )}
      {/* faded scrim + soft bloom so the preview reads muted and cinematic, not neon */}
      <div className="po-preview-wash" aria-hidden="true" />
      <span className="po-preview-sigil atmo-breathe" style={{ color: palette.end }}>{sigilGlyph(sigil) || 'hz'}</span>
    </div>
  )

  return (
    <div className="po-overlay" role="dialog" aria-modal="true" aria-label="Tune in your profile" style={moodVars as CSSProperties}>
      {/* atmosphere underneath: fog, dim pulses, drifting carriers */}
      <div className="atmo-fog" aria-hidden="true"><span /><span /><span /></div>
      <div className="po-pulses" aria-hidden="true">
        <span className="atmo-pulse" style={{ left: '18%', top: '24%' }} />
        <span className="atmo-pulse" style={{ left: '78%', top: '38%', animationDelay: '-3s' }} />
        <span className="atmo-pulse" style={{ left: '60%', top: '74%', animationDelay: '-5s' }} />
      </div>
      <div className="po-drifters" aria-hidden="true">
        {DRIFTERS.map((name, i) => (
          <em key={name} style={{ top: `${8 + (i * 11) % 84}%`, animationDelay: `${-(i * 4.5)}s`, animationDuration: `${34 + (i % 4) * 9}s` }}>
            {name}
          </em>
        ))}
      </div>

      <div className="po-panel atmo-soft-panel atmo-grain">
        <header className="po-head">
          <span className="po-kicker">tuning you in</span>
          <div className="po-dots" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, d) => <i key={d} className={d === step ? 'on' : d < step ? 'done' : ''} />)}
          </div>
          <button type="button" className="po-skip" onClick={skip}>skip</button>
        </header>

        {preview}

        <div className="po-oracle">
          <button type="button" className="po-oracle-btn" onClick={letFrequencyChoose}>✦ let the frequency choose</button>
          {oracle && <span className="po-oracle-flavor">{oracle}</span>}
        </div>

        <div className="po-body">
          {step === 0 && (
            <>
              <h2>the mark people will know you by</h2>
              <p>no photos here, ever. just a shape that feels like you when someone tunes in.</p>
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
              <h2>the color you give off</h2>
              <p>a mood for your whole page — washed and dim, the way late screens look. change it any night.</p>
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
              <h2>where you drift</h2>
              <p>the world behind you when someone finds your frequency.</p>
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
              <h2>how your signal feels</h2>
              <p>even when you're quiet, this is the feeling you leave on. it shapes how your page drifts, glows, and fades.</p>
              <div className="po-moods">
                {MOOD_FIELDS.filter(f => ONBOARD_MOOD_FIELDS.includes(f.id)).map(field => (
                  <div key={field.id} className="po-mood-field">
                    <span className="po-mood-label">{field.label}</span>
                    <div className="po-mood-options" role="radiogroup" aria-label={field.label}>
                      {field.options.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={(mood[field.id] ?? '') === opt.value}
                          className={`po-mood-opt${(mood[field.id] ?? '') === opt.value ? ' active' : ''}`}
                          onClick={() => setMood(m => ({ ...m, [field.id]: opt.value }))}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2>you're on the band now</h2>
              <p>this is your frequency. quiet or loud, it stays open — someone drifting through tonight will feel it. change any of it from your page, any time.</p>
            </>
          )}
        </div>

        <footer className="po-foot">
          {step > 0 ? (
            <button type="button" className="po-back" onClick={() => setStep(s => Math.max(0, s - 1))}>back</button>
          ) : <span />}
          {step < STEPS - 1 ? (
            <button type="button" className="po-next" onClick={() => setStep(s => Math.min(STEPS - 1, s + 1))}>next</button>
          ) : (
            <button type="button" className="po-next po-finish" onClick={finish}>drift in</button>
          )}
        </footer>
      </div>
    </div>
  )
}
