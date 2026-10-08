// "Let the static name you." During onboarding you can type the name the
// night calls you — or hold the dial still and let the static offer one.
// Deterministic per seed (a new tap = a new name), and every cast satisfies
// the hz display-name rules: letters/numbers/spaces only, 20 chars max.

export const NIGHT_TONES = [
  'quiet', 'faded', 'hollow', 'violet', 'midnight', 'analog',
  'paper', 'winter', 'neon', 'low', 'sodium', 'humming',
]

export const NIGHT_THINGS = [
  'nocturne', 'vesper', 'antenna', 'static', 'drift', 'signal',
  'halcyon', 'ember', 'sonder', 'aerial', 'lumen', 'reverie',
]

/** Cast a night name from a seed. Pure — same seed, same name. */
export function castNightName(seed: number = Date.now()): string {
  // divide instead of >>: timestamp seeds overflow signed 32-bit, and a
  // negative shift result would index the word lists with a negative modulo
  const s = Math.abs(Math.floor(seed))
  const thing = NIGHT_THINGS[s % NIGHT_THINGS.length]
  const mode = Math.floor(s / 8) % 3
  if (mode === 0) return `${NIGHT_TONES[Math.floor(s / 32) % NIGHT_TONES.length]} ${thing}`
  if (mode === 1) return `${thing} ${(s % 89) + 11}` // a carrier number, e.g. "vesper 47"
  return thing
}
