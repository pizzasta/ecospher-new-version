// 3D node scenes — the world your sigil floats in. Pure data + storage here;
// the WebGL engine (three.js) lives in node3dEngine.ts and is only loaded
// when a 3D stage actually mounts, so it never weighs down first paint.

export type Scene3D = 'deep-space' | 'rain-city' | 'synth-grid' | 'wormhole' | 'aurora-sea' | 'none'

export const SCENES_3D: Array<{ id: Scene3D; label: string; line: string }> = [
  { id: 'deep-space', label: 'deep space', line: 'stars streaming past at 3am' },
  { id: 'rain-city', label: 'rain city', line: 'neon windows, wet glass' },
  { id: 'synth-grid', label: 'synth grid', line: 'an endless floor into a low sun' },
  { id: 'wormhole', label: 'wormhole', line: 'falling through the signal' },
  { id: 'aurora-sea', label: 'aurora sea', line: 'a slow ocean of light' },
  { id: 'none', label: 'no scene', line: 'just your sigil in the dark' },
]

const KEY = 'ecosphere:scene3d'
export const DEFAULT_SCENE_3D: Scene3D = 'deep-space'

export function isScene3D(v: unknown): v is Scene3D {
  return SCENES_3D.some(s => s.id === v)
}

export function readScene3D(): Scene3D {
  try {
    const v = window.localStorage.getItem(KEY)
    return isScene3D(v) ? v : DEFAULT_SCENE_3D
  } catch { return DEFAULT_SCENE_3D }
}

export function saveScene3D(scene: Scene3D) {
  try { window.localStorage.setItem(KEY, scene) } catch { /* session only */ }
  try { window.dispatchEvent(new CustomEvent('ecosphere:profile-updated')) } catch { /* non-browser */ }
}

/** Can this device draw WebGL at all? (checked once, cheaply) */
let webglChecked: boolean | null = null
export function webglAvailable(): boolean {
  if (webglChecked !== null) return webglChecked
  try {
    const c = document.createElement('canvas')
    webglChecked = Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { webglChecked = false }
  return webglChecked
}
