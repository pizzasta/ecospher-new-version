// AI vibe read — three taps (and one optional line) in, a whole node out.
//
// The `vibe-read` Edge Function asks the model to pick from the app's own
// options (it can only choose values that exist here — anything else is
// thrown away). When the function isn't deployed, the network is down or the
// answer doesn't validate, an on-device reader makes the same choices from
// the same inputs, so onboarding never stalls.

import { getOptionalSupabaseClient } from './supabase'
import { isSupabaseConfigured } from './supabase-env'
import { AVATAR_SIGILS } from './avatar'
import { PROFILE_PALETTES, GRADIENT_STYLES } from './frequencyGradient'
import type { GradientStyle } from './frequencyGradient'
import { SCENES_3D, isScene3D } from './scene3d'
import type { Scene3D } from './scene3d'
import { LIVE_CHANNELS } from './liveChannel'
import { moderatePublicSignalText } from './signalModeration'

export const VIBE_QUESTIONS = [
  { id: 'hour', prompt: 'when do you feel most like yourself?', options: ['midnight', '3am', 'dawn', 'golden hour'] },
  { id: 'weather', prompt: 'what’s the weather in your head?', options: ['rain', 'static', 'clear sky', 'storm'] },
  { id: 'need', prompt: 'tonight you want to…', options: ['be heard', 'just listen', 'disappear', 'find someone'] },
] as const

export type VibeAnswers = { hour?: string; weather?: string; need?: string }

export type VibeResult = {
  mood: 'tender' | 'restless' | 'numb' | 'hopeful' | 'heavy'
  energy: 'dormant' | 'low' | 'awake'
  drift: 'still' | 'drifting' | 'wandering'
  aura: 'dim' | 'warm' | 'burning'
  stability: 'stable' | 'wavering' | 'breaking'
  sigil: string
  paletteId: string
  style: GradientStyle
  scene3d: Scene3D
  /** live channel id or 'feed' */
  firstStop: string
  /** one or two lines, second person, lowercase */
  reading: string
  source: 'ai' | 'local'
}

const MOODS = ['tender', 'restless', 'numb', 'hopeful', 'heavy'] as const
const ENERGIES = ['dormant', 'low', 'awake'] as const
const DRIFTS = ['still', 'drifting', 'wandering'] as const
const AURAS = ['dim', 'warm', 'burning'] as const
const STABILITIES = ['stable', 'wavering', 'breaking'] as const

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  (list as readonly string[]).includes(v as string) ? (v as T) : fallback

/** Everything the model is allowed to choose from. */
export function vibeOptions() {
  return {
    mood: MOODS, energy: ENERGIES, drift: DRIFTS, aura: AURAS, stability: STABILITIES,
    sigil: AVATAR_SIGILS.map(s => s.id).filter(id => id !== 'hz'),
    paletteId: PROFILE_PALETTES.map(p => p.id),
    style: GRADIENT_STYLES.map(s => s.value),
    scene3d: SCENES_3D.map(s => s.id).filter(id => id !== 'none'),
    firstStop: [...LIVE_CHANNELS.map(c => c.id), 'feed'],
  }
}

/** Keep only answers to our own questions, from our own options. */
export function cleanAnswers(a: VibeAnswers): VibeAnswers {
  const out: VibeAnswers = {}
  for (const q of VIBE_QUESTIONS) {
    const v = a[q.id]
    if (v && (q.options as readonly string[]).includes(v)) out[q.id] = v
  }
  return out
}

/** Validate a model reply against the real options; null if anything is off. */
export function validateVibe(raw: unknown): VibeResult | null {
  const r = raw as Partial<Record<keyof VibeResult, unknown>> | null
  if (!r || typeof r !== 'object') return null
  const o = vibeOptions()
  const inList = (list: readonly string[], v: unknown) => typeof v === 'string' && list.includes(v)
  if (!inList(o.mood, r.mood) || !inList(o.sigil, r.sigil) || !inList(o.paletteId, r.paletteId)
    || !inList(o.style, r.style) || !inList(o.scene3d, r.scene3d) || !inList(o.firstStop, r.firstStop)) return null
  const reading = typeof r.reading === 'string' ? r.reading.trim().replace(/\s+/g, ' ').slice(0, 180).toLowerCase() : ''
  if (!reading || moderatePublicSignalText(reading).status === 'flagged') return null
  return {
    mood: r.mood as VibeResult['mood'],
    energy: pick(ENERGIES, r.energy, 'low'),
    drift: pick(DRIFTS, r.drift, 'drifting'),
    aura: pick(AURAS, r.aura, 'warm'),
    stability: pick(STABILITIES, r.stability, 'wavering'),
    sigil: r.sigil as string,
    paletteId: r.paletteId as string,
    style: r.style as GradientStyle,
    scene3d: isScene3D(r.scene3d) ? r.scene3d : 'deep-space',
    firstStop: r.firstStop as string,
    reading,
    source: 'ai',
  }
}

// ─── on-device reader ────────────────────────────────────────────────────────

