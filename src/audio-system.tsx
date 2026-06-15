import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type BrowserAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

export type SampleAudioKey =
  | 'opening'
  | 'signal-lock'
  | 'room'
  | 'live-room'
  | 'relic'
  | 'archive'
  | 'recording'
  | 'distant-voice'
  | 'ui-tap'

export type AmbientLayerKey =
  | 'silent'
  | 'find'
  | 'observatory'
  | 'signals'
  | 'rooms'
  | 'frequencies'
  | 'relics'
  | 'soul-pod'
  | 'settings'

export type AudioDebugState = {
  unlocked: boolean
  soundEnabled: boolean
  currentSource: string | null
  lastAttempt: string | null
  lastError: string | null
  browserSupport: {
    audioContext: boolean
    htmlAudio: boolean
    mediaRecorder: boolean
    microphone: boolean
  }
}

type SampleAudioDefinition = {
  id: SampleAudioKey
  label: string
  transcript: string
  frequency: number
  duration: number
  volume: number
}

type PlayUrlOptions = {
  label: string
  volume?: number
}

type AmbientLayerDefinition = {
  frequency: number
  filterFrequency: number
  noise: number
  tone: OscillatorType
  volume: number
}

type AudioManager = {
  debug: AudioDebugState
  samples: Record<SampleAudioKey, SampleAudioDefinition>
  setSoundEnabled: (enabled: boolean) => void
  setAmbientLayer: (layer: AmbientLayerKey, label?: string) => Promise<boolean>
  unlock: (reason?: string) => Promise<boolean>
  playUrl: (url: string | undefined | null, options: PlayUrlOptions) => Promise<HTMLAudioElement | null>
  playSample: (key: SampleAudioKey, label?: string) => Promise<boolean>
  playTone: (key: SampleAudioKey, label?: string) => Promise<boolean>
  stopAll: () => void
}

type AmbientLayerState = {
  gain: GainNode
  layer: AmbientLayerKey
  nodes: AudioScheduledSourceNode[]
}

const sampleAudioDefinitions: Record<SampleAudioKey, SampleAudioDefinition> = {
  opening: {
    id: 'opening',
    label: 'opening sound',
    transcript: 'If you can hear this, audio is working.',
    frequency: 392,
    duration: 0.62,
    volume: 0.052,
  },
  'signal-lock': {
    id: 'signal-lock',
    label: 'Signal Lock-In pulse',
    transcript: 'This is just a test signal.',
    frequency: 82,
    duration: 1.15,
    volume: 0.065,
  },
  room: {
    id: 'room',
    label: 'room sample voice',
    transcript: 'It sounded different when nobody was awake.',
    frequency: 164,
    duration: 2.4,
    volume: 0.058,
  },
  'live-room': {
    id: 'live-room',
    label: 'live room layer',
    transcript: 'I left this here instead.',
    frequency: 128,
    duration: 2.7,
    volume: 0.056,
  },
  relic: {
    id: 'relic',
    label: 'relic replay',
    transcript: "I don't know why I saved this, but I did.",
    frequency: 220,
    duration: 2.2,
    volume: 0.054,
  },
  archive: {
    id: 'archive',
    label: 'Echo Archive replay',
    transcript: "I almost sent this to someone, then didn't.",
    frequency: 196,
    duration: 2.5,
    volume: 0.052,
  },
  recording: {
    id: 'recording',
    label: 'recording playback',
    transcript: 'This local recording can replay after it is saved.',
    frequency: 174,
    duration: 1.9,
    volume: 0.052,
  },
  'distant-voice': {
    id: 'distant-voice',
    label: 'distant voice fragment',
    transcript: 'I left this here instead.',
    frequency: 146,
    duration: 2.1,
    volume: 0.05,
  },
  'ui-tap': {
    id: 'ui-tap',
    label: 'UI tap sound',
    transcript: 'tiny interface tone',
    frequency: 523,
    duration: 0.18,
    volume: 0.034,
  },
}

