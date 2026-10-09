import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useEcosystemState } from './useEcosystemState'
import {
  describePeer, joinWavelength, localWaveBus, newWaveKey, rankMatches, setWavelengthEnabled, topReplayMoods, wavelengthEnabled,
} from '../lib/wavelength'
import type { WaveMatch, WaveMeta, WavelengthSession } from '../lib/wavelength'
import { readMood } from '../lib/profileMood'
import { getLocalHzProfile } from '../lib/hzSignature'
import { readAvatar, sigilGlyph } from '../lib/avatar'
import { pushLocalNotification } from '../lib/notifications'
import { isSupabaseConfigured } from '../lib/supabase-env'

type WavelengthCtx = {
  enabled: boolean
  setEnabled: (on: boolean) => void
  /** connected to the band right now */
  live: boolean
  me: WaveMeta | null
  matches: WaveMatch[]
  /** everyone on the band, you excluded */
  online: number
  peers: WaveMeta[]
  wave: (peer: WaveMeta) => boolean
  tune: (peer: WaveMeta) => boolean
  /** keys you've already waved at / tuned to this session */
  sent: Record<string, 'wave' | 'tune'>
}

const Ctx = createContext<WavelengthCtx | null>(null)

const STRONG_MATCH = 75
const TRANSPORT_KEY = 'ecosphere:wavelengthTransport'

/** ?wavelength=local → two tabs can find each other without a backend. */
function useLocalTransport(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get('wavelength')
    if (param === 'local') window.localStorage.setItem(TRANSPORT_KEY, 'local')
    if (param === 'remote') window.localStorage.removeItem(TRANSPORT_KEY)
    return window.localStorage.getItem(TRANSPORT_KEY) === 'local'
  } catch { return false }
}

function onTheGrid(): boolean {
  try { return window.localStorage.getItem('introSeen') === 'true' } catch { return false }
}

export function WavelengthProvider({ children }: { children: ReactNode }) {
  const { ecosystemState } = useEcosystemState()
  const identity = ecosystemState.userSignalIdentity ?? 'unclaimed'
  const [enabled, setEnabledState] = useState(() => wavelengthEnabled())
  const [peers, setPeers] = useState<WaveMeta[]>([])
  const [live, setLive] = useState(false)
  const [sent, setSent] = useState<Record<string, 'wave' | 'tune'>>({})
  const sessionRef = useRef<WavelengthSession | null>(null)
  const [keyRef] = useState(() => newWaveKey())
  const announced = useRef(new Set<string>())
  const [refreshTick, setRefreshTick] = useState(0)
  const localTransport = useLocalTransport()

  // your wavelength is rebuilt when the hour turns or your mood/identity changes
  useEffect(() => {
    const t = window.setInterval(() => setRefreshTick(n => n + 1), 10 * 60 * 1000)
    const bump = () => setRefreshTick(n => n + 1)
    window.addEventListener('ecosphere:profile-updated', bump)
    return () => { window.clearInterval(t); window.removeEventListener('ecosphere:profile-updated', bump) }
  }, [])

  const me = useMemo<WaveMeta>(() => {
    const mood = readMood()
    const hz = getLocalHzProfile(identity)
    const avatar = readAvatar()
    return {
      key: keyRef,
      mood: mood.mood ?? 'tender',
      energy: mood.energy ?? 'low',
      hz: hz.hz,
      hour: new Date().getHours(),
      replays: topReplayMoods(),
      sigil: avatar === 'hz' ? '◌' : sigilGlyph(avatar) || '◌',
      color: /^#[0-9a-f]{6}$/i.test(hz.color) ? hz.color : '#8a93ad',
      joinedAt: Date.now(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, keyRef, refreshTick])

  useEffect(() => {
    const onToggle = () => setEnabledState(wavelengthEnabled())
    window.addEventListener('ecosphere:wavelength-toggle', onToggle)
    return () => window.removeEventListener('ecosphere:wavelength-toggle', onToggle)
  }, [])

  useEffect(() => {
    if (!enabled || !onTheGrid() || (!isSupabaseConfigured && !localTransport)) { setLive(false); setPeers([]); return }
    const session = joinWavelength(me, {
      onPeers: list => setPeers(list.filter(p => p.key !== me.key)),
      onEvent: e => {
        const peer = { key: e.from.key, mood: e.from.mood, sigil: e.from.sigil, color: e.from.color, hz: e.from.hz }
        pushLocalNotification(
          e.kind === 'wave' ? 'wave' : 'tuned_in',
          e.kind === 'wave' ? `${describePeer(e.from)} waved at you` : `${describePeer(e.from)} tuned in to you`,
          peer,
        )
      },
    }, localTransport ? localWaveBus(me) : undefined)
    sessionRef.current = session
    setLive(Boolean(session))
    return () => { session?.leave(); sessionRef.current = null; setLive(false) }
  }, [enabled, me, localTransport])

  const matches = useMemo(() => rankMatches(me, peers), [me, peers])

  // a strong match arriving is worth a notification — once per person per session
  useEffect(() => {
    for (const m of matches) {
      if (m.score < STRONG_MATCH || announced.current.has(m.peer.key)) continue
      announced.current.add(m.peer.key)
      pushLocalNotification(
        'wavelength_match',
        `${describePeer(m.peer)} is on your wavelength · ${m.score}%`,
        { key: m.peer.key, mood: m.peer.mood, sigil: m.peer.sigil, color: m.peer.color, hz: m.peer.hz },
      )
    }
  }, [matches])

  const wave = useCallback((peer: WaveMeta) => {
    const ok = sessionRef.current?.wave(peer) ?? false
    if (ok) setSent(s => ({ ...s, [peer.key]: 'wave' }))
    return ok
  }, [])
  const tune = useCallback((peer: WaveMeta) => {
    const ok = sessionRef.current?.tune(peer) ?? false
    if (ok) setSent(s => ({ ...s, [peer.key]: 'tune' }))
    return ok
  }, [])
  const setEnabled = useCallback((on: boolean) => { setWavelengthEnabled(on); setEnabledState(on) }, [])

  const value = useMemo<WavelengthCtx>(() => ({
    enabled, setEnabled, live, me, matches, online: peers.length, peers, wave, tune, sent,
  }), [enabled, setEnabled, live, me, matches, peers, wave, tune, sent])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

const OFF: WavelengthCtx = {
  enabled: false, setEnabled: () => {}, live: false, me: null, matches: [], online: 0, peers: [],
  wave: () => false, tune: () => false, sent: {},
}

export function useWavelength(): WavelengthCtx {
  return useContext(Ctx) ?? OFF
}

/** find a live peer by key (to wave back from a notification) */
export function usePeerByKey(key: string | undefined): WaveMeta | null {
  const { peers } = useWavelength()
  return key ? peers.find(p => p.key === key) ?? null : null
}
