import { useEcoPref } from './useEcoPrefs'
import { resolveLocale, t } from '../lib/i18n'
import type { Locale } from '../lib/i18n'

/** Active locale + translator, live-updating when the language pref changes. */
export function useLocale(): { locale: Locale; tr: (key: string) => string } {
  const pref = useEcoPref('language', 'auto')
  const locale = resolveLocale(pref)
  return { locale, tr: (key: string) => t(key, locale) }
}
