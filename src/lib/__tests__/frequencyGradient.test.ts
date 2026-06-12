import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRADIENT,
  gradientColorsForHz,
  isHexColor,
  normalizeAngle,
  resolveGradientColors,
  validateGradientSettings,
} from '../frequencyGradient'

describe('hz → gradient color bands', () => {
  it('maps low / mid / high hz to the documented bands', () => {
    expect(gradientColorsForHz(20)).toEqual(['#0a1128', '#1a0a2e'])
    expect(gradientColorsForHz(79.9)).toEqual(['#0a1128', '#1a0a2e'])
    expect(gradientColorsForHz(80)).toEqual(['#2a0a4a', '#4a0a1a'])
    expect(gradientColorsForHz(139.9)).toEqual(['#2a0a4a', '#4a0a1a'])
    expect(gradientColorsForHz(140)).toEqual(['#4a0a1a', '#4a2a0a'])
    expect(gradientColorsForHz(200)).toEqual(['#4a0a1a', '#4a2a0a'])
  })
})

describe('gradient settings validation', () => {
  it('accepts the defaults', () => {
    expect(validateGradientSettings(DEFAULT_GRADIENT)).toBeNull()
  })

  it('requires valid hex colors when locked', () => {
    expect(validateGradientSettings({ ...DEFAULT_GRADIENT, locked: true })).toMatch(/start color/)
    expect(validateGradientSettings({ ...DEFAULT_GRADIENT, locked: true, colorStart: '#112233', colorEnd: 'red' })).toMatch(/end color/)
    expect(validateGradientSettings({ ...DEFAULT_GRADIENT, locked: true, colorStart: '#112233', colorEnd: '#445566' })).toBeNull()
  })

  it('accepts both designs and rejects unknown ones', () => {
    expect(validateGradientSettings({ ...DEFAULT_GRADIENT, style: 'wave' })).toBeNull()
    expect(validateGradientSettings({ ...DEFAULT_GRADIENT, style: 'gradient' })).toBeNull()
    // @ts-expect-error runtime guard for values from storage
    expect(validateGradientSettings({ ...DEFAULT_GRADIENT, style: 'plasma' })).toMatch(/design/)
  })

  it('bounds angle and speed', () => {
    expect(validateGradientSettings({ ...DEFAULT_GRADIENT, angle: 400 })).toMatch(/angle/)
    expect(validateGradientSettings({ ...DEFAULT_GRADIENT, angle: 180 })).toBeNull()
    expect(validateGradientSettings({ ...DEFAULT_GRADIENT, speed: 45 })).toMatch(/speed/)
    expect(validateGradientSettings({ ...DEFAULT_GRADIENT, speed: 0 })).toBeNull()
  })
})

describe('gradient resolution', () => {
  it('uses locked colors when set, hz mapping otherwise', () => {
    expect(resolveGradientColors({ ...DEFAULT_GRADIENT, locked: true, colorStart: '#111111', colorEnd: '#222222' }, 50)).toEqual(['#111111', '#222222'])
    expect(resolveGradientColors(DEFAULT_GRADIENT, 50)).toEqual(['#0a1128', '#1a0a2e'])
  })

  it('validates hex strictly and normalizes angles', () => {
    expect(isHexColor('#aabbcc')).toBe(true)
    expect(isHexColor('#abc')).toBe(false)
    expect(isHexColor('aabbcc')).toBe(false)
    expect(normalizeAngle(370)).toBe(10)
    expect(normalizeAngle(-20)).toBe(340)
  })
})
