// Sigils, grouped into themes so choosing one feels like picking a personal
// constellation — etching a relic, not selecting an avatar. The ids map onto
// the existing AVATAR_SIGILS set.

import { AVATAR_SIGILS } from './avatar'
import type { AvatarSigil } from './avatar'

export interface SigilTheme { id: string; label: string; line: string; sigilIds: string[] }

export const SIGIL_THEMES: SigilTheme[] = [
  { id: 'nocturne', label: 'Nocturne', line: 'made of late hours', sigilIds: ['hz', 'wave', 'eye'] },
  { id: 'echoes', label: 'Echoes', line: 'what keeps coming back', sigilIds: ['loop', 'antenna'] },
  { id: 'wounds', label: 'Wounds', line: 'the tender, honest marks', sigilIds: ['static', 'spark'] },
  { id: 'anchors', label: 'Anchors', line: 'what holds you steady', sigilIds: ['hex', 'gem'] },
  { id: 'currents', label: 'Currents', line: 'what moves you along', sigilIds: ['tide', 'orbit', 'comet'] },
  { id: 'edges', label: 'Edges', line: 'where the map runs out', sigilIds: ['rift', 'bloom', 'void'] },
]

export function sigilsInTheme(themeId: string): AvatarSigil[] {
  const theme = SIGIL_THEMES.find(t => t.id === themeId)
  if (!theme) return []
  return theme.sigilIds
    .map(id => AVATAR_SIGILS.find(s => s.id === id))
    .filter((s): s is AvatarSigil => Boolean(s))
}

export function themeFor(sigilId: string): SigilTheme | null {
  return SIGIL_THEMES.find(t => t.sigilIds.includes(sigilId)) ?? null
}
