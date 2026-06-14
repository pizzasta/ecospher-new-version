import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    EcosphereVR: { mount: (container: HTMLElement) => void; onClose: () => void }
  }
}

export default function EcosphereVRPanel() {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !window.EcosphereVR) return
    window.EcosphereVR.mount(el)
    return () => { window.EcosphereVR?.onClose() }
  }, [])
  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '500px' }} />
}
