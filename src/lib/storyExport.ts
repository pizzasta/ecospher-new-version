import { renderSampleAudio } from './sampleAudio'

// Story export — renders a 1080x1920 Ecosphere signal card to canvas.
// Image export works everywhere; video export (animated waveform) uses
// canvas.captureStream + MediaRecorder where available, with the image
// as the guaranteed fallback.

export type StoryExportOptions = {
  handle: string
  caption: string
  duration: string
  typeLabel: string
  accentColor?: string
  waveformSeed?: number
  /** social overlay line; seeded from a pool when omitted */
  overlay?: string
  /** real audio for the clip; a synthesized voice is used when omitted */
  audioBlob?: Blob
}

const OVERLAY_POOL = [
  (n: number) => `replayed ${n} times tonight`,
  () => 'heard at 3:14am',
  () => 'nobody answered this signal',
  () => 'recovered from a dead zone',
  () => 'unresolved transmission',
  (n: number) => `${n} listeners stayed silently`,
  () => 'fading transmission',
]

function overlayFor(opts: StoryExportOptions): string {
  if (opts.overlay) return opts.overlay
  const seed = opts.waveformSeed ?? 42
  return OVERLAY_POOL[seed % OVERLAY_POOL.length](23 + (seed % 121))
}

const GLITCHES = '▓▒░#%&@/\\<>'

const W = 1080
const H = 1920

function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return Math.abs(s) / 0x7fffffff
  }
}

function buildBars(seed: number, count = 36): number[] {
  const rand = seededRand(seed)
  return Array.from({ length: count }, (_, i) => {
    const shape = Math.sin(i * 0.4 + seed * 0.07) * 0.3 + 0.55
    return Math.max(0.12, Math.min(1, rand() * shape + 0.15))
  })
}

function drawFrame(ctx: CanvasRenderingContext2D, opts: StoryExportOptions, bars: number[], t: number) {
  const accent = opts.accentColor ?? '#ff2d78'

  // background: black with pink/cyan atmosphere
  ctx.fillStyle = '#030712'
  ctx.fillRect(0, 0, W, H)

  const glow1 = ctx.createRadialGradient(W * 0.2, H * 0.16, 0, W * 0.2, H * 0.16, W * 0.7)
  glow1.addColorStop(0, 'rgba(255, 45, 120, 0.22)')
  glow1.addColorStop(1, 'rgba(255, 45, 120, 0)')
  ctx.fillStyle = glow1
  ctx.fillRect(0, 0, W, H)

  const glow2 = ctx.createRadialGradient(W * 0.85, H * 0.78, 0, W * 0.85, H * 0.78, W * 0.7)
  glow2.addColorStop(0, 'rgba(0, 212, 255, 0.16)')
  glow2.addColorStop(1, 'rgba(0, 212, 255, 0)')
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, W, H)

  // scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)'
  for (let y = 0; y < H; y += 7) ctx.fillRect(0, y, W, 2)

  // drifting particles (deterministic, slow)
  const rand = seededRand(opts.waveformSeed ?? 42)
  ctx.save()
  for (let i = 0; i < 26; i++) {
    const px = rand() * W
    const py = (rand() * H + t * 28 * (0.4 + rand())) % H
    const size = rand() * 3.2 + 1
    ctx.globalAlpha = 0.18 + rand() * 0.3
    ctx.fillStyle = i % 3 === 0 ? '#00d4ff' : i % 3 === 1 ? accent : '#9b5de9'
    ctx.beginPath()
    ctx.arc(px, H - py, size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // header
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255, 45, 120, 0.9)'
  ctx.font = '700 34px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText('◈  E C O S P H E R E', W / 2, 200)
  ctx.fillStyle = 'rgba(180, 190, 220, 0.55)'
  ctx.font = '500 28px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText(opts.typeLabel.toLowerCase(), W / 2, 256)

  // handle
  ctx.fillStyle = '#f0f4ff'
  ctx.font = '900 64px "Space Grotesk", system-ui, sans-serif'
  ctx.shadowColor = accent
  ctx.shadowBlur = 36
  ctx.fillText(`@${opts.handle}`, W / 2, H * 0.36)
  ctx.shadowBlur = 0

  // waveform (animated by t)
  const barWidth = 14
  const gap = 10
  const totalWidth = bars.length * (barWidth + gap) - gap
  const baseX = (W - totalWidth) / 2
  const midY = H * 0.52
  bars.forEach((h, i) => {
    const wobble = 0.7 + 0.3 * Math.sin(t * 3 + i * 0.55)
    const barH = h * 240 * wobble + 24
    const x = baseX + i * (barWidth + gap)
    const grad = ctx.createLinearGradient(0, midY - barH / 2, 0, midY + barH / 2)
    grad.addColorStop(0, accent)
    grad.addColorStop(1, 'rgba(0, 212, 255, 0.75)')
    ctx.fillStyle = grad
    const radius = barWidth / 2
    ctx.beginPath()
    ctx.roundRect(x, midY - barH / 2, barWidth, barH, radius)
    ctx.fill()
  })

  // subtitles: live text reconstruction — corrupted phrases stabilize over time
  ctx.fillStyle = 'rgba(220, 228, 250, 0.86)'
  ctx.font = 'italic 500 42px "Space Grotesk", system-ui, sans-serif'
  const words = opts.caption.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(`"${test}"`).width > W - 240 && line) {
      lines.push(line)
      line = word
      if (lines.length === 2) break
    } else {
      line = test
    }
  }
  if (line && lines.length < 3) lines.push(lines.length === 2 ? `${line}…` : line)
  // reconstruction progress: 0 at start, fully stable by ~70% of the clip
  const rebuild = Math.max(0, Math.min(1, t / 5.2))
  let charIndex = 0
  lines.forEach((l, li) => {
    const display = l.split('').map((ch) => {
      if (ch === ' ') { charIndex++; return ' ' }
      const threshold = ((charIndex * 37 + (opts.waveformSeed ?? 7) * 13) % 100) / 100
      charIndex++
      if (rebuild >= threshold) return ch
      // unstable characters flicker between glitch glyphs
      return GLITCHES[(charIndex + Math.floor(t * 9)) % GLITCHES.length]
    }).join('')
    const prefix = li === 0 ? '"' : ''
    const suffix = li === lines.length - 1 && rebuild > 0.9 ? '"' : ''
    ctx.fillText(`${prefix}${display}${suffix}`, W / 2, H * 0.64 + li * 60)
  })

  // social overlay — the emotional hook
  ctx.fillStyle = 'rgba(255, 200, 222, 0.75)'
  ctx.font = '600 30px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText(overlayFor(opts), W / 2, H * 0.64 + lines.length * 60 + 56)

  // duration + progress bar (sweeps with t)
  const progress = (t % 6) / 6
  const trackY = H * 0.8
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.beginPath()
  ctx.roundRect(W * 0.2, trackY, W * 0.6, 8, 4)
  ctx.fill()
  const progGrad = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0)
  progGrad.addColorStop(0, accent)
  progGrad.addColorStop(1, '#00d4ff')
  ctx.fillStyle = progGrad
  ctx.beginPath()
  ctx.roundRect(W * 0.2, trackY, W * 0.6 * progress, 8, 4)
  ctx.fill()

  ctx.fillStyle = 'rgba(180, 190, 220, 0.6)'
  ctx.font = '600 30px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText(opts.duration, W / 2, trackY + 64)

  // footer
  ctx.fillStyle = 'rgba(140, 155, 195, 0.45)'
  ctx.font = '500 26px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText('transmitted through ecosphere', W / 2, H - 140)

  // signature glitch: rare single-frame horizontal tear
  if (Math.floor(t * 10) % 47 === 0) {
    const y = (H * 0.3 + (t * 137) % (H * 0.4)) | 0
    const slice = ctx.getImageData(0, y, W, 14)
    ctx.putImageData(slice, 18, y)
  }
}

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx || typeof ctx.roundRect !== 'function') return null
  return { canvas, ctx }
}

