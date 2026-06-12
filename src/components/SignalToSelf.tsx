import { useEffect, useMemo, useState } from 'react'
import AudioRecorder from './AudioRecorder'
import AudioPlayer from './AudioPlayer'
import { listLocalRecordings, deleteLocalRecording } from '../lib/localAudioStore'
import './SignalToSelf.css'

// Signal to Self: a private audio journal. Entries are never public
// (uploads default private; blobs live in IndexedDB). The passcode is a
// soft lock against shoulder-surfing, not encryption — stated in the UI.

const PASSCODE_KEY = 'ecosphere:selfPasscode'
const ENTRIES_KEY = 'ecosphere:selfEntries'

type SelfEntry = { id: string; createdAt: number; durationMs: number }

function softHash(code: string): string {
  let h = 99
  for (let i = 0; i < code.length; i += 1) h = (h * 31 + code.charCodeAt(i)) & 0xffffffff
  return String(h)
}

function readEntries(): SelfEntry[] {
  try { return JSON.parse(window.localStorage.getItem(ENTRIES_KEY) ?? '[]') } catch { return [] }
}

function writeEntries(entries: SelfEntry[]) {
  try { window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries.slice(0, 100))) } catch { /* session only */ }
}

export default function SignalToSelf({ accent = '#66ccff' }: { accent?: string }) {
  const storedHash = useMemo(() => { try { return window.localStorage.getItem(PASSCODE_KEY) } catch { return null } }, [])
  const [unlocked, setUnlocked] = useState(() => storedHash == null)
  const [hasPasscode, setHasPasscode] = useState(() => storedHash != null)
  const [codeDraft, setCodeDraft] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [entries, setEntries] = useState<SelfEntry[]>(() => readEntries())
  const [blobs, setBlobs] = useState<Record<string, Blob>>({})
  const [recorderOpen, setRecorderOpen] = useState(false)

  useEffect(() => {
    if (!unlocked || entries.length === 0) return
    void listLocalRecordings().then(rows => setBlobs(Object.fromEntries(rows.map(r => [r.id, r.blob]))))
  }, [unlocked, entries.length])

  const tryUnlock = () => {
    try {
      if (softHash(codeDraft) === window.localStorage.getItem(PASSCODE_KEY)) {
        setUnlocked(true)
        setNote(null)
      } else {
        setNote('not the code. try again')
      }
    } catch { setUnlocked(true) }
    setCodeDraft('')
  }

  const setPasscode = () => {
    if (!/^\d{4}$/.test(codeDraft)) { setNote('four digits'); return }
    try { window.localStorage.setItem(PASSCODE_KEY, softHash(codeDraft)) } catch { /* session only */ }
    setHasPasscode(true)
    setNote('locked from now on · only you carry the code')
    setCodeDraft('')
  }

  const deleteEntry = (id: string) => {
    setEntries(prev => { const next = prev.filter(e => e.id !== id); writeEntries(next); return next })
    void deleteLocalRecording(id)
  }

  if (!unlocked) {
    return (
      <section className="self-signal glass" aria-label="Signal to self">
        <div className="self-head">
          <span className="self-kicker">SIGNAL TO SELF</span>
          <span className="self-lock" aria-hidden="true">🔒</span>
        </div>
        <p className="self-note-line">a private audio journal. enter your code.</p>
        <div className="self-code-row">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={codeDraft}
            placeholder="····"
            onChange={e => setCodeDraft(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && tryUnlock()}
          />
          <button type="button" onClick={tryUnlock}>unlock</button>
        </div>
        {note && <p className="self-warn" role="status">{note}</p>}
      </section>
    )
  }

  return (
    <section className="self-signal glass" aria-label="Signal to self" style={{ '--self-accent': accent } as React.CSSProperties}>
      <div className="self-head">
        <span className="self-kicker">SIGNAL TO SELF</span>
        <button type="button" className="self-toggle" onClick={() => setRecorderOpen(o => !o)}>
          {recorderOpen ? 'not tonight' : '● record for yourself'}
        </button>
      </div>
      <p className="self-note-line">never public. never shared. a message to whoever you are later.</p>

      {recorderOpen && (
        <AudioRecorder
          kind="capsule"
          context="signal to self"
          prompt="say it to yourself. nobody else gets this frequency."
          onComplete={({ durationMs, uploadId }) => {
            setEntries(prev => { const next = [{ id: uploadId, createdAt: Date.now(), durationMs }, ...prev]; writeEntries(next); return next })
            setRecorderOpen(false)
          }}
        />
      )}

      {entries.length > 0 && (
        <div className="self-entries">
          {entries.map(entry => (
            <div key={entry.id} className="self-entry">
              <div className="self-entry-meta">
                <span>{new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                <button type="button" title="delete entry" aria-label="delete entry" onClick={() => deleteEntry(entry.id)}>✕</button>
              </div>
              {blobs[entry.id]
                ? <AudioPlayer src={blobs[entry.id]} seed={entry.createdAt % 9973} durationSeconds={entry.durationMs / 1000} accent={accent} />
                : <p className="self-warn">this entry lives on the device that recorded it.</p>}
            </div>
          ))}
        </div>
      )}

      {!hasPasscode && (
        <div className="self-code-row self-code-row--setup">
          <span>optional: lock this section with a 4-digit code</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={codeDraft}
            placeholder="····"
            onChange={e => setCodeDraft(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && setPasscode()}
          />
          <button type="button" onClick={setPasscode}>set code</button>
        </div>
      )}
      {note && <p className="self-warn" role="status">{note}</p>}
    </section>
  )
}