const ambientLayerDefinitions: Record<Exclude<AmbientLayerKey, 'silent'>, AmbientLayerDefinition> = {
  find: { frequency: 196, filterFrequency: 880, noise: 0.013, tone: 'sine', volume: 0.018 },
  observatory: { frequency: 110, filterFrequency: 620, noise: 0.01, tone: 'triangle', volume: 0.016 },
  signals: { frequency: 174, filterFrequency: 760, noise: 0.012, tone: 'sine', volume: 0.017 },
  rooms: { frequency: 82, filterFrequency: 420, noise: 0.008, tone: 'sine', volume: 0.019 },
  frequencies: { frequency: 244, filterFrequency: 1180, noise: 0.018, tone: 'sawtooth', volume: 0.015 },
  relics: { frequency: 138, filterFrequency: 540, noise: 0.011, tone: 'triangle', volume: 0.017 },
  'soul-pod': { frequency: 128, filterFrequency: 500, noise: 0.009, tone: 'sine', volume: 0.016 },
  settings: { frequency: 164, filterFrequency: 680, noise: 0.006, tone: 'sine', volume: 0.012 },
}

const AudioContextValue = createContext<AudioManager | null>(null)

function getBrowserSupport(): AudioDebugState['browserSupport'] {
  if (typeof window === 'undefined') {
    return {
      audioContext: false,
      htmlAudio: false,
      mediaRecorder: false,
      microphone: false,
    }
  }

  return {
    audioContext: Boolean(window.AudioContext || (window as BrowserAudioWindow).webkitAudioContext),
    htmlAudio: typeof Audio !== 'undefined',
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    microphone: Boolean(navigator.mediaDevices?.getUserMedia),
  }
}

