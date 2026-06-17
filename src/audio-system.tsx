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
  setFrequencySeaIntensity: (value: number) => void
  startFrequencySea: (label?: string) => Promise<boolean>
  stopFrequencySea: () => void
}

type AmbientLayerState = {
  gain: GainNode
  layer: AmbientLayerKey
  nodes: AudioScheduledSourceNode[]
}
type FrequencySeaLayerState = {
  crackleGain: GainNode
  crackleFilter: BiquadFilterNode
  crackleSource: AudioBufferSourceNode
  deepGain: GainNode
  deepLfo: OscillatorNode
  deepLfoGain: GainNode
  deepOscillator: OscillatorNode
  hissFilter: BiquadFilterNode
  hissGain: GainNode
  hissSource: AudioBufferSourceNode
  intensity: number
  masterGain: GainNode
  modulationTimer: number | null
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

/** Read the persisted sound-enabled flag without ever throwing. Embedded
 *  webviews (e.g. in-app browsers) and private mode can make localStorage
 *  access throw rather than return null — and this runs in a render-time state
 *  initializer, so an unguarded read would crash the whole app on first paint. */
function readSoundEnabled(): boolean {
  try { return window.localStorage.getItem('ecosphere:sound-enabled') === 'true' } catch { return false }
}

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
    soundEnabled: readSoundEnabled(),
    currentSource: null,
    lastAttempt: null,
    lastError: null,
    browserSupport: getBrowserSupport(),
  }))

  const updateDebug = useCallback((patch: Partial<AudioDebugState>) => {
    setDebug((current) => ({ ...current, ...patch }))
  }, [])

  const frequencySeaRef = useRef<FrequencySeaLayerState | null>(null)

  const stopFrequencySea = useCallback(() => {
    const sea = frequencySeaRef.current
    if (!sea) return
    const context = audioContextRef.current
    const now = context?.currentTime ?? 0
    if (sea.modulationTimer !== null) {
      window.clearInterval(sea.modulationTimer)
    }
    try {
      sea.masterGain.gain.cancelScheduledValues(now)
      sea.masterGain.gain.setValueAtTime(sea.masterGain.gain.value, now)
      sea.masterGain.gain.linearRampToValueAtTime(0, now + 0.7)
    } catch {
      // The context may have already been closed by the browser.
    }
    window.setTimeout(() => {
      ;[sea.deepOscillator, sea.deepLfo, sea.hissSource, sea.crackleSource].forEach((node) => {
        try { node.stop() } catch { /* Already stopped. */ }
      })
      ;[
        sea.deepOscillator, sea.deepLfo, sea.deepLfoGain, sea.deepGain,
        sea.hissSource, sea.hissFilter, sea.hissGain,
        sea.crackleSource, sea.crackleFilter, sea.crackleGain,
        sea.masterGain,
      ].forEach((node) => {
        try { node.disconnect() } catch { /* Already disconnected. */ }
      })
    }, 760)
    frequencySeaRef.current = null
    updateDebug({ currentSource: null })
  }, [updateDebug])

  const createNoiseBuffer = useCallback((context: AudioContext, durationSeconds = 2, amplitude = 1) => {
    const noiseBuffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * durationSeconds)), context.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    let previousWhite = 0
    let pink = 0
    for (let index = 0; index < noiseData.length; index += 1) {
      const white = Math.random() * 2 - 1
      pink = (pink * 0.985) + ((white + previousWhite) * 0.0075)
      previousWhite = white
      noiseData[index] = pink * amplitude
    }
    return noiseBuffer
  }, [])

  const setFrequencySeaIntensity = useCallback((value: number) => {
    const sea = frequencySeaRef.current
    const context = audioContextRef.current
    if (!sea || !context) return
    const intensity = Math.min(1, Math.max(0.18, value))
    const now = context.currentTime
    sea.intensity = intensity
    sea.masterGain.gain.cancelScheduledValues(now)
    sea.masterGain.gain.setTargetAtTime(0.045 * intensity, now, 0.24)
    sea.deepGain.gain.setTargetAtTime(0.018 * intensity, now, 0.3)
    sea.hissGain.gain.setTargetAtTime(0.032 * intensity, now, 0.28)
    sea.crackleGain.gain.setTargetAtTime(0.004 * intensity, now, 0.18)
  }, [])

  const setSoundEnabled = useCallback((enabled: boolean) => {
    window.localStorage.setItem('ecosphere:sound-enabled', enabled ? 'true' : 'false')
    if (!enabled) {
      stopFrequencySea()
    }
    updateDebug({ soundEnabled: enabled })
  }, [stopFrequencySea, updateDebug])

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

  const startFrequencySea = useCallback(async (label = 'frequency sea') => {
    updateDebug({ lastAttempt: label, lastError: null })
    const context = ensureAudioContext()
    if (!context) return false
    try {
      if (context.state === 'suspended') {
        await context.resume()
      }
      if (frequencySeaRef.current) {
        setSoundEnabled(true)
        updateDebug({ currentSource: label, unlocked: true })
        return true
      }
      const now = context.currentTime
      const masterGain = context.createGain()
      const deepOscillator = context.createOscillator()
      const deepLfo = context.createOscillator()
      const deepGain = context.createGain()
      const hissSource = context.createBufferSource()
      const hissFilter = context.createBiquadFilter()
      const hissGain = context.createGain()
      const crackleSource = context.createBufferSource()
      const crackleFilter = context.createBiquadFilter()
      const crackleGain = context.createGain()
      const lfoGain = context.createGain()
      masterGain.gain.setValueAtTime(0.0001, now)
      masterGain.gain.exponentialRampToValueAtTime(0.045, now + 0.9)
      deepOscillator.type = 'sine'
      deepOscillator.frequency.setValueAtTime(38, now)
      deepLfo.type = 'sine'
      deepLfo.frequency.setValueAtTime(0.05, now)
      lfoGain.gain.setValueAtTime(7, now)
      deepGain.gain.setValueAtTime(0.018, now)
      hissSource.buffer = createNoiseBuffer(context, 2, 0.75)
      hissSource.loop = true
      hissFilter.type = 'bandpass'
      hissFilter.Q.setValueAtTime(2.1, now)
      hissFilter.frequency.setValueAtTime(280, now)
      hissGain.gain.setValueAtTime(0.032, now)
      crackleSource.buffer = createNoiseBuffer(context, 1.2, 0.36)
      crackleSource.loop = true
      crackleFilter.type = 'highpass'
      crackleFilter.frequency.setValueAtTime(3200, now)
      crackleGain.gain.setValueAtTime(0.0035, now)
      deepLfo.connect(lfoGain)
      lfoGain.connect(deepOscillator.frequency)
      deepOscillator.connect(deepGain)
      deepGain.connect(masterGain)
      hissSource.connect(hissFilter)
      hissFilter.connect(hissGain)
      hissGain.connect(masterGain)
      crackleSource.connect(crackleFilter)
      crackleFilter.connect(crackleGain)
      crackleGain.connect(masterGain)
      masterGain.connect(context.destination)
      deepOscillator.start(now)
      deepLfo.start(now)
      hissSource.start(now)
      crackleSource.start(now)
      const seaState: FrequencySeaLayerState = {
        crackleGain,
        crackleFilter,
        crackleSource,
        deepGain,
        deepLfo,
        deepLfoGain: lfoGain,
        deepOscillator,
        hissFilter,
        hissGain,
        hissSource,
        intensity: 1,
        masterGain,
        modulationTimer: null,
      }
      seaState.modulationTimer = window.setInterval(() => {
        const activeSea = frequencySeaRef.current
        const activeContext = audioContextRef.current
        if (!activeSea || !activeContext) return
        const activeNow = activeContext.currentTime
        const wave = (Math.sin(activeNow * 1.2) + 1) / 2
        const filterFrequency = 150 + (wave * 300)
        activeSea.hissFilter.frequency.setTargetAtTime(filterFrequency, activeNow, 0.42)
        activeSea.crackleGain.gain.setTargetAtTime((0.002 + wave * 0.006) * activeSea.intensity, activeNow, 0.09)
        activeSea.deepOscillator.frequency.setTargetAtTime(32 + wave * 16, activeNow, 0.62)
      }, 80)
      frequencySeaRef.current = seaState
      setSoundEnabled(true)
      updateDebug({ currentSource: label, unlocked: true })
      return true
    } catch (error) {
      const message = `${label} could not start.`
      updateDebug({ currentSource: null, lastError: message })
      devWarn(message, error)
      stopFrequencySea()
      return false
    }
  }, [createNoiseBuffer, ensureAudioContext, setSoundEnabled, stopFrequencySea, updateDebug])

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
    setFrequencySeaIntensity,
    startFrequencySea,
    stopFrequencySea,
  }), [createNoiseBuffer, debug, playTone, playUrl, setAmbientLayer, setFrequencySeaIntensity, setSoundEnabled, startFrequencySea, stopAll, stopFrequencySea, unlock])

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
