import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useEcosystemState } from './useEcosystemState'
import { sendLive } from '../lib/liveBus'
import { cancelSpeech } from '../lib/speech'
import { setNowPlaying, clearNowPlaying } from '../lib/mediaSession'
import { playSampleBuffer } from '../lib/sampleAudio'
import type { ActiveAudio } from './useEcosystemState'

export type GlobalAudioStatus = {
  current: ActiveAudio | null
  playing: boolean
  /** 0..1 playback progress; stays 0 for simulated playback */
  progress: number
  /** set when the last playback attempt failed */
  notice: string | null
}

type GlobalAudioApi = GlobalAudioStatus & {
  /** Play a real audio blob. Returns false if playback could not start. */
  playBlob: (blob: Blob, meta: ActiveAudio) => Promise<boolean>
  /** Play audio from a URL (e.g. a backend signed URL). */
  playUrl: (url: string, meta: ActiveAudio) => Promise<boolean>
  /** Register a simulated playback (no real audio source). */
  playSimulated: (meta: ActiveAudio, durationMs?: number) => void
  stop: () => void
}

const GlobalAudioContext = createContext<GlobalAudioApi | null>(null)

function preferredVolume(): number {
  try {
    const raw = window.localStorage.getItem('ecosphere:settings')
    if (!raw) return 1
    const volume = Number(JSON.parse(raw)?.signalVolume)
    return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume / 100)) : 1
  } catch {
    return 1
  }
}

/**
 * One audio source for the whole app: starting any playback stops the
 * previous one, progress is shared, and everything halts on route change.
 */
export function GlobalAudioProvider({ children }: { children: ReactNode }) {
  const { ecosystemState, playSignal, setActiveAudio } = useEcosystemState()
  const [status, setStatus] = useState<GlobalAudioStatus>({ current: null, playing: false, progress: 0, notice: null })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const simulatedTimerRef = useRef<number | null>(null)
  const fadeRef = useRef<number | null>(null)

  const teardown = useCallback(() => {
    // any spoken signal stops too — on page change, new playback, or explicit stop
    cancelSpeech()
    clearNowPlaying()
    if (fadeRef.current !== null) { window.clearInterval(fadeRef.current); fadeRef.current = null }
    if (simulatedTimerRef.current !== null) {
      window.clearTimeout(simulatedTimerRef.current)
      simulatedTimerRef.current = null
    }
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.onended = null
      audio.ontimeupdate = null
      audio.onerror = null
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    teardown()
    setStatus({ current: null, playing: false, progress: 0, notice: null })
    setActiveAudio(null)
  }, [setActiveAudio, teardown])

  // the settings volume slider applies to whatever is playing right now
  useEffect(() => {
    const onPrefs = (event: Event) => {
      const v = Number((event as CustomEvent<{ signalVolume?: number }>).detail?.signalVolume)
      if (audioRef.current && Number.isFinite(v)) {
        audioRef.current.volume = Math.min(1, Math.max(0, v / 100))
      }
    }
    window.addEventListener('ecosphere:prefs', onPrefs)
    return () => window.removeEventListener('ecosphere:prefs', onPrefs)
  }, [])

  const startAudio = useCallback(async (audio: HTMLAudioElement, meta: ActiveAudio) => {
    audio.volume = 0 // fade in from silence — no hard pop on start
    sendLive({ type: 'replay', id: meta.id })

    audio.ontimeupdate = () => {
      if (audio.duration > 0 && Number.isFinite(audio.duration)) {
        setStatus((s) => ({ ...s, progress: audio.currentTime / audio.duration }))
      }
    }
    audio.onended = () => stop()
    audio.onerror = () => {
      setStatus({ current: null, playing: false, progress: 0, notice: 'playback interrupted' })
      setActiveAudio(null)
    }

    try {
      await audio.play()
    } catch {
      teardown()
      setStatus({ current: null, playing: false, progress: 0, notice: 'signal unavailable on this device' })
      setActiveAudio(null)
      return false
    }

    // a breath of carrier hiss covers the gap, then the signal fades up
    void playSampleBuffer('static', 700, 280, 0.04)
    const target = preferredVolume()
    if (fadeRef.current !== null) window.clearInterval(fadeRef.current)
    let v = 0
    fadeRef.current = window.setInterval(() => {
      v = Math.min(target, v + target / 8)
      if (audioRef.current) audioRef.current.volume = v
      if (v >= target && fadeRef.current !== null) { window.clearInterval(fadeRef.current); fadeRef.current = null }
    }, 40)

    // lock-screen / background controls route back to our single engine
    setNowPlaying(meta.label, () => stop())

    setStatus({ current: meta, playing: true, progress: 0, notice: null })
    setActiveAudio(meta)
    playSignal(meta.id, 6, meta.label)
    return true
  }, [playSignal, setActiveAudio, stop, teardown])

  const playBlob = useCallback(async (blob: Blob, meta: ActiveAudio) => {
    teardown()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioRef.current = audio
    urlRef.current = url
    return startAudio(audio, meta)
  }, [startAudio, teardown])

  const playUrl = useCallback(async (url: string, meta: ActiveAudio) => {
    teardown()
    const audio = new Audio(url)
    audioRef.current = audio
    return startAudio(audio, meta)
  }, [startAudio, teardown])

  const playSimulated = useCallback((meta: ActiveAudio, durationMs = 6000) => {
    teardown()
    setNowPlaying(meta.label, () => stop())
    setStatus({ current: meta, playing: true, progress: 0, notice: null })
    setActiveAudio(meta)
    playSignal(meta.id, 6, meta.label)
    simulatedTimerRef.current = window.setTimeout(() => stop(), durationMs)
  }, [playSignal, setActiveAudio, stop, teardown])

  // audio stops when the user changes pages
  const page = ecosystemState.currentPage
  const lastPageRef = useRef(page)
  useEffect(() => {
    if (lastPageRef.current !== page) {
      lastPageRef.current = page
      stop()
    }
  }, [page, stop])

  useEffect(() => () => teardown(), [teardown])

  const value = useMemo<GlobalAudioApi>(() => ({
    ...status,
    playBlob,
    playSimulated,
    playUrl,
    stop,
  }), [status, playBlob, playSimulated, playUrl, stop])

  return <GlobalAudioContext.Provider value={value}>{children}</GlobalAudioContext.Provider>
}

export function useGlobalAudio(): GlobalAudioApi {
  const ctx = useContext(GlobalAudioContext)
  if (!ctx) {
    throw new Error('useGlobalAudio must be used inside <GlobalAudioProvider>')
  }
  return ctx
}
