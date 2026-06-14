import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import TypewriterText from './TypewriterText'
import ColorWave from './ColorWave'

type IntroSequenceProps = {
  onComplete: () => void
  onSkip?: () => void
}

type BrowserAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

type MicPermissionState = 'idle' | 'asking' | 'listening' | 'denied' | 'skipped'

const bootSequenceLines = [
  'restoring dormant frequencies',
  'reconnecting lost carriers',
  'stabilizing nocturne band',
  'signal bloom detected nearby',
]

const emotionalPrompts = [
  'what does silence sound like to you?',
  'what keeps you awake after everyone logs off?',
  'what frequency do you return to most?',
  'what thought keeps replaying?',
  'what does the internet remember about you?',
]

const micWaveformBarCount = 18

function IntroWaveform({ active = false, bars = 9 }: { active?: boolean; bars?: number }) {
  return (
    <div className={`waveform ${active ? 'active' : ''}`} aria-hidden="true">
      {Array.from({ length: bars }, (_, index) => (
        <i key={index} style={{ '--delay': `${index * 74}ms`, '--height': `${30 + ((index * 17) % 54)}%` } as CSSProperties} />
      ))}
    </div>
  )
}

// Ambient signal readouts that hang in the margins — faint, off-center, slowly
// drifting. They give the boot screen the feel of a system quietly running
// around you, breaking the perfect centered symmetry without becoming chaos.
function BootAmbientHud() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 2300)
    return () => window.clearInterval(id)
  }, [])
  const freq = (107.7 + ((tick * 0.013) % 1.6)).toFixed(2)
  const packets = (48213 + tick * 17).toLocaleString()
  const level = 4 + (tick % 4)
  const bars = '▰'.repeat(level) + '▱'.repeat(8 - level)
  const lat = (51.5074 + Math.sin(tick * 0.21) * 0.004).toFixed(4)
  const lon = (-0.1278 + Math.cos(tick * 0.17) * 0.004).toFixed(4)
  const drift = (Math.sin(tick * 0.33) * 1.4).toFixed(1)
  const up = 187 + tick * 2
  const mm = String(Math.floor(up / 60) % 60).padStart(2, '0')
  const ss = String(up % 60).padStart(2, '0')
  return (
    <div className="boot-hud" aria-hidden="true">
      <span className="boot-hud-item boot-hud-tl">nocturne band · {freq} mhz</span>
      <span className="boot-hud-item boot-hud-l">carrier lock <i className="boot-hud-bars">{bars}</i></span>
      <span className="boot-hud-item boot-hud-tr">lat {lat}<br />lon {lon}</span>
      <span className="boot-hud-item boot-hud-r">packets {packets}</span>
      <span className="boot-hud-item boot-hud-bl">uplink 00:{mm}:{ss}</span>
      <span className="boot-hud-item boot-hud-br">drift {drift}°</span>
    </div>
  )
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (!window.matchMedia) {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updatePreference)
      return () => mediaQuery.removeEventListener('change', updatePreference)
    }

    mediaQuery.addListener(updatePreference)
    return () => mediaQuery.removeListener(updatePreference)
  }, [])

  return prefersReducedMotion
}
export default function IntroSequence({ onComplete, onSkip }: IntroSequenceProps) {
  const [phase, setPhase] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [micActive, setMicActive] = useState(false)
  const [micPermissionState, setMicPermissionState] = useState<MicPermissionState>('idle')
  const [micLevel, setMicLevel] = useState(0.18)
  const [micWaveform, setMicWaveform] = useState(() => Array.from({ length: micWaveformBarCount }, () => 0.18))
  const [finalLine, setFinalLine] = useState('the ecosystem remembers.')
  const audioContextRef = useRef<AudioContext | null>(null)
  const ambientNodesRef = useRef<AudioNode[]>([])
  const masterGainRef = useRef<GainNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const analyserFrameRef = useRef<number | null>(null)
  const lastWaveformUpdateRef = useRef(0)
  const prefersReducedMotion = usePrefersReducedMotion()
  const prompt = useMemo(() => emotionalPrompts[Math.floor(Math.random() * emotionalPrompts.length)], [])
  const detectionLines = useMemo(() => ['signal detected'], [])
  const calibrationLines = useMemo(() => ['attempting emotional calibration'], [])
  const promptLines = useMemo(() => [prompt], [prompt])
  const finalLines = useMemo(() => [finalLine], [finalLine])
  const reducedMotionTransition = { duration: 0.18 }

  const closeIdleAudioContext = useCallback(() => {
    if (!masterGainRef.current && audioContextRef.current) {
      const context = audioContextRef.current
      audioContextRef.current = null
      void context.close()
    }
  }, [])

  const stopMic = useCallback(() => {
    if (analyserFrameRef.current !== null) {
      cancelAnimationFrame(analyserFrameRef.current)
      analyserFrameRef.current = null
    }

    micSourceRef.current?.disconnect()
    micAnalyserRef.current?.disconnect()
    micSourceRef.current = null
    micAnalyserRef.current = null
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    micStreamRef.current = null
    setMicActive(false)
    setMicWaveform(Array.from({ length: micWaveformBarCount }, () => 0.18))
    closeIdleAudioContext()
  }, [closeIdleAudioContext])

  const skipCalibration = () => {
    stopMic()
    setMicPermissionState('skipped')
    setMicLevel(0.18)
    playPulse(104, 0.62)
  }

  const stopSoundscape = useCallback(() => {
    const context = audioContextRef.current
    const masterGain = masterGainRef.current

    if (context && masterGain) {
      masterGain.gain.cancelScheduledValues(context.currentTime)
      masterGain.gain.setValueAtTime(masterGain.gain.value, context.currentTime)
      masterGain.gain.linearRampToValueAtTime(0.0001, context.currentTime + 0.65)
    }

    ambientNodesRef.current.forEach((node) => {
      if ('stop' in node && typeof node.stop === 'function') {
        const sourceNode = node as AudioScheduledSourceNode
        try {
          sourceNode.stop((context?.currentTime ?? 0) + 0.72)
        } catch {
          // The audio clock may have already ended the node.
        }
      }
    })
    ambientNodesRef.current = []
    masterGainRef.current = null

    if (context) {
      window.setTimeout(() => {
        if (audioContextRef.current === context) {
          void context.close()
          audioContextRef.current = null
        }
      }, 780)
    }

    setSoundEnabled(false)
  }, [])
  const ensureAudioContext = useCallback(() => {
    const AudioContextConstructor = window.AudioContext || (window as BrowserAudioWindow).webkitAudioContext

    if (!AudioContextConstructor) {
      return null
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor()
    }

    return audioContextRef.current
  }, [])

  const createStaticNoise = useCallback((context: AudioContext) => {
    const bufferSize = context.sampleRate * 2
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate)
    const output = buffer.getChannelData(0)

    for (let index = 0; index < bufferSize; index += 1) {
      output[index] = (Math.random() * 2 - 1) * 0.42
    }

    const noise = context.createBufferSource()
    noise.buffer = buffer
    noise.loop = true

    return noise
  }, [])

  const playPulse = useCallback((frequency = 144, duration = 0.8) => {
    const context = ensureAudioContext()

    if (!context) {
      return
    }

    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
    oscillator.connect(gain)
    gain.connect(masterGainRef.current ?? context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + duration)
  }, [ensureAudioContext])

  const enableSoundscape = () => {
    const context = ensureAudioContext()

    if (!context || soundEnabled) {
      return
    }

    const drone = context.createOscillator()
    const pulse = context.createOscillator()
    const shimmer = context.createOscillator()
    const staticNoise = createStaticNoise(context)
    const masterGain = context.createGain()
    const droneGain = context.createGain()
    const pulseGain = context.createGain()
    const shimmerGain = context.createGain()
    const staticGain = context.createGain()
    const lfo = context.createOscillator()
    const lfoGain = context.createGain()

    drone.type = 'sine'
    drone.frequency.value = 54
    pulse.type = 'triangle'
    pulse.frequency.value = 27
    shimmer.type = 'sine'
    shimmer.frequency.value = 146.83
    lfo.frequency.value = 0.09
    lfoGain.gain.value = 0.012
    masterGain.gain.setValueAtTime(0.0001, context.currentTime)
    masterGain.gain.linearRampToValueAtTime(0.58, context.currentTime + 1.8)
    droneGain.gain.value = 0.028
    pulseGain.gain.value = 0.01
    shimmerGain.gain.value = 0.006
    staticGain.gain.value = 0.012
    lfo.connect(lfoGain)
    lfoGain.connect(droneGain.gain)
    drone.connect(droneGain)
    pulse.connect(pulseGain)
    shimmer.connect(shimmerGain)
    staticNoise.connect(staticGain)
    droneGain.connect(masterGain)
    pulseGain.connect(masterGain)
    shimmerGain.connect(masterGain)
    staticGain.connect(masterGain)
    masterGain.connect(context.destination)
    drone.start()
    pulse.start()
    shimmer.start()
    staticNoise.start()
    lfo.start()
    masterGainRef.current = masterGain
    ambientNodesRef.current = [drone, pulse, shimmer, staticNoise, droneGain, pulseGain, shimmerGain, staticGain, masterGain, lfo, lfoGain]
    setSoundEnabled(true)
    playPulse(196, 1.1)
  }
  const activateMic = async () => {
    stopMic()
    playPulse(220, 0.7)

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermissionState('denied')
      setMicLevel(0.22)
      closeIdleAudioContext()
      return
    }

    try {
      const context = ensureAudioContext()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      if (!context) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()

      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.72
      const data = new Uint8Array(analyser.frequencyBinCount)
      source.connect(analyser)
      micStreamRef.current = stream
      micSourceRef.current = source
      micAnalyserRef.current = analyser
      setMicActive(true)
      setMicPermissionState('listening')

      const sampleVoice = (timestamp = 0) => {
        analyser.getByteTimeDomainData(data)
        const average = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length
        setMicLevel(Math.max(0.12, Math.min(1, average / 82)))

        if (timestamp - lastWaveformUpdateRef.current > 48) {
          lastWaveformUpdateRef.current = timestamp
          const stride = Math.max(1, Math.floor(data.length / micWaveformBarCount))
          setMicWaveform(Array.from({ length: micWaveformBarCount }, (_, index) => {
            const value = data[index * stride] ?? 128
            return Math.max(0.12, Math.min(1, Math.abs(value - 128) / 54))
          }))
        }

        analyserFrameRef.current = requestAnimationFrame(sampleVoice)
      }

      sampleVoice()
    } catch {
      setMicActive(false)
      setMicPermissionState('denied')
      setMicLevel(0.2)
      closeIdleAudioContext()
    }
  }

  const advanceToClaim = () => {
    stopMic()
    setPhase(3)
    playPulse(92, 1.35)
  }

  const enterEcosphere = () => {
    setFinalLine(['the ecosystem remembers.', 'the quiet is listening.', 'someone else is still awake.'][Math.floor(Math.random() * 3)])
    setPhase(4)
    playPulse(132, 1.2)
    stopSoundscape()
  }

  const skipIntro = () => {
    stopMic()
    stopSoundscape()
    if (onSkip) {
      onSkip()
      return
    }

    onComplete()
  }

  useEffect(() => {
    if (phase >= 2) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setPhase((currentPhase) => currentPhase + 1)
      if (soundEnabled) {
        playPulse(phase === 0 ? 118 : 164, 0.9)
      }
    }, phase === 0 ? 3300 : 6200)

    return () => window.clearTimeout(timer)
  }, [phase, playPulse, soundEnabled])

  useEffect(() => {
    if (phase !== 4) {
      return undefined
    }

    const timer = window.setTimeout(onComplete, 2600)

    return () => window.clearTimeout(timer)
  }, [onComplete, phase])

  useEffect(() => () => {
    stopMic()
    stopSoundscape()
  }, [stopMic, stopSoundscape])
  return (
    <main className={`claim-signal-shell cinematic-boot phase-${phase} ${prefersReducedMotion ? 'motion-reduced' : ''}`} style={{ '--mic-level': micLevel } as CSSProperties}>
      <div className="claim-atmosphere" aria-hidden="true">
        <span /><span /><span /><span /><span /><span />
      </div>
      <ColorWave />
      <div className="boot-static-field" aria-hidden="true" />
      <div className="boot-fog-field" aria-hidden="true" />

      <section className="claim-signal-screen boot-sequence-screen" aria-label="Ecosphere boot sequence">
        <button className="boot-audio-toggle" type="button" onClick={enableSoundscape}>
          {soundEnabled ? 'ambient signal on' : 'enable soundscape'}
        </button>
        <button className="boot-skip-intro" type="button" onClick={skipIntro}>
          skip intro
        </button>

        <div className="claim-orb-field boot-orb-field" aria-hidden="true">
          <div className="boot-resonance-rings">
            <span /><span /><span />
          </div>
          <div className="claim-orb-ripple" />
          <div className="claim-orb-ripple claim-orb-ripple-two" />
          <div className="boot-orbit boot-orbit-one" />
          <div className="boot-orbit boot-orbit-two" />
          <div className="claim-signal-orb pink-core">
            <i /><b />
          </div>
          <div className="claim-tuning-wave">
            <IntroWaveform active={phase >= 2 || micActive} bars={9} />
          </div>
        </div>

        <BootAmbientHud />

        <AnimatePresence mode="wait">
          {phase === 0 ? (
            <motion.div className="boot-phase boot-detection" key="detection"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(14px)' }}
              transition={prefersReducedMotion ? reducedMotionTransition : { duration: 1.4 }}>
              <span className="boot-dot" />
              <p><TypewriterText cursor={false} instant={prefersReducedMotion} lines={detectionLines} speedMs={54} /></p>
              <small><TypewriterText fadeOut={!prefersReducedMotion} instant={prefersReducedMotion} lines={calibrationLines} speedMs={46} /></small>
            </motion.div>
          ) : null}

          {phase === 1 ? (
            <motion.div className="boot-phase boot-system" key="system"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(16px)' }}
              transition={prefersReducedMotion ? reducedMotionTransition : { duration: 1.2 }}>
              <span>ECOSPHERE BOOT // NOCTURNE BAND</span>
              <h1>the network is waking up.</h1>
              <div className="boot-lines">
                <TypewriterText fadeOut={!prefersReducedMotion} instant={prefersReducedMotion} lines={bootSequenceLines} linePauseMs={520} speedMs={32} />
              </div>
            </motion.div>
          ) : null}

          {phase === 2 ? (
            <motion.div className="boot-phase boot-human" key="human"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(14px)' }}
              transition={prefersReducedMotion ? reducedMotionTransition : { duration: 1.2 }}>
              <span>HUMAN PROMPT // LIVE CALIBRATION</span>
              <h2><TypewriterText cursor={!prefersReducedMotion} instant={prefersReducedMotion} lines={promptLines} speedMs={38} /></h2>
              {micActive ? (
                <div className="boot-mic-wave listening" aria-hidden="true">
                  {micWaveform.map((value, index) => (
                    <i key={index} style={{ '--live-level': value } as CSSProperties} />
                  ))}
                </div>
              ) : null}
              {micPermissionState === 'asking' ? (
                <div className="boot-permission-panel">
                  <p>your microphone drives this visual calibration only. nothing is recorded, saved, or uploaded.</p>
                  <div>
                    <button type="button" onClick={() => { void activateMic() }}>allow calibration</button>
                    <button type="button" onClick={skipCalibration}>skip calibration</button>
                  </div>
                </div>
              ) : null}
              {micPermissionState === 'denied' || micPermissionState === 'skipped' ? (
                <p className="boot-calibration-state">
                  {micPermissionState === 'denied' ? 'calibration skipped. the microphone was never opened.' : 'calibration skipped. your signal can still enter quietly.'}
                </p>
              ) : null}
              <div className="boot-human-actions">
                <button className="boot-mic-button" disabled={micPermissionState === 'asking'} type="button" onClick={() => setMicPermissionState('asking')}>
                  <span />
                  {micActive ? 'listening' : micPermissionState === 'asking' ? 'awaiting permission' : 'calibrate signal'}
                </button>
                <button type="button" onClick={skipCalibration}>skip softly</button>
              </div>
              {micActive || micPermissionState === 'denied' || micPermissionState === 'skipped' ? (
                <button className="boot-continue-button" type="button" onClick={advanceToClaim}>continue</button>
              ) : null}
            </motion.div>
          ) : null}

          {phase === 3 ? (
            <motion.div className="boot-phase boot-claim" key="claim"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(16px)' }}
              transition={prefersReducedMotion ? reducedMotionTransition : { duration: 1.1 }}>
              <div className="claim-copy boot-claim-copy">
                <p>IDENTITY CHANNEL // OPENING</p>
                <h1>your signal is ready.</h1>
                <span>a private frequency is waiting to be claimed.</span>
              </div>
              <button className="claim-enter-button boot-identity-button" type="button" onClick={enterEcosphere}>
                continue to identity
              </button>
            </motion.div>
          ) : null}

          {phase === 4 ? (
            <motion.div className="boot-phase boot-enter" key="enter"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={prefersReducedMotion ? reducedMotionTransition : { duration: 1.4 }}>
              <p><TypewriterText cursor={!prefersReducedMotion} fadeOut={!prefersReducedMotion} instant={prefersReducedMotion} lines={finalLines} speedMs={52} /></p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    </main>
  )
}