/** Render a static 9:16 story card PNG. Resolves null if rendering fails. */
export async function renderStoryImage(opts: StoryExportOptions): Promise<Blob | null> {
  const made = makeCanvas()
  if (!made) return null
  drawFrame(made.ctx, opts, buildBars(opts.waveformSeed ?? 42), 1.2)
  return new Promise((resolve) => made.canvas.toBlob((b) => resolve(b), 'image/png'))
}

/**
 * Render a short animated 9:16 clip (WebM) with a moving waveform.
 * Resolves null when canvas capture/MediaRecorder is unsupported —
 * callers should fall back to renderStoryImage.
 */
export function renderStoryVideo(opts: StoryExportOptions, durationMs = 8000): Promise<Blob | null> {
  return new Promise((resolve) => {
    const made = makeCanvas()
    const canCapture = made && typeof made.canvas.captureStream === 'function' && typeof MediaRecorder !== 'undefined'
    if (!made || !canCapture) {
      resolve(null)
      return
    }

    let mimeType = ''
    for (const candidate of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
      if (MediaRecorder.isTypeSupported?.(candidate)) {
        mimeType = candidate
        break
      }
    }
    if (!mimeType) {
      resolve(null)
      return
    }

    void (async () => {
    try {
      const bars = buildBars(opts.waveformSeed ?? 42)
      const stream = made.canvas.captureStream(30)

      // clips carry sound: the signal's voice (or real recording) + soft tape hiss
      let actx: AudioContext | null = null
      try {
        actx = new AudioContext()
        const dest = actx.createMediaStreamDestination()
        const voiceBlob = opts.audioBlob ?? await renderSampleAudio('voice', opts.waveformSeed ?? 42, durationMs)
        if (voiceBlob) {
          const buf = await actx.decodeAudioData(await voiceBlob.arrayBuffer())
          const src = actx.createBufferSource()
          src.buffer = buf
          const g = actx.createGain()
          g.gain.value = 0.9
          src.connect(g)
          g.connect(dest)
          src.start()
        }
        const hissBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate)
        const hd = hissBuf.getChannelData(0)
        for (let i = 0; i < hd.length; i++) hd[i] = (Math.random() * 2 - 1) * 0.018
        const hiss = actx.createBufferSource()
        hiss.buffer = hissBuf
        hiss.loop = true
        hiss.connect(dest)
        hiss.start()
        const track = dest.stream.getAudioTracks()[0]
        if (track) stream.addTrack(track)
      } catch { /* silent clip fallback */ }

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onerror = () => resolve(null)
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop())
        void actx?.close().catch(() => { /* closed */ })
        resolve(chunks.length ? new Blob(chunks, { type: mimeType }) : null)
      }

      const start = performance.now()
      let raf = 0
      const tick = (now: number) => {
        const elapsed = now - start
        drawFrame(made.ctx, opts, bars, elapsed / 1000)
        if (elapsed >= durationMs) {
          cancelAnimationFrame(raf)
          recorder.stop()
          return
        }
        raf = requestAnimationFrame(tick)
      }

      recorder.start(250)
      raf = requestAnimationFrame(tick)
    } catch {
      resolve(null)
    }
    })()
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function exportFilename(handle: string, kind: 'image' | 'video') {
  const safe = handle.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 30)
  return `ecosphere-${safe}-${Date.now()}.${kind === 'video' ? 'webm' : 'png'}`
}
