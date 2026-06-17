// A carrier you can actually check out. Other people's signals are anonymous by
// design, so a "profile" here is a calm, deterministic read of a handle — its
// frequency, color, sigil, and a sensed weather — built from the same hz system
// the rest of the app uses. No private data, nothing identifying.

import { getLocalHzProfile } from './hzSignature'

const CARRIER_SIGILS = ['◈', '∿', '◌', '◑', '✦', '⬡', '◬', '≋', '◉', '✧']
const WEATHER = ['running quiet tonight', 'broadcasting steadily', 'fading in and out', 'resonating strong', 'drifting at the edges']

export type CarrierView = {
  handle: string
  hz: number
  color: string
  sigil: string
  weather: string
}

function hash(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 0x7fffffff
  return h
}

/** Deterministic public view of a carrier by handle. */
export function carrierView(handle: string): CarrierView {
  const clean = (handle || 'anonymous').replace(/^[◈◉⬡∿◌]\s*/, '').trim() || 'anonymous'
  const hz = getLocalHzProfile(clean)
  const h = hash(clean)
  return {
    handle: clean,
    hz: hz.hz,
    color: hz.color,
    sigil: CARRIER_SIGILS[h % CARRIER_SIGILS.length],
    weather: WEATHER[h % WEATHER.length],
  }
}

/** A carrier is anonymous (no profile to open) when it has no real handle. */
export function isOpenableHandle(handle: string | undefined | null): boolean {
  if (!handle) return false
  const clean = handle.replace(/^[◈◉⬡∿◌]\s*/, '').trim().toLowerCase()
  return clean.length > 0 && clean !== 'anonymous' && !clean.startsWith('anonymous')
}
