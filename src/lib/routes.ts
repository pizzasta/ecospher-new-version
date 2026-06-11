// URL ↔ screen mapping. The app is an SPA (Vercel rewrites every path to
// index.html); these routes make each screen deep-linkable so /rooms,
// /capsules, etc. open the right page instead of always booting to home.

export type ScreenRoute =
  | 'home' | 'signals' | 'drift' | 'rooms' | 'unsent' | 'capsules'
  | 'relics' | 'pod' | 'zones' | 'frequencies' | 'anomalies' | 'settings'

export const SCREEN_PATHS: Record<ScreenRoute, string> = {
  home: '/',
  signals: '/signals',
  drift: '/drift',
  rooms: '/rooms',
  unsent: '/unsent',
  capsules: '/capsules',
  relics: '/relics',
  pod: '/pod',
  zones: '/zones',
  frequencies: '/frequencies',
  anomalies: '/anomalies',
  settings: '/settings',
}

const PATH_TO_SCREEN: Record<string, ScreenRoute> = Object.fromEntries(
  Object.entries(SCREEN_PATHS).map(([screen, path]) => [path, screen as ScreenRoute]),
)

/** Screen for a pathname; unknown paths land on home. */
export function screenForPath(pathname: string): ScreenRoute {
  const normalized = ('/' + pathname.replace(/^\/+|\/+$/g, '')).toLowerCase()
  return PATH_TO_SCREEN[normalized === '/' ? '/' : normalized] ?? 'home'
}
