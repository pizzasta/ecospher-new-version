import { useEffect, useState } from 'react'

// Read one preference from ecosphere:settings and stay in sync with the
// 'ecosphere:prefs' broadcast the settings screen dispatches on every change.
export function useEcoPref<T>(key: string, fallback: T): T {
  const [value, setValue] = useState<T>(() => readPref(key, fallback))

  useEffect(() => {
    const onPrefs = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail
      if (detail && key in detail) setValue(detail[key] as T)
    }
    window.addEventListener('ecosphere:prefs', onPrefs)
    return () => window.removeEventListener('ecosphere:prefs', onPrefs)
  }, [key])

  return value
}

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem('ecosphere:settings')
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return key in parsed ? (parsed[key] as T) : fallback
  } catch {
    return fallback
  }
}
