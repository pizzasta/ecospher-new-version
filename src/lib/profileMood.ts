// Emotional atmosphere: the feeling a profile gives off. Eight soft dimensions
// the owner tunes — each maps to CSS variables that drive drift, glow, grain,
// flicker, decay, and fade across their page. The point is that even an empty
// profile feels emotionally occupied: a frequency someone left open at night.
//
// Stored as { fieldId: optionValue }; anything unset falls back to a calm,
// late-night default. moodToVars() turns a selection into the CSS custom
// properties the hub + onboarding read.

export interface MoodOption { value: string; label: string }

export interface MoodField {
  id: string
  label: string
  hint: string
  /** ordered options, low → high intensity */
  options: MoodOption[]
  /** css vars for the option at this index */
  vars: (index: number) => Record<string, string>
}

export type Mood = Record<string, string>

const TINTS: Record<string, [string, string]> = {
  // deliberately desaturated — dusty, washed, faded-screen colors
  tender:   ['#b9889b', '#7d6e8f'],
  restless: ['#a87f93', '#6f7a93'],
  numb:     ['#828c9b', '#5d6675'],
  hopeful:  ['#7fa6b4', '#6d7f9b'],
  heavy:    ['#6a6f93', '#4a4f6e'],
}

export const MOOD_FIELDS: MoodField[] = [
  {
    id: 'mood', label: 'signal mood', hint: 'the color of the feeling',
    options: [
      { value: 'tender', label: 'tender' },
      { value: 'restless', label: 'restless' },
      { value: 'numb', label: 'numb' },
      { value: 'hopeful', label: 'hopeful' },
      { value: 'heavy', label: 'heavy' },
    ],
    vars: i => {
      const key = ['tender', 'restless', 'numb', 'hopeful', 'heavy'][i] ?? 'tender'
      const [a, b] = TINTS[key]
      return { '--mood-tint': a, '--mood-tint-2': b }
    },
  },
  {
    id: 'drift', label: 'drift intensity', hint: 'how much the world moves',
    options: [
      { value: 'still', label: 'still' },
      { value: 'drifting', label: 'drifting' },
      { value: 'wandering', label: 'wandering' },
    ],
    vars: i => ({ '--mood-drift': ['0s', '120s', '64s'][i] ?? '120s', '--mood-drift-dist': ['0px', '10px', '22px'][i] ?? '10px' }),
  },
  {
    id: 'aura', label: 'replay aura', hint: 'the glow left by what you replay',
    options: [
      { value: 'dim', label: 'dim' },
      { value: 'warm', label: 'warm' },
      { value: 'burning', label: 'burning' },
    ],
    vars: i => ({ '--mood-glow': ['0.10', '0.24', '0.42'][i] ?? '0.24' }),
  },
  {
    id: 'decay', label: 'echo decay', hint: 'how long an echo lingers',
    options: [
      { value: 'sharp', label: 'sharp' },
      { value: 'soft', label: 'soft' },
      { value: 'long', label: 'long' },
    ],
    vars: i => ({ '--mood-trail': ['2.4s', '5s', '9s'][i] ?? '5s' }),
  },
  {
    id: 'energy', label: 'nighttime energy', hint: 'how awake your signal feels',
    options: [
      { value: 'dormant', label: 'dormant' },
      { value: 'low', label: 'low' },
      { value: 'awake', label: 'awake' },
    ],
    vars: i => ({ '--mood-pulse': ['9s', '6s', '3.4s'][i] ?? '6s' }),
  },
  {
    id: 'stability', label: 'signal stability', hint: 'steady, or breaking up',
    options: [
      { value: 'stable', label: 'stable' },
      { value: 'wavering', label: 'wavering' },
      { value: 'breaking', label: 'breaking' },
    ],
    vars: i => ({ '--mood-flicker': ['0', '0.05', '0.12'][i] ?? '0.05' }),
  },
  {
    id: 'fade', label: 'memory fade speed', hint: 'how fast overlays let go',
    options: [
      { value: 'slow', label: 'slow' },
      { value: 'medium', label: 'medium' },
      { value: 'quick', label: 'quick' },
    ],
    vars: i => ({ '--mood-fade': ['14s', '9s', '5s'][i] ?? '9s' }),
  },
  {
    id: 'silence', label: 'silence preference', hint: 'how much quiet you keep',
    options: [
      { value: 'open', label: 'open' },
      { value: 'quiet', label: 'quiet' },
      { value: 'silent', label: 'silent' },
    ],
    vars: i => ({ '--mood-density': ['1', '0.6', '0.3'][i] ?? '0.6' }),
  },
]

/** A curated subset surfaced during onboarding; the full set lives in the hub. */
export const ONBOARD_MOOD_FIELDS = ['mood', 'drift', 'aura', 'stability']

const MOOD_KEY = 'ecosphere:profileMood'

export const DEFAULT_MOOD: Mood = {
  mood: 'tender', drift: 'drifting', aura: 'warm', decay: 'soft',
  energy: 'low', stability: 'wavering', fade: 'medium', silence: 'quiet',
}

export function readMood(): Mood {
  try {
    const raw = JSON.parse(window.localStorage.getItem(MOOD_KEY) ?? 'null') as Mood | null
    return raw && typeof raw === 'object' ? { ...DEFAULT_MOOD, ...raw } : { ...DEFAULT_MOOD }
  } catch { return { ...DEFAULT_MOOD } }
}

export function saveMood(mood: Mood): void {
  try { window.localStorage.setItem(MOOD_KEY, JSON.stringify(mood)) } catch { /* session only */ }
}

/** Turn a mood selection into the CSS variables the hub + onboarding read. */
export function moodToVars(mood: Mood): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const field of MOOD_FIELDS) {
    const value = mood[field.id] ?? DEFAULT_MOOD[field.id]
    const index = Math.max(0, field.options.findIndex(o => o.value === value))
    Object.assign(vars, field.vars(index))
  }
  return vars
}
