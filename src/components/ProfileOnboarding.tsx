import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AVATAR_SIGILS, saveAvatar, readAvatar, sigilGlyph } from '../lib/avatar'
import {
  GRADIENT_STYLES, PROFILE_PALETTES, DEFAULT_GRADIENT, SCENE_STYLES, saveGradientSettings,
} from '../lib/frequencyGradient'
import type { GradientStyle, GradientSettings } from '../lib/frequencyGradient'
import { MOOD_FIELDS, ONBOARD_MOOD_FIELDS, readMood, saveMood, moodToVars } from '../lib/profileMood'
import type { Mood } from '../lib/profileMood'
import { castFrequency } from '../lib/frequencyOracle'
import { castNightName } from '../lib/nightName'
import { CHIME_STYLES, playSignatureChime, readChime, saveChime } from '../lib/signatureChime'
import type { ChimeStyle } from '../lib/signatureChime'
import {
  HZ_DEFAULT_COLOR, HZ_NAME_MAX, getLocalHzProfile, isPresetColor, updateHzSettings, validateHzDisplayName,
} from '../lib/hzSignature'
import { readStatus, writeStatus } from '../lib/profileExtras'
import { moderatePublicSignalText } from '../lib/signalModeration'
import ProfileScene from './ProfileScene'
import ColorWave from './ColorWave'
import './ProfileOnboarding.css'

// First-time profile setup, reframed as tuning into a hidden late-night
// frequency rather than filling out a form. Think early MySpace — a page
// that IS you — but rebuilt for this world: instead of a photo, a top-8,
// and a profile song, you leave a mark, a name the night calls you, a
// color, a place, a feeling, a timbre, and one line of transmission.
// No points, no streaks, no rewards — the pull is that the page you're
// shaping is alive in the preview the whole time, and stays open,
// broadcasting you, after you leave. Saves the same gradient/avatar/mood/
// chime/status the hub reads. Remembered on-device.

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

// prompts for the one line you leave on the band — rotated per visit
const LINE_PROMPTS = [
  'what you’d say into the static at 3am',
  'the sentence you keep replaying',
  'something you never sent',
  'what tonight actually feels like',
  'a line for whoever finds this',
]

// step order: mark → name → color → place → feeling → timbre → line → open
const SIGIL_STEP = 0
const NAME_STEP = 1
const PALETTE_STEP = 2
const STYLE_STEP = 3
const MOOD_STEP = 4
const CHIME_STEP = 5
const LINE_STEP = 6
const STEPS = 8

