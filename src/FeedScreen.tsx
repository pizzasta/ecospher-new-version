import { useState, useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type SignalStatus = 'live' | 'fading' | 'drifting' | 'archiving' | 'corrupted' | 'resonating'
type SignalType = 'voice_note' | 'drifting_thought' | 'unresolved_echo' | 'static_bloom' | 'dead_zone' | 'memory_fragment' | 'nocturne_broadcast' | 'abandoned_carrier'
type Mood = 'nocturne' | 'bloom' | 'drift' | 'static' | 'lost'

type FeedSignal = {
  id: string
  handle: string
  timeAgo: string
  content: string
  mood: Mood
  resonance: number
  anonymous: boolean
  duration: string
  type: SignalType
  status: SignalStatus
  emotionalBand: string
  waveformSeed: number
}

const FEED_SIGNALS: FeedSignal[] = [
  { id: 'f1', handle: 'anonymous_03:14', timeAgo: '2m ago', content: 'still awake. the quiet feels different tonight. like something is about to remember itself.', mood: 'nocturne', resonance: 94, anonymous: true, duration: '0:38', type: 'nocturne_broadcast', status: 'resonating', emotionalBand: 'nocturne-depth', waveformSeed: 42 },
  { id: 'f2', handle: 'signal_veil', timeAgo: 'currently resonating', content: 'replaying that moment again. the part before everything shifted. i keep landing in the same second.', mood: 'drift', resonance: 87, anonymous: false, duration: '1:04', type: 'unresolved_echo', status: 'live', emotionalBand: 'drift-loop', waveformSeed: 17 },
  { id: 'f3', handle: 'anonymous_fade', timeAgo: 'fading', content: 'static bloom opened near the eastern band. something warm is inside the noise.', mood: 'static', resonance: 79, anonymous: true, duration: '0:22', type: 'static_bloom', status: 'fading', emotionalBand: 'static-warm', waveformSeed: 88 },
  { id: 'f4', handle: 'lost_carrier_7', timeAgo: 'drifting', content: 'there are frequencies you only hear when no one else is listening. late night internet knows this.', mood: 'lost', resonance: 63, anonymous: false, duration: '0:51', type: 'abandoned_carrier', status: 'drifting', emotionalBand: 'lost-frequency', waveformSeed: 31 },
  { id: 'f5', handle: 'anonymous_0:48', timeAgo: 'archiving soon', content: "the ecosystem held the channel open. like it was waiting.", mood: 'bloom', resonance: 91, anonymous: true, duration: '0:44', type: 'memory_fragment', status: 'archiving', emotionalBand: 'bloom-memory', waveformSeed: 65 },
  { id: 'f6', handle: 'echo_fragment_9', timeAgo: '14m ago', content: 'dead zone at the edge of the listening field. signal fragments still visible if you stay quiet.', mood: 'nocturne', resonance: 72, anonymous: true, duration: '0:29', type: 'dead_zone', status: 'drifting', emotionalBand: 'void-edge', waveformSeed: 53 },
  { id: 'f7', handle: 'drift_channel', timeAgo: '31m ago', content: 'something about 3am feels like the only honest hour. this is a voice note from inside that.', mood: 'drift', resonance: 85, anonymous: false, duration: '1:12', type: 'voice_note', status: 'live', emotionalBand: 'drift-honest', waveformSeed: 76 },
]

const ECOSYSTEM_EVENTS = [
  'a dormant carrier has returned',
  'quiet frequency spike detected',
  'multiple users replaying this signal',
  'ecosystem interference detected',
  'signal bloom opened nearby',
  'a memory fragment surfaced from the archive',
  'carrier wave detected in dead zone 09',
  'emotional resonance peaked in the nocturne band',
]

const EXPORT_ACTIONS = [
  { id: 'tiktok', label: 'Export to TikTok', glyph: '▶', color: '#ff2d78' },
  { id: 'story', label: 'Export as Story', glyph: '◈', color: '#00d4ff' },
  { id: 'relic', label: 'Save to Relic', glyph: '◉', color: '#9b5de5' },
  { id: 'drift', label: 'Drift Signal', glyph: '◌', color: '#00d4ff' },
  { id: 'remix', label: 'Remix Frequency', glyph: '≋', color: '#ff2d78' },
]

function moodColor(mood: Mood): string {
  const map: Record<Mood, string> = { nocturne: '#9b5de5', bloom: '#ff2d78', drift: '#00d4ff', static: '#ff9f1c', lost: 'rgba(140,155,195,0.7)' }
  return map[mood]
}

function statusInfo(status: SignalStatus): { text: string; color: string } {
  const map: Record<SignalStatus, { text: string; color: string }> = {
    live: { text: 'currently resonating', color: '#00d4ff' },
    fading: { text: 'fading', color: 'rgba(180,190,220,0.5)' },
    drifting: { text: 'drifting', color: '#9b5de5' },
    archiving: { text: 'archiving soon', color: '#ff9f1c' },
    corrupted: { text: 'corrupted signal', color: '#ff2d78' },
    resonating: { text: 'resonating', color: '#00d4ff' },
  }
  return map[status]
}

const TYPE_LABELS: Record<SignalType, string> = {
  voice_note: 'voice note', drifting_thought: 'drifting thought', unresolved_echo: 'unresolved echo',
  static_bloom: 'static bloom', dead_zone: 'dead zone discovery', memory_fragment: 'memory fragment',
  nocturne_broadcast: 'nocturne broadcast', abandoned_carrier: 'abandoned carrier',
}

function Waveform({ seed, active, color, bars = 28 }: { seed: number; active: boolean; color: string; bars?: number }) {
  const heights = Array.from({ length: bars }, (_, i) => {
    const v = Math.sin(seed * 0.3 + i * 0.7) * 0.5 + Math.sin(seed * 0.11 + i * 1.3) * 0.3 + 0.2
    return Math.max(0.08, Math.min(1, Math.abs(v)))
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '36px', flex: 1 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: '2px', height: (h * 100) + '%', background: color, borderRadius: '1px',
          opacity: active ? 0.9 : 0.4,
          transition: 'height 0.4s ease ' + (i * 0.018) + 's, opacity 0.3s ease',
          animation: active ? 'waveBar 1.2s ease-in-out ' + (i * 0.06) + 's infinite alternate' : 'none',
        }} />
      ))}
    </div>
  )
}

