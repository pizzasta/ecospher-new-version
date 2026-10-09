import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { webglAvailable } from '../lib/scene3d'
import type { Scene3D } from '../lib/scene3d'
import type { NodeStage } from '../lib/node3dEngine'
import { micErrorReason } from '../lib/audioBudget'
import './Node3D.css'

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/**
 * Your sigil as a 3D object in a 3D scene. The three.js engine is fetched
 * only when this mounts. Without WebGL, `fallback` renders instead.
 * `listen` adds the "let it hear you" toggle: the sigil pulses to your voice's
 * loudness, measured on-device. Nothing is recorded or sent.
 */
export default function Node3D({ sigil, scene, colors, fallback, listen = false, className = '', label }: {
  sigil: string
  scene: Scene3D
  colors: [string, string, string]
  fallback?: ReactNode
  listen?: boolean
  className?: string
  label?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<NodeStage | null>(null)
  const latest = useRef({ sigil, scene, colors })
  latest.current = { sigil, scene, colors }
  const [failed, setFailed] = useState(() => !webglAvailable())
  // bumped when the browser takes the GL context back (phones do this when two
  // are live at once) so the stage is rebuilt instead of freezing or flashing
  const [epoch, setEpoch] = useState(0)
  const [hearing, setHearing] = useState(false)
  const [micNote, setMicNote] = useState<string | null>(null)
  const micRef = useRef<{ stop: () => void } | null>(null)
  // the mic can open before the lazy engine arrives: keep the source and hand it over on load
  const levelRef = useRef<(() => number) | null>(null)

  useEffect(() => {
    if (failed || !canvasRef.current) return
    let cancelled = false
    const canvas = canvasRef.current
    void import('../lib/node3dEngine').then(({ createNodeStage }) => {
      if (cancelled) return
      try {
        stageRef.current = createNodeStage(canvas, { ...latest.current, reducedMotion: prefersReducedMotion() })
        if (levelRef.current) stageRef.current.setLevelSource(levelRef.current)
      } catch { setFailed(true) }
    }).catch(() => { if (!cancelled) setFailed(true) })
    const onLost = (e: Event) => { e.preventDefault() }
    const onRestored = () => setEpoch(n => n + 1)
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      cancelled = true
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      stageRef.current?.dispose()
      stageRef.current = null
    }
  }, [failed, epoch])

  useEffect(() => {
    stageRef.current?.update({ sigil, scene, colors, reducedMotion: prefersReducedMotion() })
  }, [sigil, scene, colors])

  useEffect(() => () => micRef.current?.stop(), [])

  const toggleHearing = async () => {
    if (hearing) {
      micRef.current?.stop(); micRef.current = null
      levelRef.current = null
      stageRef.current?.setLevelSource(null)
      setHearing(false)
      return
    }
    setMicNote(null)
    // made inside the tap, before the await, so iOS Safari doesn't leave it suspended
    let ctx: AudioContext
    try { ctx = new AudioContext(); void ctx.resume().catch(() => { /* resumed below */ }) } catch { setMicNote('this browser can’t listen'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (ctx.state === 'suspended') await ctx.resume().catch(() => { /* stays quiet */ })
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      levelRef.current = () => {
        analyser.getByteTimeDomainData(buf)
        let peak = 0
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
        return Math.min(1, peak / 48)
      }
      stageRef.current?.setLevelSource(levelRef.current)
      micRef.current = {
        stop: () => {
          stream.getTracks().forEach(tr => tr.stop())
          void ctx.close().catch(() => { /* closed */ })
        },
      }
      setHearing(true)
    } catch (err) {
      void ctx.close().catch(() => { /* closed */ })
      const reason = micErrorReason(err)
      setMicNote(reason === 'permission' ? 'mic permission was declined' : 'the mic wouldn’t open')
    }
  }

  if (failed) return <>{fallback ?? null}</>

  return (
    <div className={`node3d ${className}`} role="img" aria-label={label ?? 'your sigil in 3D'}>
      <canvas ref={canvasRef} className="node3d-canvas" />
      {listen && (
        <button type="button" className={`node3d-listen${hearing ? ' on' : ''}`} onClick={() => void toggleHearing()} aria-pressed={hearing}>
          {hearing ? '◉ hearing you · stop' : '◎ let it hear you'}
        </button>
      )}
      {micNote && <span className="node3d-note" role="status">{micNote}</span>}
    </div>
  )
}
