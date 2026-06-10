// Local audio persistence via IndexedDB — keeps real recordings (blobs)
// across reloads until the backend takes over. Falls back to no-ops when
// IndexedDB is unavailable so callers never crash.

export type StoredRecording = {
  id: string
  label: string
  durationMs: number
  emotionalTag: string
  createdAt: number
  blob: Blob
}

const DB_NAME = 'ecosphere-audio'
const DB_VERSION = 1
const STORE = 'recordings'

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function saveRecordingLocally(recording: StoredRecording): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(recording)
      tx.oncomplete = () => { db.close(); resolve(true) }
      tx.onerror = () => { db.close(); resolve(false) }
    } catch {
      db.close()
      resolve(false)
    }
  })
}

export async function listLocalRecordings(): Promise<StoredRecording[]> {
  const db = await openDb()
  if (!db) return []
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => {
        db.close()
        const rows = (req.result as StoredRecording[]) ?? []
        rows.sort((a, b) => b.createdAt - a.createdAt)
        resolve(rows)
      }
      req.onerror = () => { db.close(); resolve([]) }
    } catch {
      db.close()
      resolve([])
    }
  })
}

export async function deleteLocalRecording(id: string): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => { db.close(); resolve(true) }
      tx.onerror = () => { db.close(); resolve(false) }
    } catch {
      db.close()
      resolve(false)
    }
  })
}