export default function ProfileOnboarding({ onDone, accentColor = '#b9889b' }: { onDone: () => void; accentColor?: string }) {
  const [step, setStep] = useState(0)
  const [sigil, setSigil] = useState(() => readAvatar())
  const [name, setName] = useState(() => getLocalHzProfile('someone awake').displayName ?? '')
  const [nameError, setNameError] = useState<string | null>(null)
  const [paletteId, setPaletteId] = useState(PROFILE_PALETTES[0].id)
  const [style, setStyle] = useState<GradientStyle>('aurora')
  const [mood, setMood] = useState<Mood>(() => readMood())
  const [chime, setChime] = useState<ChimeStyle>(() => readChime())
  const [chimeHeard, setChimeHeard] = useState(false)
  const [line, setLine] = useState(() => readStatus())
  const [lineError, setLineError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const palette = PROFILE_PALETTES.find(p => p.id === paletteId) ?? PROFILE_PALETTES[0]
  const colors: [string, string, string] = [palette.start, palette.end, accentColor]
  const moodVars = moodToVars(mood)
  const [oracle, setOracle] = useState<string | null>(null)

  // the name you type shapes the frequency you preview: until real activity
  // sets a signature, your handle seeds where on the band you sit tonight
  const previewHz = useMemo(() => getLocalHzProfile(name.trim() || 'someone awake').hz, [name])
  const [linePrompt] = useState(() => LINE_PROMPTS[Math.floor(Date.now() / 60000) % LINE_PROMPTS.length])

  // let the band tune you — one tap casts sigil, colors, space, and mood
  const letFrequencyChoose = () => {
    const cast = castFrequency(Date.now())
    setSigil(cast.sigil); setPaletteId(cast.paletteId); setStyle(cast.style); setMood(cast.mood)
    setOracle(`tuned to ${cast.hz} Hz · ${cast.flavor}`)
  }

  // the name is yours alone — the oracle never sets it, but the static can offer one
  const letStaticName = () => {
    setName(castNightName(Date.now()))
    setNameError(null)
  }

  const auditionChime = (value: ChimeStyle) => {
    setChime(value)
    if (playSignatureChime(previewHz, value, 0, 1.3)) setChimeHeard(true)
  }

  const cleanName = name.trim().replace(/\s+/g, ' ')
  const cleanLine = line.trim().replace(/\s+/g, ' ').slice(0, 80)

  // both text steps are optional, but what you do leave must be able to broadcast
  const validateStep = (at: number): boolean => {
    if (at === NAME_STEP && cleanName) {
      const err = validateHzDisplayName(cleanName)
      if (err) { setNameError(err); return false }
      if (moderatePublicSignalText(cleanName).status === 'flagged') { setNameError('that name can’t go on the band'); return false }
    }
    if (at === LINE_STEP && cleanLine && moderatePublicSignalText(cleanLine).status === 'flagged') {
      setLineError('that one can’t broadcast'); return false
    }
    return true
  }

  const finish = async () => {
    if (saving) return // never let a slow save be double-submitted
    if (!validateStep(NAME_STEP) || !validateStep(LINE_STEP)) return
    setSaving(true)
    saveAvatar(sigil)
    saveMood(mood)
    saveChime(chime)
    writeStatus(cleanLine)
    const settings: GradientSettings = {
      ...DEFAULT_GRADIENT, locked: true, colorStart: palette.start, colorEnd: palette.end, style, speed: 60,
    }
    try {
      // persist the chosen background; if validation rejects it (e.g. a bad color),
      // fall back to saving the style alone so the background still applies.
      const err = await saveGradientSettings(settings)
      if (err) await saveGradientSettings({ ...DEFAULT_GRADIENT, locked: true, style })
    } catch { /* local save already applied — never trap the user in the modal */ }
    if (cleanName) {
      try {
        const current = getLocalHzProfile(cleanName)
        await updateHzSettings(cleanName, isPresetColor(current.color) ? current.color : HZ_DEFAULT_COLOR)
      } catch { /* name stays local-only tonight */ }
    }
    markProfileOnboarded()
    onDone()
  }

  const skip = () => { markProfileOnboarded(); onDone() }

  const goNext = () => {
    if (!validateStep(step)) return
    if (step < STEPS - 1) setStep(s => s + 1); else void finish()
  }
  const goBack = () => setStep(s => Math.max(0, s - 1))

  // keyboard: Escape skips, and each step moves focus inside the panel so
  // arrow keys work the radio groups and Enter advances — no mouse required
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); skip() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // land focus on the text field, the chosen option, or the primary button
    const panel = panelRef.current
    if (!panel) return
    const target = panel.querySelector<HTMLElement>('.po-body .po-input')
      ?? panel.querySelector<HTMLElement>('.po-body [aria-checked="true"]')
      ?? panel.querySelector<HTMLElement>('.po-finish')
      ?? panel.querySelector<HTMLElement>('.po-next')
    target?.focus({ preventScroll: true })
  }, [step])

  const chimeLabel = CHIME_STYLES.find(c => c.value === chime)?.label ?? 'pure'

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
      {/* frequency waveform: the signal you give off, breathing along the floor */}
      <div className="po-preview-waves" aria-hidden="true">
        {Array.from({ length: 32 }, (_, i) => (
          <i key={i} style={{ '--w-i': i, '--w-h': `${28 + ((i * 37 + 19) % 64)}%`, '--w-d': `${(i % 7) * 0.13}s` } as CSSProperties} />
        ))}
      </div>
      <span className="po-preview-sigil atmo-breathe" style={{ color: palette.end }}>{sigilGlyph(sigil) || 'hz'}</span>
      {/* the page assembling itself under your hands: name and line appear as you give them */}
      <div className="po-preview-id" aria-hidden="true">
        {cleanName && <span className="po-preview-name">{cleanName} · {previewHz.toFixed(1)} Hz</span>}
        {cleanLine && <span className="po-preview-line">“{cleanLine}”</span>}
      </div>
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
        {/* the moment you take a name, it joins the band — drifting with everyone else */}
        {cleanName && (
          <em className="po-drift-you" style={{ top: '48%', animationDuration: '30s' }}>{cleanName} · you</em>
        )}
      </div>

      <div className="po-panel atmo-soft-panel atmo-grain" ref={panelRef}>
        <header className="po-head">
          <span className="po-kicker">tuning you in</span>
          <div className="po-dots" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, d) => <i key={d} className={d === step ? 'on' : d < step ? 'done' : ''} />)}
          </div>
          <span className="po-sr-step">step {step + 1} of {STEPS}</span>
          <button type="button" className="po-skip" onClick={skip}>skip for now</button>
        </header>

        {preview}

        <div className="po-oracle">
          <button type="button" className="po-oracle-btn" onClick={letFrequencyChoose}>✦ let the frequency choose</button>
          {oracle && <span className="po-oracle-flavor">{oracle}</span>}
        </div>

        <div className="po-body">
          {step === SIGIL_STEP && (
            <>
              <h2>the mark people will know you by</h2>
              <p>no photos, ever. just a shape that feels like you.</p>
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

          {step === NAME_STEP && (
            <>
              <h2>what the night calls you</h2>
              <p>not your name — the one the band knows. leave it blank and stay a number.</p>
              <input
                type="text"
                className="po-input"
                value={name}
                maxLength={HZ_NAME_MAX}
                placeholder="e.g. quiet nocturne"
                aria-label="Night name"
                onChange={e => { setName(e.target.value); setNameError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); goNext() } }}
              />
              {nameError && <p className="po-field-error" role="alert">{nameError}</p>}
              <button type="button" className="po-static-btn" onClick={letStaticName}>⌁ let the static name you</button>
              {cleanName && (
                <p className="po-field-note">your name seeds your frequency — “{cleanName}” hums near {previewHz.toFixed(1)} Hz</p>
              )}
            </>
          )}

          {step === PALETTE_STEP && (
            <>
              <h2>the color you give off</h2>
              <p>the mood your whole page gives off. change it any night.</p>
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

          {step === STYLE_STEP && (
            <>
              <h2>where you drift</h2>
              <p>the world behind you when someone tunes in.</p>
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

          {step === MOOD_STEP && (
            <>
              <h2>how your signal feels</h2>
              <p>the feeling you leave on, even when you're quiet.</p>
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

          {step === CHIME_STEP && (
            <>
              <h2>how you sound when you answer</h2>
              <p>
                every signature has a voice. yours sits near {previewHz.toFixed(1)} Hz tonight —
                tap one to hear it, if your sound is on.
              </p>
              <div className="po-chimes" role="radiogroup" aria-label="Signature chime">
                {CHIME_STYLES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={chime === c.value}
                    className={`po-chime${chime === c.value ? ' active' : ''}`}
                    onClick={() => auditionChime(c.value)}
                  >
                    <span className="po-chime-name">{c.label}</span>
                    <span className="po-chime-hint">{c.hint}</span>
                  </button>
                ))}
              </div>
              {chimeHeard && <p className="po-field-note">that’s what the band hears when your signature travels.</p>}
            </>
          )}

          {step === LINE_STEP && (
            <>
              <h2>leave one line on the band</h2>
              <p>{linePrompt}. it broadcasts from your page until you change it. or leave the air open.</p>
              <input
                type="text"
                className="po-input"
                value={line}
                maxLength={80}
                placeholder="…"
                aria-label="Your first transmission"
                onChange={e => { setLine(e.target.value); setLineError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); goNext() } }}
              />
              {lineError && <p className="po-field-error" role="alert">{lineError}</p>}
            </>
          )}

          {step === STEPS - 1 && (
            <>
              <h2>you're on the band now</h2>
              <div className="po-signal-card" style={{ '--po-c2': palette.end } as CSSProperties}>
                <span className="po-card-sigil">{sigilGlyph(sigil) || 'hz'}</span>
                <span className="po-card-name">{cleanName || 'unclaimed frequency'}</span>
                <span className="po-card-meta">{previewHz.toFixed(1)} Hz · {chimeLabel} chime · {mood.mood ?? 'tender'}</span>
                {cleanLine && <span className="po-card-line">“{cleanLine}”</span>}
              </div>
              <p>
                your frequency stays open while you're gone. someone drifting through
                tonight will feel it — and the band sounds different after midnight.
              </p>
            </>
          )}

          {step < STEPS - 1 && (
            <p className="po-reassure">nothing here is permanent — retune any of it any night from your profile.</p>
          )}
        </div>

        <footer className="po-foot">
          {step > 0 ? (
            <button type="button" className="po-back" onClick={goBack}>back</button>
          ) : <span />}
          {step < STEPS - 1 ? (
            <button type="button" className="po-next" onClick={goNext}>next</button>
          ) : (
            <button type="button" className="po-next po-finish" onClick={() => void finish()} disabled={saving}>
              {saving ? 'tuning you in…' : 'drift in'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
