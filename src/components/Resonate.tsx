import { useEffect, useRef, useState } from 'react'
import { RESONANCE_SIGILS, topSigils, myResonance, toggleResonance, resonanceScore } from '../lib/resonance'
import { createVoiceRecorder } from '../lib/audioBudget'
import { saveReactionAudio, listReactionAudio } from '../lib/localAudioStore'
import './Resonate.css'

// How you resonate with a note: tap a sigil (quick, expressive) or leave a 5–8s
// voice echo (meaningful, rare). A single impact reading shows relative pull.

export default function Resonate({ noteId, readOnly = false, onResonate }: {
  noteId: string
  readOnly?: boolean
  onResonate?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [mine, setMine] = useState<string | null>(() => myResonance(noteId))
  const [, force] = useState(0)
  const [voices, setVoices] = useState(0)
  const [recording, setRecording] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startRef = useRef(0)
  const timerRef = useRef(0)

  useEffect(() => { void listReactionAudio(`note:${noteId}`).then(r => setVoices(r.length)) }, [noteId])
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); window.clearTimeout(timerRef.current) }, [])

  const tapSigil = (id: string) => {
    const next = toggleResonance(noteId, id)
    setMine(next)
    force(n => n + 1)
    if (next && onResonate) onResonate()
  }

  const stopVoice = () => {
    window.clearTimeout(timerRef.current)
    if (recRef.current && recRef.current.state !== 'inactive') { try { recRef.current.stop() } catch { /* idle */ } }
  }

  const startVoice = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = createVoiceRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        void saveReactionAudio({ id: `vr_${Date.now()}`, target: `note:${noteId}`, durationMs: Math.max(1000, Date.now() - startRef.current), createdAt: Date.now(), anonymous: true, filter: 'none', blob }).then(() => setVoices(v => v + 1))
        streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setRecording(false)
      }
      recRef.current = rec; startRef.current = Date.now(); rec.start(); setRecording(true)
      timerRef.current = window.setTimeout(stopVoice, 8000)
    } catch { /* mic denied — stays sigil-only */ }
  }

  const top = topSigils(noteId)
  const score = resonanceScore(noteId, voices)

  const summary = (
    <div className="resonate-summary-inner">
      {top.length > 0
        ? top.map(t => <span key={t.sigil.id} className="resonate-top" title={t.sigil.label}>{t.sigil.glyph}<i>{t.count}</i></span>)
        : <span className="resonate-top resonate-top--empty">◌ no resonance yet</span>}
      {voices > 0 && <span className="resonate-top resonate-top--voice" title="voice echoes">∿<i>{voices}</i></span>}
      <span className="resonate-impact" title="resonance">≋ {score}</span>
    </div>
  )

  if (readOnly) return <div className="resonate resonate--readonly">{summary}</div>

  return (
    <div className="resonate">
      <button type="button" className="resonate-summary" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="resonate with this note">
        {summary}
        <span className="resonate-chevron" aria-hidden="true">{open ? '▴' : 'resonate ▾'}</span>
      </button>
      {open && (
        <div className="resonate-tray">
          <div className="resonate-sigils" role="group" aria-label="choose a resonance">
            {RESONANCE_SIGILS.map(s => (
              <button key={s.id} type="button" className={`resonate-sigil${mine === s.id ? ' on' : ''}`} title={s.meaning} onClick={() => tapSigil(s.id)}>
                <span aria-hidden="true">{s.glyph}</span>
                <em>{s.label}</em>
              </button>
            ))}
          </div>
          <div className="resonate-voice">
            <button type="button" className={`resonate-voice-btn${recording ? ' rec' : ''}`} onClick={recording ? stopVoice : () => { void startVoice() }}>
              {recording ? '■ stop · max 8s' : '∿ leave a voice echo'}
            </button>
            {voices > 0 && <span className="resonate-voice-count">{voices} voice echo{voices > 1 ? 'es' : ''} on this</span>}
          </div>
        </div>
      )}
    </div>
  )
}