function devWarn(message: string, error?: unknown) {
  if (!import.meta.env.DEV) return
  if (error) {
    console.warn(`[Ecosphere audio] ${message}`, error)
    return
  }
  console.warn(`[Ecosphere audio] ${message}`)
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const ambientLayerRef = useRef<AmbientLayerState | null>(null)
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null)
  const sourceNodesRef = useRef<AudioScheduledSourceNode[]>([])
  const [debug, setDebug] = useState<AudioDebugState>(() => ({
    unlocked: false,
    soundEnabled: window.localStorage.getItem('ecosphere:sound-enabled') === 'true',
    currentSource: null,
    lastAttempt: null,
    lastError: null,
    browserSupport: getBrowserSupport(),
  }))

  const updateDebug = useCallback((patch: Partial<AudioDebugState>) => {
    setDebug((current) => ({ ...current, ...patch }))
  }, [])

  const setSoundEnabled = useCallback((enabled: boolean) => {
    window.localStorage.setItem('ecosphere:sound-enabled', enabled ? 'true' : 'false')
    updateDebug({ soundEnabled: enabled })
  }, [updateDebug])

  const ensureAudioContext = useCallback(() => {
    const AudioContextCtor = window.AudioContext || (window as BrowserAudioWindow).webkitAudioContext
    if (!AudioContextCtor) {
      updateDebug({ lastError: 'AudioContext is not supported in this browser.' })
      devWarn('AudioContext is not supported in this browser.')
      return null
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor()
    }
    return audioContextRef.current
  }, [updateDebug])

  const stopAll = useCallback(() => {
    sourceNodesRef.current.forEach((node) => {
      try {
        node.stop()
      } catch {
        // The browser may have already ended the scheduled source.
      }
    })
    sourceNodesRef.current = []

    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause()
      htmlAudioRef.current.removeAttribute('src')
      htmlAudioRef.current.load()
      htmlAudioRef.current = null
    }

    updateDebug({ currentSource: null })
  }, [updateDebug])

  const unlock = useCallback(async (reason = 'user interaction') => {
    updateDebug({ lastAttempt: `unlock: ${reason}`, lastError: null })
    const context = ensureAudioContext()
    if (!context) return false

    try {
      if (context.state === 'suspended') {
        await context.resume()
      }
      setSoundEnabled(true)
      updateDebug({ unlocked: true })
      return true
    } catch (error) {
      const message = 'Audio was blocked by the browser until another tap.'
      updateDebug({ unlocked: false, lastError: message })
      devWarn(message, error)
      return false
    }
  }, [ensureAudioContext, setSoundEnabled, updateDebug])

  const setAmbientLayer = useCallback(async (layer: AmbientLayerKey, label = `ambient layer: ${layer}`) => {
    updateDebug({ lastAttempt: label, lastError: null })
    const context = ensureAudioContext()
    if (!context) return false

    try {
      if (context.state === 'suspended') {
        await context.resume()
      }

      const now = context.currentTime
      const previousLayer = ambientLayerRef.current

      if (previousLayer?.layer === layer) {
        return true
      }

      // Crossfade out previous layer
      if (previousLayer) {
        previousLayer.gain.gain.cancelScheduledValues(now)
        previousLayer.gain.gain.setValueAtTime(previousLayer.gain.gain.value, now)
        previousLayer.gain.gain.linearRampToValueAtTime(0, now + 0.72)
        window.setTimeout(() => {
          previousLayer.nodes.forEach((node) => {
            try {
              node.stop()
            } catch {
              // Already stopped.
            }
          })
          previousLayer.gain.disconnect()
        }, 820)
      }

      if (layer === 'silent') {
        ambientLayerRef.current = null
        return true
      }

      const definition = ambientLayerDefinitions[layer]
      const tone = context.createOscillator()
      const shimmer = context.createOscillator()
      const noise = context.createBufferSource()
      const filter = context.createBiquadFilter()
      const gain = context.createGain()
      const noiseGain = context.createGain()

      const noiseBuffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * 2)), context.sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      for (let index = 0; index < noiseData.length; index += 1) {
        noiseData[index] = (Math.random() * 2 - 1) * definition.noise
      }

      tone.type = definition.tone
      tone.frequency.setValueAtTime(definition.frequency, now)
      shimmer.type = 'sine'
      shimmer.frequency.setValueAtTime(definition.frequency * 1.505, now)
      noise.buffer = noiseBuffer
      noise.loop = true
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(definition.filterFrequency, now)

      // Crossfade in new layer
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(definition.volume, now + 0.9)
      noiseGain.gain.setValueAtTime(0.55, now)

      tone.connect(filter)
      shimmer.connect(filter)
      noise.connect(noiseGain)
      noiseGain.connect(filter)
      filter.connect(gain)
      gain.connect(context.destination)

      tone.start(now)
      shimmer.start(now)
      noise.start(now)

      ambientLayerRef.current = { gain, layer, nodes: [tone, shimmer, noise] }
      setSoundEnabled(true)
      updateDebug({ unlocked: true })
      return true
    } catch (error) {
      const message = `${label} could not start.`
      updateDebug({ lastError: message })
      devWarn(message, error)
      return false
    }
  }, [ensureAudioContext, setSoundEnabled, updateDebug])

  const playUrl = useCallback(async (url: string | undefined | null, options: PlayUrlOptions) => {
    updateDebug({ lastAttempt: options.label, lastError: null })

    if (!url) {
      const message = `${options.label} has no audio source.`
      updateDebug({ lastError: message })
      devWarn(message)
      return null
    }

    if (typeof Audio === 'undefined') {
      const message = 'HTML audio is not supported in this browser.'
      updateDebug({ lastError: message })
      devWarn(message)
      return null
    }

    stopAll()

    const audio = new Audio(url)
    audio.preload = 'auto'
    audio.volume = options.volume ?? 0.72

    audio.onerror = () => {
      const message = `${options.label} could not load or decode.`
      updateDebug({ currentSource: null, lastError: message })
      devWarn(message)
    }

    audio.onpause = () => {
      if (!audio.ended) {
        updateDebug({ currentSource: null })
      }
    }

    htmlAudioRef.current = audio

    try {
      await audio.play()
      setSoundEnabled(true)
      updateDebug({ currentSource: options.label, unlocked: true })
      return audio
    } catch (error) {
      const message = 'Playback needs a fresh tap in this browser.'
      updateDebug({ currentSource: null, lastError: message })
      devWarn(`${options.label} failed to play.`, error)
      return null
    }
  }, [setSoundEnabled, stopAll, updateDebug])

  const playTone = useCallback(async (key: SampleAudioKey, label?: string) => {
    const sample = sampleAudioDefinitions[key]
    const attemptLabel = label ?? sample.label
    updateDebug({ lastAttempt: attemptLabel, lastError: null })

    const context = ensureAudioContext()
    if (!context) return false

    try {
      if (context.state === 'suspended') {
        await context.resume()
      }

      stopAll()

      const now = context.currentTime
      const tone = context.createOscillator()
      const shimmer = context.createOscillator()
      const gain = context.createGain()
      const filter = context.createBiquadFilter()

      tone.type = key === 'signal-lock' ? 'triangle' : 'sine'
      tone.frequency.setValueAtTime(sample.frequency, now)
      shimmer.type = 'sine'
      shimmer.frequency.setValueAtTime(sample.frequency * 1.51, now)
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(920, now)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(sample.volume, now + 0.12)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + sample.duration)

      tone.connect(filter)
      shimmer.connect(filter)
      filter.connect(gain)
      gain.connect(context.destination)

      tone.start(now)
      shimmer.start(now)
      tone.stop(now + sample.duration)
      shimmer.stop(now + sample.duration)

      sourceNodesRef.current = [tone, shimmer]
      setSoundEnabled(true)
      updateDebug({ currentSource: attemptLabel, unlocked: true })

      window.setTimeout(() => {
        updateDebug({ currentSource: null })
      }, sample.duration * 1000 + 80)

      return true
    } catch (error) {
      const message = `${attemptLabel} could not play.`
      updateDebug({ currentSource: null, lastError: message })
      devWarn(message, error)
      return false
    }
  }, [ensureAudioContext, setSoundEnabled, stopAll, updateDebug])

  const manager = useMemo<AudioManager>(() => ({
    debug,
    samples: sampleAudioDefinitions,
    setSoundEnabled,
    setAmbientLayer,
    unlock,
    playUrl,
    playSample: playTone,
    playTone,
    stopAll,
  }), [debug, playTone, playUrl, setAmbientLayer, setSoundEnabled, stopAll, unlock])

  return <AudioContextValue.Provider value={manager}>{children}</AudioContextValue.Provider>
}

