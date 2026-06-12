import { LISTEN_ONLY_MESSAGE, canUpload, recordUploadUsage } from '../lib/audioBudget'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { uploadAudio, validateAudioUpload } from '../lib/library'
import type { AudioMessageKind } from '../lib/library'
import { isSupabaseConfigured } from '../lib/supabase-env'
import { saveRecordingLocally } from '../lib/localAudioStore'
import '../components/recording.css'

export type PendingUpload = {
  id: string
  title: string
  kind: AudioMessageKind
  roomId?: string
  durationMs: number
  blob: Blob
  attempts: number
  status: 'queued' | 'uploading' | 'failed' | 'done' | 'local-only'
}

type EnqueueOptions = {
  title: string
  kind: AudioMessageKind
  roomId?: string
  durationMs: number
  blob: Blob
  /** also keep the blob in IndexedDB so nothing is lost if upload fails (default true) */
  persistLocally?: boolean
}

type Toast = { id: number; text: string; tone: 'ok' | 'warn' }

type RecordingSessionApi = {
  /** true while any recorder is capturing — navigation locks on this */
  recordingActive: boolean
  setRecordingActive: (active: boolean) => void
  /** uploads that have not reached the backend yet */
  queue: PendingUpload[]
  enqueueUpload: (options: EnqueueOptions) => string
  retryUpload: (id: string) => void
  dismissUpload: (id: string) => void
  notify: (text: string, tone?: 'ok' | 'warn') => void
}

const RecordingSessionContext = createContext<RecordingSessionApi | null>(null)

const MAX_AUTO_ATTEMPTS = 3

