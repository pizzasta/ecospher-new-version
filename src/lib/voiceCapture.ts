// Listens for a few seconds and hands back raw samples for analyzeVoice().
// The audio stays in memory only for the length of the analysis.

export type VoiceTake = { samples: Float32Array; sampleRate: number }

/**
 * `ctx` must be created (and resumed) inside the tap that started this, before
 * any await, or iOS Safari leaves it suspended.
 */
export async function captureVoice(
  ctx: AudioContext,
  ms: number,
  onLevel: (level: number, elapsedMs: number) => void,
  cancelled: () => boolean = () => false,
): Promise<VoiceTake> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // keep the grain of the voice: no noise suppression, just level control
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
  })
  if (ctx.state === 'suspended') await ctx.resume().catch(() => { /* stays quiet */ })
  const source = ctx.createMediaStreamSource(stream)
  const tap = ctx.createScriptProcessor(4096, 1, 1)
  const mute = ctx.createGain()
  mute.gain.value = 0
  const chunks: Float32Array[] = []
  const started = performance.now()

  return new Promise<VoiceTake>((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      tap.onaudioprocess = null
      try { source.disconnect(); tap.disconnect(); mute.disconnect() } catch { /* already gone */ }
      stream.getTracks().forEach(t => t.stop())
      let total = 0
      for (const c of chunks) total += c.length
      const samples = new Float32Array(total)
      let at = 0
      for (const c of chunks) { samples.set(c, at); at += c.length }
      resolve({ samples, sampleRate: ctx.sampleRate })
    }
    tap.onaudioprocess = e => {
      const data = e.inputBuffer.getChannelData(0)
      chunks.push(new Float32Array(data))
      let peak = 0
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]))
      const elapsed = performance.now() - started
      onLevel(Math.min(1, peak * 2.2), elapsed)
      if (elapsed >= ms || cancelled()) finish()
    }
    source.connect(tap)
    tap.connect(mute)
    mute.connect(ctx.destination)
    // a stalled processor must never trap the person in the listening state
    window.setTimeout(finish, ms + 1500)
  })
}
