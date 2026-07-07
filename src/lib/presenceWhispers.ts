// Presence whispers — the network noticing you back.
//
// Every social app tells you what strangers are doing. Almost none tell you
// what's happening to the things YOU touched after you walked away. These
// whispers are generated from your own local traces — harmonies you bound,
// artifacts you carry, voices you relayed, carriers who became familiar —
// and surface as soft, passing lines: the band remembering you exist.
//
// Deterministic per minute so the same moment whispers the same thing;
// nothing here is a notification, nothing demands a tap.

import { listHarmonies } from './echolocation'
import { carriedArtifacts } from './deepArchive'
import { relayCount } from './relay'
import { getFamiliars, stageLabel } from './familiarFrequency'

function hashString(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 0x7fffffff
  return h
}

/** Every whisper the current local state can truthfully generate. */
export function whisperCandidates(now = Date.now()): string[] {
  const lines: string[] = []
  const minute = Math.floor(now / 60_000)

  try {
    const harmonies = listHarmonies()
    if (harmonies.length > 0) {
      const h = harmonies[minute % harmonies.length]
      lines.push(`${h.handle} drifted through the band a little while ago — still ${h.interval} from you`)
      if (h.mutual) lines.push(`the harmony you and ${h.handle} answered is still holding`)
    }
  } catch { /* no harmonies to whisper about */ }

  try {
    const carried = carriedArtifacts()
    if (carried.length > 0) {
      const a = carried[minute % carried.length]
      lines.push(`"${a.name}" is still in your pocket. it hums when you're away`)
    }
  } catch { /* nothing carried */ }

  try {
    const relays = relayCount()
    if (relays > 0) {
      lines.push(relays === 1
        ? 'the voice you relayed is further down the band than it was an hour ago'
        : `the ${relays} voices you relayed are all still travelling`)
    }
  } catch { /* nothing relayed */ }

  try {
    const familiars = getFamiliars()
    if (familiars.length > 0) {
      const f = familiars[minute % familiars.length]
      lines.push(`${f.handle} passed through tonight — ${stageLabel(f.stage)} in your field now`)
    }
  } catch { /* nobody familiar yet */ }

  // the band itself, when you haven't left traces yet — presence before history
  if (lines.length === 0) {
    lines.push(
      'the band noticed you arrive. it keeps the lights low on purpose',
      'somewhere on this frequency, someone is listening at your exact volume',
      'nothing you do here is watched. some of it is remembered',
    )
  }
  return lines
}

/** The whisper for this moment — stable within the minute. */
export function currentWhisper(now = Date.now()): string {
  const candidates = whisperCandidates(now)
  return candidates[hashString(String(Math.floor(now / 60_000))) % candidates.length]
}

/** Cadence: a whisper surfaces roughly every 70-110s, visible ~9s. */
export const WHISPER_EVERY_MS = 84_000
export const WHISPER_VISIBLE_MS = 9_000