export function RecordingSessionProvider({ children }: { children: ReactNode }) {
  const [recordingActive, setRecordingActive] = useState(false)
  const [queue, setQueue] = useState<PendingUpload[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    const timers = timersRef.current
    return () => { timers.forEach(id => window.clearTimeout(id)) }
  }, [])

  const notify = useCallback((text: string, tone: 'ok' | 'warn' = 'ok') => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev.slice(-2), { id, text, tone }])
    timersRef.current.push(window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3400))
  }, [])

  // upload progress, app-wide: a tiny chip listens for this
  useEffect(() => {
    const pending = queue.filter(q => q.status === 'queued' || q.status === 'uploading').length
    window.dispatchEvent(new CustomEvent('ecosphere:uploads', { detail: { pending } }))
  }, [queue])

  const setStatus = useCallback((id: string, status: PendingUpload['status']) => {
    setQueue(prev => prev.map(item => (item.id === id ? { ...item, status } : item)))
  }, [])

  const attemptUpload = useCallback((item: PendingUpload) => {
    setQueue(prev => prev.map(q => (q.id === item.id ? { ...q, status: 'uploading', attempts: q.attempts + 1 } : q)))
    void uploadAudio(item.blob, {
      title: item.title,
      durationSeconds: Math.round(item.durationMs / 1000),
      kind: item.kind,
      roomId: item.roomId,
    }).then(row => {
      if (row) {
        setStatus(item.id, 'done')
        recordUploadUsage(item.blob.size)
        notify('transmission stored in the ecosphere')
        timersRef.current.push(window.setTimeout(() => {
          setQueue(prev => prev.filter(q => q.id !== item.id))
        }, 1200))
        return
      }
      // failed — auto-retry with backoff until attempts run out, then surface
      setQueue(prev => prev.map(q => {
        if (q.id !== item.id) return q
        if (q.attempts < MAX_AUTO_ATTEMPTS) {
          timersRef.current.push(window.setTimeout(() => {
            setQueue(latest => {
              const fresh = latest.find(l => l.id === item.id)
              if (fresh && fresh.status !== 'done') attemptUpload(fresh)
              return latest
            })
          }, 2000 * q.attempts))
          return { ...q, status: 'queued' }
        }
        return { ...q, status: 'failed' }
      }))
    })
  }, [notify, setStatus])

  // spam-click guard: identical blob enqueued within 4s returns the same id
  const recentEnqueueRef = useRef<{ key: string; id: string; at: number } | null>(null)

  const enqueueUpload = useCallback((options: EnqueueOptions) => {
    const dupKey = `${options.kind}-${options.durationMs}-${options.blob.size}`
    const recent = recentEnqueueRef.current
    if (recent && recent.key === dupKey && Date.now() - recent.at < 4000) {
      return recent.id
    }
    const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    recentEnqueueRef.current = { key: dupKey, id, at: Date.now() }
    const item: PendingUpload = {
      id,
      title: options.title,
      kind: options.kind,
      roomId: options.roomId,
      durationMs: options.durationMs,
      blob: options.blob,
      attempts: 0,
      status: 'queued',
    }

    if (options.persistLocally !== false) {
      void saveRecordingLocally({
        id,
        label: options.title,
        durationMs: options.durationMs,
        emotionalTag: options.kind,
        createdAt: Date.now(),
        blob: options.blob,
      })
    }

    const invalid = validateAudioUpload(options.blob, options.durationMs / 1000)
    if (invalid) {
      notify(`${invalid} — kept on this device only`, 'warn')
      return id
    }

    if (!isSupabaseConfigured) {
      notify('kept on this device — connect a backend to sync')
      return id
    }

    // free-tier budget: when spent, the band goes listen-only (locals still save)
    const budget = canUpload(options.blob.size)
    if (!budget.ok) {
      notify(budget.reason ?? LISTEN_ONLY_MESSAGE, 'warn')
      return id
    }
    if (budget.warning) notify(budget.warning, 'warn')

    setQueue(prev => [...prev, item])
    attemptUpload(item)
    return id
  }, [attemptUpload, notify])

  const retryUpload = useCallback((id: string) => {
    setQueue(prev => {
      const item = prev.find(q => q.id === id)
      if (item) attemptUpload({ ...item, attempts: 0 })
      return prev.map(q => (q.id === id ? { ...q, attempts: 0 } : q))
    })
  }, [attemptUpload])

  const dismissUpload = useCallback((id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id))
  }, [])

  // reconnection: when the connection returns, failed uploads retry themselves
  useEffect(() => {
    const onOnline = () => {
      setQueue(prev => {
        const failed = prev.filter(q => q.status === 'failed')
        if (failed.length > 0) {
          notify(`connection restored — retrying ${failed.length} upload${failed.length === 1 ? '' : 's'}`)
          failed.forEach(item => attemptUpload({ ...item, attempts: 0 }))
          return prev.map(q => (q.status === 'failed' ? { ...q, attempts: 0 } : q))
        }
        return prev
      })
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [attemptUpload, notify])

  const api = useMemo<RecordingSessionApi>(() => ({
    recordingActive,
    setRecordingActive,
    queue,
    enqueueUpload,
    retryUpload,
    dismissUpload,
    notify,
  }), [recordingActive, queue, enqueueUpload, retryUpload, dismissUpload, notify])

  const failed = queue.filter(q => q.status === 'failed')

  return (
    <RecordingSessionContext.Provider value={api}>
      {children}
      <div className="rec-toast-stack" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`rec-toast rec-toast--${toast.tone}`}>{toast.text}</div>
        ))}
        {failed.map(item => (
          <div key={item.id} className="rec-toast rec-toast--warn rec-toast--sticky">
            <span>upload failed · {item.title} (saved locally)</span>
            <button type="button" onClick={() => retryUpload(item.id)}>retry</button>
            <button type="button" onClick={() => dismissUpload(item.id)}>dismiss</button>
          </div>
        ))}
      </div>
    </RecordingSessionContext.Provider>
  )
}

const fallbackApi: RecordingSessionApi = {
  recordingActive: false,
  setRecordingActive: () => {},
  queue: [],
  enqueueUpload: () => '',
  retryUpload: () => {},
  dismissUpload: () => {},
  notify: () => {},
}

export function useRecordingSession(): RecordingSessionApi {
  return useContext(RecordingSessionContext) ?? fallbackApi
}