const LINE_MOODS: Array<[RegExp, VibeResult['mood']]> = [
  [/\b(miss|gone|lost|alone|lonely|empty|goodbye|cry|grief|left)\b/, 'heavy'],
  [/\b(can'?t sleep|awake|wired|anxious|restless|racing|loud)\b/, 'restless'],
  [/\b(numb|nothing|blank|tired|whatever|fine)\b/, 'numb'],
  [/\b(hope|better|soon|new|start|thank|grateful|excited)\b/, 'hopeful'],
  [/\b(love|soft|warm|care|gentle|close)\b/, 'tender'],
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h)
}

export function localVibeRead(answers: VibeAnswers, line = ''): VibeResult {
  const a = cleanAnswers(answers)
  const text = line.toLowerCase()
  const fromLine = LINE_MOODS.find(([re]) => re.test(text))?.[1]
  const mood: VibeResult['mood'] = fromLine
    ?? (a.weather === 'rain' ? 'tender' : a.weather === 'storm' ? 'restless' : a.weather === 'static' ? 'numb' : a.weather === 'clear sky' ? 'hopeful' : 'tender')
  const energy: VibeResult['energy'] = a.hour === '3am' ? 'awake' : a.hour === 'dawn' ? 'dormant' : 'low'
  const drift: VibeResult['drift'] = a.need === 'disappear' ? 'still' : a.need === 'find someone' ? 'wandering' : 'drifting'
  const aura: VibeResult['aura'] = a.need === 'be heard' ? 'burning' : a.need === 'disappear' ? 'dim' : 'warm'
  const stability: VibeResult['stability'] = a.weather === 'storm' || a.weather === 'static' ? 'breaking' : a.weather === 'clear sky' ? 'stable' : 'wavering'

  const scene3d: Scene3D = a.weather === 'rain' ? 'rain-city' : a.weather === 'storm' ? 'wormhole'
    : a.hour === 'golden hour' ? 'synth-grid' : a.hour === 'dawn' ? 'aurora-sea' : 'deep-space'
  const style: GradientStyle = a.weather === 'rain' ? 'rain' : a.weather === 'storm' ? 'tunnel' : a.weather === 'static' ? 'mesh' : a.hour === 'dawn' ? 'aurora' : 'stars'
  const paletteId = ({ tender: 'rose', restless: 'ultraviolet', numb: 'slate', hopeful: 'seaglass', heavy: 'afterhours' } as const)[mood]
  const sigils: Record<VibeResult['mood'], string[]> = {
    tender: ['bloom', 'eye', 'wave'], restless: ['spark', 'comet', 'rift'], numb: ['static', 'void', 'hex'],
    hopeful: ['orbit', 'gem', 'tide'], heavy: ['loop', 'antenna', 'void'],
  }
  const seed = hash(`${a.hour}|${a.weather}|${a.need}|${text}`)
  const sigil = sigils[mood][seed % 3]
  const firstStop = a.need === 'be heard' ? 'open-mic' : a.need === 'find someone' ? 'after-hours' : a.hour === '3am' ? 'night-shift' : 'feed'

  const hourLine = a.hour === '3am' ? 'a 3am frequency' : a.hour === 'dawn' ? 'a signal that comes in right before dawn' : a.hour === 'golden hour' ? 'a golden-hour signal' : 'a midnight frequency'
  const needLine = a.need === 'be heard' ? 'you came here to say it out loud.'
    : a.need === 'just listen' ? 'you’re here to listen first. the band likes that.'
      : a.need === 'disappear' ? 'you want to vanish for a while. you can, here.'
        : a.need === 'find someone' ? 'you’re looking for someone on the same wavelength. we’ll ping you when they’re up.'
          : 'the grid will learn you as you go.'
  const reading = `you read as ${hourLine}: ${mood}, ${energy === 'awake' ? 'wide awake' : energy === 'dormant' ? 'half asleep' : 'low and steady'}. ${needLine}`

  return { mood, energy, drift, aura, stability, sigil, paletteId, style, scene3d, firstStop, reading, source: 'local' }
}

/** Ask the AI first; fall back on-device. Never throws. */
export async function readVibe(answers: VibeAnswers, line = '', timeoutMs = 9000): Promise<VibeResult> {
  const a = cleanAnswers(answers)
  const cleanLine = line.trim().replace(/\s+/g, ' ').slice(0, 140)
  const safeLine = cleanLine && moderatePublicSignalText(cleanLine).status !== 'flagged' ? cleanLine : ''
  if (isSupabaseConfigured) {
    const client = getOptionalSupabaseClient()
    if (client) {
      try {
        const call = client.functions.invoke<{ vibe?: unknown }>('vibe-read', { body: { answers: a, line: safeLine, options: vibeOptions() } })
        const timeout = new Promise<null>(resolve => window.setTimeout(() => resolve(null), timeoutMs))
        const res = await Promise.race([call, timeout])
        const valid = res && !res.error ? validateVibe(res.data?.vibe) : null
        if (valid) return valid
      } catch { /* fall through to the on-device reader */ }
    }
  }
  return localVibeRead(a, safeLine)
}
