import { describe, it, expect } from 'vitest'
import { SIGIL_THEMES, sigilsInTheme, themeFor } from '../sigilThemes'
import { AVATAR_SIGILS } from '../avatar'

describe('sigil themes', () => {
  it('groups all sigils into themes, each named', () => {
    const themed = new Set(SIGIL_THEMES.flatMap(t => t.sigilIds))
    for (const s of AVATAR_SIGILS) expect(themed.has(s.id)).toBe(true)
    for (const t of SIGIL_THEMES) {
      expect(t.label).toBeTruthy()
      expect(t.line).toBeTruthy()
      expect(t.sigilIds.length).toBeGreaterThan(0)
    }
  })

  it('resolves the sigils in a theme to real avatar sigils', () => {
    const nocturne = sigilsInTheme('nocturne')
    expect(nocturne.length).toBe(3)
    for (const s of nocturne) expect(s.glyph !== undefined).toBe(true)
  })

  it('maps a sigil back to its theme', () => {
    expect(themeFor('hz')?.id).toBe('nocturne')
    expect(themeFor('gem')?.id).toBe('anchors')
    expect(themeFor('nope')).toBeNull()
  })
})
