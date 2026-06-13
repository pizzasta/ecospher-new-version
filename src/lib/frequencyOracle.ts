// "Let the frequency choose." A small ritual: instead of picking every detail,
// you let the band tune you — it casts a sigil, a palette, a background, a Hz,
// and a mood all at once, with a line of flavor for where it landed you. Pure +
// deterministic per seed, so a new tap = a new cast.

import { AVATAR_SIGILS } from './avatar'
import { PROFILE_PALETTES, SCENE_STYLES } from './frequencyGradient'
import type { GradientStyle } from './frequencyGradient'
import { MOOD_FIELDS } from './profileMood'
import type { Mood } from './profileMood'

export interface FrequencyCast {
  sigil: string
  paletteId: string
  style: GradientStyle
  hz: string
  mood: Mood
  flavor: string
}

/** Poetic flavor for where on the band a frequency landed. */
export function frequencyFlavor(hzNum: number): string {
  if (hzNum < 60) return 'down in the low end, where signals go to rest'
  if (hzNum < 90) return 'the quiet band — barely anyone transmits this deep'
  if (hzNum < 120) return 'mid-band, the hour most voices drift through'
  if (hzNum < 160) return 'up where the static turns warm'
  return 'high on the band, thin air, clear and far-carrying'
}

/** Cast a whole identity from one seed. */
export function castFrequency(seed: number = Date.now()): FrequencyCast {
  const s = Math.abs(Math.floor(seed))
  const sigil = AVATAR_SIGILS[s % AVATAR_SIGILS.length].id
  const paletteId = PROFILE_PALETTES[(s >> 2) % PROFILE_PALETTES.length].id
  const style = SCENE_STYLES[(s >> 4) % SCENE_STYLES.length]
  const hzNum = 40 + (s % 1600) / 10
  const hz = hzNum.toFixed(1)
  const mood: Mood = {}
  MOOD_FIELDS.forEach((f, i) => { mood[f.id] = f.options[(s + i * 7) % f.options.length].value })
  return { sigil, paletteId, style, hz, mood, flavor: frequencyFlavor(hzNum) }
}
