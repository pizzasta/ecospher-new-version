// Privacy-minimal production error reporting.
//
// We intentionally do not send user content, URLs, local state, audio metadata,
// emails, usernames, or arbitrary Error messages. Reports contain only a small
// error fingerprint plus build/runtime context so production failures can be
// counted without turning crash reporting into a new data-collection surface.

type ErrorSource = 'react' | 'window' | 'promise'

type ErrorReport = {
  source: ErrorSource
  name: string
  fingerprint: string
  build: string
  online: boolean
  timestamp: string
}

const endpoint = (import.meta.env.VITE_ERROR_REPORT_ENDPOINT as string | undefined)?.trim() ?? ''
const build = (import.meta.env.VITE_BUILD_STAMP as string | undefined)?.trim() || 'unknown'

function fingerprint(value: unknown): string {
  const raw = value instanceof Error
    ? `${value.name}:${value.stack?.split('\n').slice(0, 3).join('|') ?? ''}`
    : typeof value === 'string' ? value.slice(0, 160) : Object.prototype.toString.call(value)

  let hash = 2166136261
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function reportProductionError(error: unknown, source: ErrorSource): void {
  if (!endpoint || import.meta.env.DEV) return

  const report: ErrorReport = {
    source,
    name: error instanceof Error ? error.name.slice(0, 80) : 'UnknownError',
    fingerprint: fingerprint(error),
    build,
    online: navigator.onLine,
    timestamp: new Date().toISOString(),
  }

  try {
    const body = JSON.stringify(report)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch(endpoint, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      mode: 'cors',
    }).catch(() => undefined)
  } catch {
    // Monitoring must never become an app failure.
  }
}

export function installGlobalErrorMonitoring(): () => void {
  if (!endpoint || import.meta.env.DEV) return () => undefined

  const onError = (event: ErrorEvent) => reportProductionError(event.error ?? event.message, 'window')
  const onRejection = (event: PromiseRejectionEvent) => reportProductionError(event.reason, 'promise')

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
