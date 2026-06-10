import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useEcosystemState } from './useEcosystemState'
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
  /** Register a simulated playback (no real audio source). */
  playSimulated: (meta: ActiveAudio, durationMs?: number) => void
  stop: () => void
}

const GlobalAudioContext = createContext<GlobalAudioApi | null>(null)

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

  const teardown = useCallback(() => {
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

  const playBlob = useCallback(async (blob: Blob, meta: ActiveAudio) => {
    teardown()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioRef.current = audio
    urlRef.current = url

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

    setStatus({ current: meta, playing: true, progress: 0, notice: null })
    setActiveAudio(meta)
    playSignal(meta.id, 6, meta.label)
    return true
  }, [playSignal, setActiveAudio, stop, teardown])

  const playSimulated = useCallback((meta: ActiveAudio, durationMs = 6000) => {
    teardown()
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
    stop,
  }), [status, playBlob, playSimulated, stop])

  return <GlobalAudioContext.Provider value={value}>{children}</GlobalAudioContext.Provider>
}

export function useGlobalAudio(): GlobalAudioApi {
  const ctx = useContext(GlobalAudioContext)
  if (!ctx) {
    throw new Error('useGlobalAudio must be used inside <GlobalAudioProvider>')
  }
  return ctx
}
