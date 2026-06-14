import { describe, expect, it } from 'vitest'
import { DICTIONARIES, LOCALES, matchLocale, t } from '../i18n'

describe('i18n dictionaries', () => {
  const englishKeys = Object.keys(DICTIONARIES.en)

  it('every locale covers every key — no half-translated UI', () => {
    for (const locale of LOCALES) {
      const keys = Object.keys(DICTIONARIES[locale])
      expect(keys.sort()).toEqual([...englishKeys].sort())
      for (const key of englishKeys) {
        expect(DICTIONARIES[locale][key].length).toBeGreaterThan(0)
      }
    }
  })

  it('matches browser tags to supported locales, defaulting to english', () => {
    expect(matchLocale('pt-BR')).toBe('pt')
    expect(matchLocale('es-MX')).toBe('es')
    expect(matchLocale('ja')).toBe('ja')
    expect(matchLocale('ko-KR')).toBe('en')
    expect(matchLocale(undefined)).toBe('en')
  })

  it('falls back to english for unknown keys instead of crashing', () => {
    expect(t('nav.rooms', 'de')).toBe('räume')
    expect(t('nonexistent.key', 'fr')).toBe('nonexistent.key')
  })
})