export function useAudioManager() {
  const manager = useContext(AudioContextValue)
  if (!manager) {
    throw new Error('useAudioManager must be used inside AudioProvider')
  }
  return manager
}

export function AudioDebugPanel({ activePage }: { activePage: string }) {
  const audio = useAudioManager()
  const isVisible = import.meta.env.DEV || new URLSearchParams(window.location.search).get('audioDebug') === 'true'

  if (!isVisible) return null

  return (
    <aside className="audio-debug-panel" aria-label="Audio debug panel">
      <strong>audio debug</strong>
      <span>active page: {activePage}</span>
      <span>audio unlocked: {audio.debug.unlocked ? 'yes' : 'no'}</span>
      <span>sound enabled: {audio.debug.soundEnabled ? 'yes' : 'no'}</span>
      <span>current source: {audio.debug.currentSource ?? 'none'}</span>
      <span>last attempt: {audio.debug.lastAttempt ?? 'none'}</span>
      <span>last error: {audio.debug.lastError ?? 'none'}</span>
      <span>
        support: context {audio.debug.browserSupport.audioContext ? 'yes' : 'no'} / html {audio.debug.browserSupport.htmlAudio ? 'yes' : 'no'} / mic {audio.debug.browserSupport.microphone ? 'yes' : 'no'} / recorder {audio.debug.browserSupport.mediaRecorder ? 'yes' : 'no'}
      </span>
      <div>
        <button type="button" onClick={() => { void audio.playSample('opening') }}>opening</button>
        <button type="button" onClick={() => { void audio.playSample('signal-lock') }}>lock-in</button>
        <button type="button" onClick={() => { void audio.playSample('room') }}>room</button>
        <button type="button" onClick={() => { void audio.playSample('relic') }}>relic</button>
        <button type="button" onClick={() => { void audio.playSample('archive') }}>archive</button>
        <button type="button" onClick={() => { void audio.playSample('recording') }}>recording</button>
        <button type="button" onClick={() => { void audio.playSample('distant-voice') }}>distant</button>
        <button type="button" onClick={() => { void audio.playSample('ui-tap') }}>tap</button>
      </div>
    </aside>
  )
}
