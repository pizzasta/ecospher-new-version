// Voice duets — record your voice layered over someone else's signal.
//
// The original plays in your ears while the mic records; both are mixed
// digitally inside one AudioContext and captured as a single clip, so the
// duet stays in sync on any device and posts like any other voice signal
// (same upload limits, same moderation). Headphones keep the speaker out
// of the mic; echo cancellation covers the rest.

import { AUDIO_BUDGET, createVoiceRecorder } from './audioBudget'

export const DUET_MIN_MS = 3000
export const DUET_MAX_MS = AUDIO_BUDGET.maxNoteSeconds * 1000
/** the original sits under your voice in the mix */
export const DUET_ORIGINAL_GAIN = 0.55

export type DuetResult = { blob: Blob; durationMs: number }

export type DuetSession = {
  /** live mic level 0..1 for the meter */
  level: () => number
  /** stop now; resolves `done` */
  stop: () => void
  /** null when nothing usable was captured */
  done: Promise<DuetResult | null>
}

/** Caption a duet carries into the feed. */
export function duetCaption(handle: string, words = ''): string {
  const who = handle.replace(/^@+/, '').trim() || 'anonymous'
  const extra = words.trim().replace(/\s+/g, ' ')
  return extra ? `duet ⧉ @${who} — ${extra}` : `duet ⧉ @${who}`
}

/** Clamp a recorded length into what the network accepts. */
export function duetLength(ms: number): number {
  return Math.max(0, Math.min(DUET_MAX_MS, Math.round(ms)))
}

export function duetSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && typeof AudioContext !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
}

/**
 * Start a duet over `original`. Throws if the mic can't open (callers map
 * the error with micErrorReason). Stops itself at DUET_MAX_MS.
 */
export async function startDuet(original: Blob, onTick?: (ms: number) => void): Promise<DuetSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  const ctx = new AudioContext()
  const cleanupMic = () => stream.getTracks().forEach(t => t.stop())
  let buffer: AudioBuffer
  try {
    if (ctx.state === 'suspended') await ctx.resume()
    buffer = await ctx.decodeAudioData(await original.arrayBuffer())
  } catch (err) {
    cleanupMic()
    void ctx.close().catch(() => { /* closed */ })
    throw err
  }

  const mix = ctx.createMediaStreamDestination()

  // the original: full volume in your ears, tucked under your voice in the mix
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const underGain = ctx.createGain()
  underGain.gain.value = DUET_ORIGINAL_GAIN
  src.connect(underGain)
  underGain.connect(mix)
  src.connect(ctx.destination)

  // your voice: into the mix only — never back out of the speaker
  const mic = ctx.createMediaStreamSource(stream)
  const micGain = ctx.createGain()
  micGain.gain.value = 1
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  mic.connect(micGain)
  micGain.connect(mix)
  mic.connect(analyser)

  const recorder = createVoiceRecorder(mix.stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

  const startedAt = performance.now()
  let stopped = false
  let tick = 0
  const samples = new Uint8Array(analyser.fftSize)

  const done = new Promise<DuetResult | null>(resolve => {
    recorder.onstop = () => {
      const durationMs = duetLength(performance.now() - startedAt)
      cleanupMic()
      void ctx.close().catch(() => { /* closed */ })
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      resolve(blob.size > 0 ? { blob, durationMs } : null)
    }
    recorder.onerror = () => { cleanupMic(); void ctx.close().catch(() => { /* closed */ }); resolve(null) }
  })

  const stop = () => {
    if (stopped) return
    stopped = true
    window.clearInterval(tick)
    try { src.stop() } catch { /* never started or already ended */ }
    try { if (recorder.state !== 'inactive') recorder.stop() } catch { /* already stopped */ }
  }

  recorder.start(250)
  src.start()
  tick = window.setInterval(() => {
    const ms = performance.now() - startedAt
    onTick?.(ms)
    if (ms >= DUET_MAX_MS) stop()
  }, 150)

  return {
    level: () => {
      analyser.getByteTimeDomainData(samples)
      let peak = 0
      for (const v of samples) peak = Math.max(peak, Math.abs(v - 128))
      return Math.min(1, peak / 64)
    },
    stop,
    done,
  }
}