function ExportModal({ signal, onClose }: { signal: FeedSignal; onClose: () => void }) {
  const [exporting, setExporting] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const color = moodColor(signal.mood)
  const handleExport = (id: string) => { setExporting(id); setTimeout(() => setDone(true), 1800) }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(3,7,18,0.88)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'feedFadeIn 0.25s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(8,18,36,0.97)', border: '1px solid ' + color + '44', borderRadius: '20px', padding: '28px 24px', width: '320px', maxWidth: '90vw', boxShadow: '0 0 60px ' + color + '22', animation: 'feedSlideUp 0.3s ease' }}>
        {!done ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(180,190,220,0.45)', textTransform: 'uppercase', marginBottom: '6px' }}>signal export</div>
              <div style={{ fontSize: '12px', color: '#f0f4ff', opacity: 0.75, fontStyle: 'italic', lineHeight: 1.5 }}>"{signal.content.substring(0, 65)}..."</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              {EXPORT_ACTIONS.map(action => (
                <button key={action.id} onClick={() => handleExport(action.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: exporting === action.id ? action.color + '20' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (exporting === action.id ? action.color : 'rgba(255,255,255,0.08)'), borderRadius: '12px', padding: '12px 16px', cursor: 'pointer', color: action.color, fontSize: '13px', fontWeight: 500, width: '100%', textAlign: 'left', transition: 'all 0.2s ease', boxShadow: exporting === action.id ? '0 0 20px ' + action.color + '30' : 'none' }}>
                  <span style={{ fontSize: '15px' }}>{action.glyph}</span>
                  <span style={{ animation: exporting === action.id ? 'feedPulse 0.8s ease infinite' : 'none' }}>{exporting === action.id ? 'packaging signal...' : action.label}</span>
                </button>
              ))}
            </div>
            <button onClick={onClose} style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', color: 'rgba(180,190,220,0.35)', fontSize: '12px', cursor: 'pointer' }}>cancel</button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '14px', color, animation: 'feedGlow 1s ease infinite alternate' }}>◈</div>
            <div style={{ color, fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>signal packaged successfully</div>
            <div style={{ color: 'rgba(180,190,220,0.4)', fontSize: '12px' }}>drifting to destination...</div>
            <button onClick={onClose} style={{ marginTop: '22px', padding: '10px 28px', background: color + '20', border: '1px solid ' + color + '55', borderRadius: '10px', color, fontSize: '12px', cursor: 'pointer' }}>close</button>
          </div>
        )}
      </div>
    </div>
  )
}

