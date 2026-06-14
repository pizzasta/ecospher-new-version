import { useEffect, useRef } from 'react'

/**
 * Pointer-driven parallax: tracks the cursor / touch position over an element
 * and exposes it as --px / --py custom properties (-1..1), throttled to one
 * write per frame. CSS layers consume the vars for depth motion. No-ops under
 * prefers-reduced-motion.
 */
export function usePointerParallax<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let nextX = 0
    let nextY = 0

    const apply = () => {
      raf = 0
      el.style.setProperty('--px', nextX.toFixed(3))
      el.style.setProperty('--py', nextY.toFixed(3))
    }

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      nextX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1))
      nextY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1))
      if (!raf) raf = requestAnimationFrame(apply)
    }

    const onLeave = () => {
      nextX = 0
      nextY = 0
      if (!raf) raf = requestAnimationFrame(apply)
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave, { passive: true })
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return ref
}
