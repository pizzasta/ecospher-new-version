// Frequency Gradient: profile background derived from the Hz signature,
// optionally overridden by the owner. Local-first with backend sync.

import { getOptionalSupabaseClient } from './supabase'
import { ensureBackendSession } from './session'
import { isSupabaseConfigured } from './supabase-env'

export type GradientStyle = 'gradient' | 'wave' | 'grid' | 'stars' | 'tunnel' | 'aurora' | 'rain' | 'mesh' | 'nebula' | 'pulse'

/** Every background design the hub offers, in display order. */
export const GRADIENT_STYLES: Array<{ value: GradientStyle; label: string }> = [
  { value: 'gradient', label: 'gradient' },
  { value: 'wave', label: 'color wave' },
  { value: 'grid', label: '3d grid' },
  { value: 'stars', label: 'starfield' },
  { value: 'tunnel', label: 'wormhole' },
  { value: 'aurora', label: 'aurora' },
  { value: 'rain', label: 'rain on glass' },
  { value: 'mesh', label: 'mesh' },
  { value: 'nebula', label: 'nebula' },
  { value: 'pulse', label: 'pulse rings' },
]

/** Styles that render as a 3D ProfileScene (everything but the flat gradient/wave). */
export const SCENE_STYLES: GradientStyle[] = ['grid', 'stars', 'tunnel', 'aurora', 'rain', 'mesh', 'nebula', 'pulse']

/** One-tap color presets — pick a mood instead of two hex pickers. */
export const PROFILE_PALETTES: Array<{ id: string; label: string; start: string; end: string }> = [
  { id: 'midnight', label: 'midnight', start: '#ff2d78', end: '#00d4ff' },
  { id: 'violet', label: 'violet hour', start: '#9b5de9', end: '#00d4ff' },
  { id: 'ember', label: 'ember', start: '#ff6b35', end: '#ff2d78' },
  { id: 'frost', label: 'frost', start: '#00d4ff', end: '#7ee8fa' },
  { id: 'moss', label: 'moss', start: '#5fe0a0', end: '#00d4ff' },
  { id: 'dusk', label: 'dusk', start: '#9b5de9', end: '#ff2d78' },
  { id: 'rose', label: 'rose gold', start: '#ff2d78', end: '#ffd166' },
  { id: 'slate', label: 'slate', start: '#2b3a55', end: '#c9d6ff' },
  { id: 'ultraviolet', label: 'ultraviolet', start: '#7b2ff7', end: '#f107a3' },
  { id: 'seaglass', label: 'sea glass', start: '#2ec4b6', end: '#cbf3f0' },
  { id: 'signalfire', label: 'signal fire', start: '#ff477e', end: '#ffce5c' },
  { id: 'afterhours', label: 'after hours', start: '#16324a', end: '#4f9dde' },
]

export type GradientSettings = {
  locked: boolean
  colorStart: string | null
  colorEnd: string | null
  angle: number | null
  /** seconds per full rotation; 0 = drift off */
  speed: number
  /** 'gradient' = rotating linear; 'wave' = flowing blobs; 'grid'/'stars'/'tunnel' = 3d scenes */
  style: GradientStyle
}

export const GRADIENT_SPEEDS = [
  { label: 'off', value: 0 },
  { label: 'slow (120s)', value: 120 },
  { label: 'medium (60s)', value: 60 },
  { label: 'fast (30s)', value: 30 },
] as const

export const DEFAULT_GRADIENT: GradientSettings = {
  locked: false,
  colorStart: null,
  colorEnd: null,
  angle: null,
  speed: 60,
  style: 'gradient',
}

