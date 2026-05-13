import type { RunRecord, WorkoutRecord, CoachRecord } from '@/lib/store'

/** Serializable pending writes persisted across refreshes (PR D2). */
export type PendingWrite =
  | { id: string; kind: 'run'; payload: Omit<RunRecord, 'id' | 'completedAt'>; createdAt: number }
  | { id: string; kind: 'workout'; payload: Omit<WorkoutRecord, 'id' | 'completedAt'>; createdAt: number }
  | { id: string; kind: 'coach'; payload: Omit<CoachRecord, 'id' | 'completedAt'>; createdAt: number }

const DB_NAME = 'fittrackgo-offline'
const STORE = 'pending_writes'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('idb open'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

export async function enqueuePendingWrite(item: PendingWrite): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).put(item)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error ?? new Error('idb'))
  })
}

export async function removePendingWrite(id: string): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).delete(id)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error ?? new Error('idb'))
  })
}

export async function listPendingWrites(): Promise<PendingWrite[]> {
  const db = await openDb()
  if (!db) return []
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly')
    const rq = t.objectStore(STORE).getAll()
    rq.onsuccess = () => resolve((rq.result ?? []) as PendingWrite[])
    rq.onerror = () => reject(rq.error ?? new Error('idb read'))
  })
}
