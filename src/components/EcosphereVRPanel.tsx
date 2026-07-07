import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    EcosphereVR: { mount: (container: HTMLElement) => void; onClose: () => void }
  }
}

// The VR bundle (~180 kB of css+js) used to ship render-blocking on every
// page load for this one panel. It now loads on demand, the first time the
// panel actually opens, and stays cached for the session after that.
function ensureVrAssets(): Promise<void> {
  if (!document.querySelector('link[data-eco-vr]')) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/ecosphere-vr.css'
    link.dataset.ecoVr = '1'
    document.head.appendChild(link)
  }
  if (window.EcosphereVR) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>('script[data-eco-vr]')
  const script = existing ?? (() => {
    const s = document.createElement('script')
    s.src = '/ecosphere-vr.js'
    s.dataset.ecoVr = '1'
    document.head.appendChild(s)
    return s
  })()
  return new Promise(resolve => {
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => resolve(), { once: true }) // panel degrades to empty, never throws
  })
}

export default function EcosphereVRPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let cancelled = false
    void ensureVrAssets().then(() => {
      if (!cancelled && window.EcosphereVR && el.isConnected) window.EcosphereVR.mount(el)
    })
    return () => {
      cancelled = true
      window.EcosphereVR?.onClose()
    }
  }, [])
  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '500px' }} />
}
