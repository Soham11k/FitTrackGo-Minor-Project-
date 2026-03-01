"use client"

/**
 * One account, one face: verify the person in frame is the enrolled user.
 * Uses pose face landmarks (indices 0–10: nose, eyes, ears, mouth).
 * CK-style filter: require face region clearly visible before counting reps.
 */

const FACE_DB = "fittrackgo_face"
const FACE_STORE = "face_embedding"
const FACE_LANDMARK_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const VIS_THRESH = 0.4
const MATCH_THRESHOLD = 0.92
const CK_MIN_VISIBLE = 5

export interface LandmarkPoint {
  x: number
  y: number
  z?: number
  visibility?: number
}

export function buildFaceSignature(landmarks: LandmarkPoint[]): number[] | null {
  if (!landmarks || landmarks.length < 11) return null
  const pts: number[] = []
  let visible = 0
  for (const i of FACE_LANDMARK_INDICES) {
    const p = landmarks[i]
    if (!p) continue
    if ((p.visibility ?? 1) > VIS_THRESH) visible++
    pts.push(p.x, p.y, p.z ?? 0)
  }
  if (visible < 4) return null
  const nx = landmarks[0]?.x ?? 0.5
  const ny = landmarks[0]?.y ?? 0.5
  const nz = landmarks[0]?.z ?? 0
  const scale =
    Math.hypot(
      (landmarks[2]?.x ?? nx) - (landmarks[5]?.x ?? nx),
      (landmarks[2]?.y ?? ny) - (landmarks[5]?.y ?? ny)
    ) || 0.1
  const out: number[] = []
  for (let i = 0; i < pts.length; i += 3) {
    out.push((pts[i] - nx) / scale, (pts[i + 1] - ny) / scale, (pts[i + 2] - nz) / scale)
  }
  return out
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom ? dot / denom : 0
}

export function faceMatches(currentLandmarks: LandmarkPoint[], storedSignature: number[] | null): boolean {
  if (!storedSignature?.length) return true
  const current = buildFaceSignature(currentLandmarks)
  if (!current) return false
  return cosineSimilarity(current, storedSignature) >= MATCH_THRESHOLD
}

/** CK-style filter: face must be clearly visible (enough landmarks) to count rep. */
export function passesCKFaceFilter(landmarks: LandmarkPoint[]): boolean {
  if (!landmarks || landmarks.length < 11) return false
  let visible = 0
  for (const i of FACE_LANDMARK_INDICES) {
    if ((landmarks[i]?.visibility ?? 0) > VIS_THRESH) visible++
  }
  return visible >= CK_MIN_VISIBLE
}

const dbPromise = typeof indexedDB !== "undefined"
  ? new Promise<IDBDatabase | null>((resolve) => {
      const r = indexedDB.open(FACE_DB, 1)
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => resolve(null)
      r.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(FACE_STORE)) {
          db.createObjectStore(FACE_STORE, { keyPath: "userId" })
        }
      }
    })
  : Promise.resolve(null)

export async function saveFaceEnrollment(userId: string, signature: number[]): Promise<void> {
  const db = await dbPromise
  if (!db) return
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FACE_STORE, "readwrite")
    tx.objectStore(FACE_STORE).put({ userId, signature, updatedAt: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getFaceEnrollment(userId: string): Promise<number[] | null> {
  const db = await dbPromise
  if (!db) return null
  return new Promise((resolve) => {
    const tx = db.transaction(FACE_STORE, "readonly")
    const req = tx.objectStore(FACE_STORE).get(userId)
    req.onsuccess = () => resolve(req.result?.signature ?? null)
    req.onerror = () => resolve(null)
  })
}

export async function deleteFaceEnrollment(userId: string): Promise<void> {
  const db = await dbPromise
  if (!db) return
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FACE_STORE, "readwrite")
    const req = tx.objectStore(FACE_STORE).delete(userId)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
