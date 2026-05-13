import type { CoachReplayMeta, LandmarkSnapshot } from "./types"

const DB_NAME = "fittrack_coach_replay_v1"
const DB_VER = 1
const STORE = "clips"

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onerror = () => reject(req.error)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clipId" })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

async function opfsAvailable(): Promise<boolean> {
  try {
    return typeof navigator !== "undefined" && !!navigator.storage?.getDirectory
  } catch {
    return false
  }
}

async function writeBlobToOpfs(filename: string, blob: Blob): Promise<boolean> {
  if (!(await opfsAvailable())) return false
  try {
    const root = await navigator.storage!.getDirectory()
    const fh = await root.getFileHandle(filename, { create: true })
    const w = await fh.createWritable()
    await w.write(blob)
    await w.close()
    return true
  } catch {
    return false
  }
}

async function readBlobFromOpfs(filename: string): Promise<Blob | null> {
  if (!(await opfsAvailable())) return null
  try {
    const root = await navigator.storage!.getDirectory()
    const fh = await root.getFileHandle(filename)
    const file = await fh.getFile()
    return file
  } catch {
    return null
  }
}

export async function saveCoachReplayPackage(opts: {
  clipId: string
  sessionId: string | null
  exerciseId: string
  exerciseLabel: string
  durationMs: number
  blob: Blob
  landmarkFrames: LandmarkSnapshot[]
  repMarkersMs: number[]
}): Promise<void> {
  const opfsFileName = `coach-replay-${opts.clipId}.webm`
  const written = await writeBlobToOpfs(opfsFileName, opts.blob)

  const meta: CoachReplayMeta = {
    clipId: opts.clipId,
    sessionId: opts.sessionId,
    exerciseId: opts.exerciseId,
    exerciseLabel: opts.exerciseLabel,
    durationMs: opts.durationMs,
    createdAt: Date.now(),
    repMarkersMs: opts.repMarkersMs,
    landmarkFrames: opts.landmarkFrames,
    opfsFileName: written ? opfsFileName : "",
  }

  if (!written) {
    // Fallback: store tiny placeholder only — video won't replay without OPFS
    meta.opfsFileName = ""
  }

  const db = await idbOpen()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(meta)
  })
  db.close()
}

export async function linkCoachReplayToSession(clipId: string, sessionId: string): Promise<void> {
  const db = await idbOpen()
  const meta = await new Promise<CoachReplayMeta | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const rq = tx.objectStore(STORE).get(clipId)
    rq.onsuccess = () => resolve(rq.result as CoachReplayMeta | undefined)
    rq.onerror = () => reject(rq.error)
  })
  db.close()
  if (!meta) return
  meta.sessionId = sessionId
  const db2 = await idbOpen()
  await new Promise<void>((resolve, reject) => {
    const tx = db2.transaction(STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put(meta)
  })
  db2.close()
}

export async function getCoachReplayMetaByClipId(clipId: string): Promise<CoachReplayMeta | null> {
  const db = await idbOpen()
  const meta = await new Promise<CoachReplayMeta | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const rq = tx.objectStore(STORE).get(clipId)
    rq.onsuccess = () => resolve(rq.result as CoachReplayMeta | undefined)
    rq.onerror = () => reject(rq.error)
  })
  db.close()
  return meta ?? null
}

export async function getCoachReplayMetaBySessionId(sessionId: string): Promise<CoachReplayMeta | null> {
  const db = await idbOpen()
  const all = await new Promise<CoachReplayMeta[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const rq = tx.objectStore(STORE).getAll()
    rq.onsuccess = () => resolve((rq.result as CoachReplayMeta[]) || [])
    rq.onerror = () => reject(rq.error)
  })
  db.close()
  return all.find((m) => m.sessionId === sessionId) ?? null
}

export async function getCoachReplayVideoBlob(meta: CoachReplayMeta): Promise<Blob | null> {
  if (!meta.opfsFileName) return null
  return readBlobFromOpfs(meta.opfsFileName)
}