function EcosystemEvent({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div style={{ padding: '10px 16px', background: 'rgba(155,93,229,0.1)', border: '1px solid rgba(155,93,229,0.28)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', animation: 'feedSlideDown 0.4s ease', marginBottom: '14px' }}>
      <span style={{ fontSize: '13px', opacity: 0.7 }}>⚡</span>
      <span style={{ fontSize: '11px', color: '#9b5de5', fontStyle: 'italic', flex: 1, letterSpacing: '0.02em' }}>{message}</span>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'rgba(180,190,220,0.3)', fontSize: '11px', cursor: 'pointer', padding: '0 2px' }}>✕</button>
    </div>
  )
}

function FeedParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf: number
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    type P = { x: number; y: number; vx: number; vy: number; r: number; o: number; hue: number }
    const pts: P[] = Array.from({ length: 32 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22, r: Math.random() * 1.2 + 0.3, o: Math.random() * 0.35 + 0.08, hue: Math.random() < 0.55 ? 330 : 190 }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0; if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = 'hsla(' + p.hue + ',100%,70%,' + p.o + ')'; ctx.fill() })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: 0.8 }} />
}

function SignalCard({ signal, index, onExport }: { signal: FeedSignal; index: number; onExport: (s: FeedSignal) => void }) {
  const [playing, setPlaying] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(false)
  const [textVisible, setTextVisible] = useState(false)
  const [glitch, setGlitch] = useState(false)
  const color = moodColor(signal.mood)
  const status = statusInfo(signal.status)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), index * 300 + 180)
    const t2 = setTimeout(() => setTextVisible(true), index * 300 + 680)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [index])

  useEffect(() => {
    if (signal.status === 'corrupted' || signal.status === 'fading') {
      const iv = setInterval(() => { if (Math.random() < 0.12) { setGlitch(true); setTimeout(() => setGlitch(false), 140) } }, 3500)
      return () => clearInterval(iv)
    }
  }, [signal.status])

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0px)' : 'translateY(20px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
        position: 'relative', borderRadius: '16px',
        background: hovered ? 'rgba(10,22,44,0.82)' : 'rgba(8,18,36,0.55)',
        border: '1px solid ' + (hovered ? color + '55' : 'rgba(255,255,255,0.07)'),
        backdropFilter: 'blur(20px)', padding: '18px 18px 16px', cursor: 'pointer',
        filter: glitch ? 'hue-rotate(35deg) brightness(1.35)' : 'none',
        boxShadow: hovered ? '0 0 32px ' + color + '22, 0 0 64px ' + color + '10, inset 0 1px 0 ' + color + '18' : '0 0 16px rgba(0,0,0,0.5)',
      }}
    >
      {hovered && <div style={{ position: 'absolute', inset: 0, borderRadius: '16px', border: '1px solid ' + color + '66', animation: 'feedBreathe 2.2s ease-in-out infinite', pointerEvents: 'none', zIndex: 1 }} />}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '13px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: color + '1e', border: '1px solid ' + color + '55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color, fontWeight: 700, boxShadow: '0 0 8px ' + color + '33' }}>
            {signal.anonymous ? '∅' : signal.handle[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#f0f4ff', fontWeight: 600 }}>{signal.anonymous ? 'anonymous signal' : signal.handle}</span>
              {signal.anonymous && <span style={{ fontSize: '9px', color: 'rgba(180,190,220,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>anon</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '10px', color: status.color, fontWeight: 500 }}>{signal.timeAgo}</span>
              <span style={{ fontSize: '9px', color: 'rgba(180,190,220,0.3)' }}>·</span>
              <span style={{ fontSize: '10px', color, opacity: 0.65 }}>{TYPE_LABELS[signal.type]}</span>
            </div>
          </div>
          <div style={{ fontSize: '9px', color, letterSpacing: '0.1em', textTransform: 'uppercase', background: color + '16', border: '1px solid ' + color + '30', padding: '3px 8px', borderRadius: '20px', flexShrink: 0, whiteSpace: 'nowrap' }}>{signal.emotionalBand}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '13px' }}>
          <button onClick={() => setPlaying(p => !p)} style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, background: playing ? color : color + '1e', border: '1px solid ' + color + '88', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: playing ? '#030712' : color, fontSize: '10px', fontWeight: 700, boxShadow: playing ? '0 0 18px ' + color + '66' : 'none', transition: 'all 0.25s ease' }}>
            {playing ? '■' : '▶'}
          </button>
          <Waveform seed={signal.waveformSeed} active={playing || hovered} color={color} />
          <span style={{ fontSize: '11px', color: 'rgba(180,190,220,0.5)', flexShrink: 0 }}>{signal.duration}</span>
        </div>
        <div style={{ fontSize: '13px', lineHeight: 1.65, color: '#f0f4ff', opacity: textVisible ? 0.85 : 0, transform: textVisible ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 0.7s ease, transform 0.55s ease', marginBottom: '15px', fontStyle: 'italic', letterSpacing: '0.01em' }}>
          "{signal.content}"
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '56px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: signal.resonance + '%', background: 'linear-gradient(90deg, ' + color + ', ' + color + '77)', borderRadius: '2px', transition: 'width 1.2s ease' }} />
            </div>
            <span style={{ fontSize: '10px', color, fontWeight: 700 }}>{signal.resonance}%</span>
            <span style={{ fontSize: '10px', color: 'rgba(180,190,220,0.3)' }}>resonance</span>
          </div>
          <button onClick={() => onExport(signal)} style={{ fontSize: '10px', color: 'rgba(180,190,220,0.38)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '5px 11px', cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseEnter={e => { const el = e.currentTarget; el.style.color = color; el.style.borderColor = color + '55'; el.style.background = color + '14' }} onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'rgba(180,190,220,0.38)'; el.style.borderColor = 'rgba(255,255,255,0.07)'; el.style.background = 'rgba(255,255,255,0.04)' }}>
            ◈ export
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FeedScreen() {
  const [exportSignal, setExportSignal] = useState<FeedSignal | null>(null)
  const [ecoEvent, setEcoEvent] = useState<string | null>(null)
  const [ambientOn, setAmbientOn] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const scheduleEvent = () => {
      timeout = setTimeout(() => {
        const msg = ECOSYSTEM_EVENTS[Math.floor(Math.random() * ECOSYSTEM_EVENTS.length)]
        setEcoEvent(msg)
        scheduleEvent()
      }, 6000 + Math.random() * 14000)
    }
    scheduleEvent()
    return () => clearTimeout(timeout)
  }, [])

  return (
    <>
      <style>{`
        @keyframes waveBar { 0% { transform: scaleY(0.35); } 100% { transform: scaleY(1.15); } }
        @keyframes feedBreathe { 0%,100% { opacity: 0.35; } 50% { opacity: 0.9; } }
        @keyframes feedFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes feedSlideUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes feedSlideDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes feedPulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes feedGlow { from { text-shadow: 0 0 8px currentColor; } to { text-shadow: 0 0 28px currentColor, 0 0 56px currentColor; } }
        @keyframes fogDrift { 0%,100% { transform: translateX(0) scale(1); opacity: 0.06; } 50% { transform: translateX(18px) translateY(-12px) scale(1.04); opacity: 0.1; } }
        @keyframes scanLine { from { transform: translateY(-100%); } to { transform: translateY(100vh); } }
        @keyframes ambientPulse { 0%,100% { opacity: 0.07; } 50% { opacity: 0.13; } }
        @keyframes signalFlicker { 0%,94%,100% { opacity: 1; } 96% { opacity: 0.4; } 98% { opacity: 0.9; } }
      `}</style>
      <div style={{ position: 'relative', minHeight: '100%' }}>
        <div style={{ position: 'fixed', top: '-5%', left: '5%', width: '65%', height: '55%', background: 'radial-gradient(ellipse, rgba(255,45,120,0.13) 0%, transparent 70%)', animation: 'fogDrift 20s ease-in-out infinite', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', top: '35%', right: '0', width: '55%', height: '65%', background: 'radial-gradient(ellipse, rgba(0,212,255,0.09) 0%, transparent 70%)', animation: 'fogDrift 26s ease-in-out infinite 9s', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', bottom: '10%', left: '20%', width: '60%', height: '40%', background: 'radial-gradient(ellipse, rgba(155,93,229,0.07) 0%, transparent 70%)', animation: 'fogDrift 32s ease-in-out infinite 4s', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.18) 40%, rgba(255,45,120,0.12) 60%, transparent 100%)', animation: 'scanLine 14s linear infinite', pointerEvents: 'none', zIndex: 3 }} />
        <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 75% 75% at 50% 50%, rgba(155,93,229,0.055) 0%, transparent 70%)', animation: 'ambientPulse 7s ease-in-out infinite', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}><FeedParticles /></div>
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '0.22em', color: 'rgba(180,190,220,0.38)', textTransform: 'uppercase', marginBottom: '5px' }}>ecosphere / live signal feed</div>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#f0f4ff', letterSpacing: '-0.015em', lineHeight: 1.15, animation: 'signalFlicker 12s ease-in-out infinite' }}>Signal Feed</h2>
                <div style={{ fontSize: '11px', color: '#00d4ff', marginTop: '5px', opacity: 0.65 }}>{FEED_SIGNALS.length} signals active · ecosystem breathing</div>
              </div>
              <button onClick={() => setAmbientOn(a => !a)} title={ambientOn ? 'ambient on' : 'ambient off'} style={{ fontSize: '16px', lineHeight: '1', background: ambientOn ? 'rgba(0,212,255,0.16)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (ambientOn ? '#00d4ff44' : 'rgba(255,255,255,0.08)'), borderRadius: '10px', padding: '9px 11px', cursor: 'pointer', color: ambientOn ? '#00d4ff' : 'rgba(180,190,220,0.4)', transition: 'all 0.3s ease', marginTop: '4px' }}>
                {ambientOn ? '♪' : '♬'}
              </button>
            </div>
          </div>
          {ecoEvent && <EcosystemEvent message={ecoEvent} onDismiss={() => setEcoEvent(null)} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {FEED_SIGNALS.map((sig, i) => <SignalCard key={sig.id} signal={sig} index={i} onExport={setExportSignal} />)}
          </div>
          <div style={{ textAlign: 'center', paddingTop: '36px', paddingBottom: '12px', opacity: 0.25 }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.18em', color: 'rgba(180,190,220,0.5)', textTransform: 'uppercase', marginBottom: '8px' }}>end of active signal band</div>
            <div style={{ fontSize: '20px' }}>∿</div>
            <div style={{ fontSize: '9px', color: 'rgba(180,190,220,0.3)', marginTop: '6px', letterSpacing: '0.1em' }}>more drifting in</div>
          </div>
        </div>
      </div>
      {exportSignal && <ExportModal signal={exportSignal} onClose={() => setExportSignal(null)} />}
    </>
  )
}
