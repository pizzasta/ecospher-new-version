// Avatar sigils: the face of a profile that has no face. No photos, ever —
// you pick a mark and it renders in your signature color at the center of
// the identity ring. 'hz' keeps the classic frequency readout.

export type AvatarSigil = { id: string; glyph: string; label: string }

export const AVATAR_SIGILS: AvatarSigil[] = [
  { id: 'hz', glyph: '', label: 'frequency readout' },
  { id: 'wave', glyph: '∿', label: 'the wave' },
  { id: 'hex', glyph: '⬡', label: 'the hex' },
  { id: 'eye', glyph: '◐', label: 'the half moon' },
  { id: 'antenna', glyph: '⌖', label: 'the antenna' },
  { id: 'spark', glyph: '✦', label: 'the spark' },
  { id: 'static', glyph: '▦', label: 'the static' },
  { id: 'loop', glyph: '◌', label: 'the loop' },
  { id: 'gem', glyph: '◈', label: 'the gem' },
  { id: 'orbit', glyph: '◍', label: 'the orbit' },
  { id: 'tide', glyph: '≋', label: 'the tide' },
  { id: 'rift', glyph: '⟁', label: 'the rift' },
  { id: 'bloom', glyph: '❋', label: 'the bloom' },
  { id: 'comet', glyph: '☄︎', label: 'the comet' },
  { id: 'void', glyph: '⬢', label: 'the void' },
]

const AVATAR_KEY = 'ecosphere:avatar'

export function readAvatar(): string {
  try {
    const stored = window.localStorage.getItem(AVATAR_KEY)
    return AVATAR_SIGILS.some(s => s.id === stored) ? (stored as string) : 'hz'
  } catch {
    return 'hz'
  }
}

export function saveAvatar(id: string): void {
  if (!AVATAR_SIGILS.some(s => s.id === id)) return
  try { window.localStorage.setItem(AVATAR_KEY, id) } catch { /* session only */ }
}

export function sigilGlyph(id: string): string {
  return AVATAR_SIGILS.find(s => s.id === id)?.glyph ?? ''
}
