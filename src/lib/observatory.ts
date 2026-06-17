// The Observatory: the Nocturne Band rendered as a living thing. Everything
// here is aggregate and deterministic — seeded by the day + hour — or driven by
// anonymous live presence. Nothing identifies a person; these are readings of
// the band as a whole, the way you'd read weather, not a feed of who's doing
// what.

function hash(key: string): number {
  let h = 7
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 0x7fffffff
  return h
}

function dayOf(now: number): number { return Math.floor(now / 86400000) }

function hourFloat(now: number): number {
  const d = new Date(now)
  return d.getHours() + d.getMinutes() / 60
}

// circular distance between two points on a 24h clock
function clockDist(a: number, b: number): number {
  const d = Math.abs(a - b)
  return Math.min(d, 24 - d)
}

/** Activity 0..1 at a given hour: a curve that swells after midnight and
 *  peaks around 3am, with a smaller dusk bump, plus gentle per-day jitter. */
export function bandActivityAt(hour: number, now = Date.now()): number {
  const main = Math.exp(-(clockDist(hour, 3) ** 2) / (2 * 3.4 * 3.4))
  const dusk = 0.55 * Math.exp(-(clockDist(hour, 22) ** 2) / (2 * 2 * 2))
  const jitter = ((hash(`${dayOf(now)}-${Math.floor(hour)}`) % 18) - 9) / 100
  return Math.max(0.05, Math.min(1, 0.06 + 0.9 * Math.max(main, dusk) + jitter))
}

export interface WavePoint { hour: number; value: number }

/** 24 hourly samples of the band's breathing, for the activity wave. */
export function nightlyWave(now = Date.now()): WavePoint[] {
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, value: bandActivityAt(h, now) }))
}

/** The band's activity right now (0..1), interpolated through the minutes. */
export function bandNow(now = Date.now()): number {
  return bandActivityAt(hourFloat(now), now)
}

/** rising before the peak, peaking near 3am, fading after. */
export function bandPhase(now = Date.now()): 'rising' | 'peaking' | 'fading' | 'resting' {
  const h = hourFloat(now)
  if (bandNow(now) < 0.18) return 'resting'
  if (clockDist(h, 3) < 0.8) return 'peaking'
  // before peak on the clock (22→3 wrapping) is rising
  const rising = (h >= 21) || (h < 3)
  return rising ? 'rising' : 'fading'
}

// ─── signal weather ───────────────────────────────────────────────────────────

export interface Weather { id: string; label: string; glyph: string; note: string }

const WEATHER: Weather[] = [
  { id: 'clear', label: 'clear band', glyph: '◯', note: 'signals carry far tonight' },
  { id: 'static', label: 'static drizzle', glyph: '∴', note: 'a little interference on the low end' },
  { id: 'fog', label: 'low fog', glyph: '≋', note: 'frequencies blur into each other' },
  { id: 'aurora', label: 'aurora wash', glyph: '∿', note: 'color bleeding across the band' },
  { id: 'calm', label: 'dead calm', glyph: '·', note: 'barely anyone transmitting' },
]

const STORM: Weather = { id: 'storm', label: 'resonance storm', glyph: '≈', note: 'replays spreading fast across the band' }

/** Deterministic per ~hour; a live replay storm overrides everything. */
export function signalWeather(now = Date.now(), stormy = false): Weather {
  if (stormy) return STORM
  const d = new Date(now)
  const seed = hash(`${dayOf(now)}-${d.getHours()}`)
  if (bandNow(now) < 0.15) return WEATHER[4] // dead calm in the quiet hours
  return WEATHER[seed % WEATHER.length]
}

// ─── collective mood ──────────────────────────────────────────────────────────

export const MOOD_SPECTRUM = ['tender', 'restless', 'numb', 'hopeful', 'heavy'] as const

export interface MoodReading { value: number; label: string }

/** A single aggregate reading along the spectrum — never per-person. */
export function collectiveMood(now = Date.now()): MoodReading {
  const base = (hash(`mood-${dayOf(now)}`) % 100) / 100
  // the deep hours pull the band toward the tender / heavy ends
  const h = hourFloat(now)
  const pull = clockDist(h, 3) < 4 ? (base < 0.5 ? -0.12 : 0.12) : 0
  const value = Math.max(0, Math.min(1, base + pull))
  const label = MOOD_SPECTRUM[Math.round(value * (MOOD_SPECTRUM.length - 1))]
  return { value, label }
}

// ─── live indicators ──────────────────────────────────────────────────────────

export interface BandIndicator { id: string; label: string; value: string; sub?: string }

function minutesToPeak(now: number): number {
  const h = hourFloat(now)
  // next 3am
  let diff = 3 - h
  if (diff <= 0) diff += 24
  return Math.round(diff * 60)
}

/** The night's peak band pressure (the loudest the band gets tonight). */
export function peakPressure(now = Date.now()): number {
  const peak = Math.max(...nightlyWave(now).map(p => p.value))
  return Math.round(40 + peak * 55)
}

// ─── almanac: last night vs tonight ───────────────────────────────────────────

export interface AlmanacSide { mood: string; weather: string; pressure: number }
export interface Almanac { tonight: AlmanacSide; lastNight: AlmanacSide; line: string }

/** A gentle comparison of the band, yesterday vs today — both deterministic. */
export function bandAlmanac(now = Date.now()): Almanac {
  const yest = now - 86400000
  const tonight: AlmanacSide = { mood: collectiveMood(now).label, weather: signalWeather(now).label, pressure: peakPressure(now) }
  const lastNight: AlmanacSide = { mood: collectiveMood(yest).label, weather: signalWeather(yest).label, pressure: peakPressure(yest) }
  const dp = tonight.pressure - lastNight.pressure
  const fullness = dp > 3 ? 'busier than last night' : dp < -3 ? 'quieter than last night' : 'about as full as last night'
  const moodLine = tonight.mood === lastNight.mood ? `still ${tonight.mood}` : `${lastNight.mood} → ${tonight.mood}`
  return { tonight, lastNight, line: `${fullness} · ${moodLine}` }
}

/** Five-to-seven readings that make the band feel alive, anonymity intact. */
export function bandIndicators(now = Date.now(), opts: { carriers?: number; stormy?: boolean } = {}): BandIndicator[] {
  const a = bandNow(now)
  const seed = hash(`band-${dayOf(now)}`)
  const h = new Date(now).getHours()
  const deep = h >= 0 && h < 5
  const carriers = opts.carriers != null && opts.carriers > 0 ? opts.carriers : Math.floor(8 + a * 46)
  // replay heat reads as a word, not a fabricated "N per hour" number
  const heat = opts.stormy ? 'storming' : a >= 0.66 ? 'high' : a >= 0.33 ? 'building' : 'low'

  return [
    { id: 'carriers', label: 'carriers adrift', value: String(carriers), sub: 'here in the dark right now' },
    { id: 'pressure', label: 'band pressure', value: `${Math.round(40 + a * 55)}%`, sub: 'how full it’s getting' },
    { id: 'peak', label: 'deepest hour', value: deep ? 'now' : `${minutesToPeak(now)}m`, sub: deep ? 'you’re in it' : 'till the band crests' },
    { id: 'current', label: 'drift current', value: ['east', 'north', 'outward', 'west'][seed % 4], sub: 'the way it’s drifting' },
    { id: 'heat', label: 'replay heat', value: heat, sub: 'echoes catching echoes' },
    { id: 'fade', label: 'fade rate', value: ['slow', 'steady', 'quick'][seed % 3], sub: 'before it all dissolves' },
  ]
}
