// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  GRADIENT_STYLES, SCENE_STYLES, PROFILE_PALETTES, DEFAULT_GRADIENT,
  isHexColor, validateGradientSettings,
} from '../frequencyGradient'

describe('profile style options', () => {
  it('offers the new scene styles', () => {
    const values = GRADIENT_STYLES.map(s => s.value)
    for (const added of ['aurora', 'rain', 'mesh']) {
      expect(values).toContain(added)
    }
  })

  it('validates the new styles as real designs', () => {
    for (const style of ['aurora', 'rain', 'mesh'] as const) {
      expect(validateGradientSettings({ ...DEFAULT_GRADIENT, style })).toBeNull()
    }
  })

  it('marks scene (3D) styles but not flat ones', () => {
    expect(SCENE_STYLES).toContain('aurora')
    expect(SCENE_STYLES).not.toContain('gradient')
    expect(SCENE_STYLES).not.toContain('wave')
  })

  it('every palette is two valid hex colors', () => {
    expect(PROFILE_PALETTES.length).toBeGreaterThanOrEqual(6)
    for (const p of PROFILE_PALETTES) {
      expect(isHexColor(p.start)).toBe(true)
      expect(isHexColor(p.end)).toBe(true)
      expect(p.start).not.toBe(p.end)
    }
  })

  it('a palette applied with color lock validates', () => {
    const p = PROFILE_PALETTES[0]
    const settings = { ...DEFAULT_GRADIENT, locked: true, colorStart: p.start, colorEnd: p.end, style: 'aurora' as const }
    expect(validateGradientSettings(settings)).toBeNull()
  })
})