/** Default Hz → color band mapping (20-200 Hz). */
export function gradientColorsForHz(hz: number): [string, string] {
  if (hz < 80) return ['#0a1128', '#1a0a2e']
  if (hz < 140) return ['#2a0a4a', '#4a0a1a']
  return ['#4a0a1a', '#4a2a0a']
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

export function normalizeAngle(angle: number): number {
  return ((Math.round(angle) % 360) + 360) % 360
}

/** Returns null when valid, otherwise a reason. */
export function validateGradientSettings(settings: GradientSettings): string | null {
  if (settings.locked) {
    if (!settings.colorStart || !isHexColor(settings.colorStart)) return 'pick a valid start color'
    if (!settings.colorEnd || !isHexColor(settings.colorEnd)) return 'pick a valid end color'
  }
  if (settings.angle != null && (settings.angle < 0 || settings.angle > 360)) return 'angle must be 0-360'
  if (!GRADIENT_SPEEDS.some(s => s.value === settings.speed)) return 'invalid drift speed'
  if (!GRADIENT_STYLES.some(s => s.value === settings.style)) return 'invalid design'
  return null
}

/** The two colors actually rendered, given settings + the user's Hz. */
export function resolveGradientColors(settings: GradientSettings, hz: number): [string, string] {
  if (settings.locked && settings.colorStart && settings.colorEnd) {
    return [settings.colorStart, settings.colorEnd]
  }
  return gradientColorsForHz(hz)
}

// ─── persistence (local-first, backend mirror) ────────────────────────────────

const GRADIENT_KEY = 'ecosphere:gradientSettings'

export function readGradientSettings(): GradientSettings {
  try {
    const raw = window.localStorage.getItem(GRADIENT_KEY)
    if (!raw) return DEFAULT_GRADIENT
    const parsed = JSON.parse(raw) as Partial<GradientSettings>
    return { ...DEFAULT_GRADIENT, ...parsed }
  } catch {
    return DEFAULT_GRADIENT
  }
}

export async function saveGradientSettings(settings: GradientSettings): Promise<string | null> {
  const invalid = validateGradientSettings(settings)
  if (invalid) return invalid

  try { window.localStorage.setItem(GRADIENT_KEY, JSON.stringify(settings)) } catch { /* session only */ }

  if (isSupabaseConfigured) {
    const client = getOptionalSupabaseClient()
    const userId = await ensureBackendSession()
    if (client && userId) {
      try {
        await client.from('profiles').update({
          gradient_settings: {
            locked: settings.locked,
            color_start: settings.colorStart,
            color_end: settings.colorEnd,
            angle: settings.angle,
            speed: settings.speed,
            style: settings.style,
          },
        }).eq('id', userId)
      } catch { /* synced on next save */ }
    }
  }
  return null
}

export async function loadGradientSettings(): Promise<GradientSettings> {
  if (isSupabaseConfigured) {
    const client = getOptionalSupabaseClient()
    const userId = await ensureBackendSession()
    if (client && userId) {
      try {
        const { data } = await client.from('profiles').select('gradient_settings').eq('id', userId).maybeSingle()
        const remote = data?.gradient_settings as { locked?: boolean; color_start?: string | null; color_end?: string | null; angle?: number | null; speed?: number; style?: string } | null
        if (remote && typeof remote === 'object') {
          const settings: GradientSettings = {
            locked: remote.locked ?? false,
            colorStart: remote.color_start ?? null,
            colorEnd: remote.color_end ?? null,
            angle: remote.angle ?? null,
            speed: typeof remote.speed === 'number' ? remote.speed : 60,
            style: GRADIENT_STYLES.some(s => s.value === remote.style) ? remote.style as GradientStyle : 'gradient',
          }
          // don't let a default/unlocked remote result clobber a background
          // the user explicitly chose (locked) — keep the local choice and
          // leave localStorage untouched so it also survives a reload.
          const local = readGradientSettings()
          if (local.locked && !settings.locked) return local
          try { window.localStorage.setItem(GRADIENT_KEY, JSON.stringify(settings)) } catch { /* session only */ }
          return settings
        }
      } catch { /* fall through */ }
    }
  }
  return readGradientSettings()
}
