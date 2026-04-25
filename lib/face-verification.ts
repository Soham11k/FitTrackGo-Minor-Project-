"use client"

/**
 * One account, one face: verify the person in frame is the enrolled user.
 * Uses pose face landmarks (indices 0–10: nose, eyes, ears, mouth).
 * CK-style filter: require face region clearly visible before counting reps.
 *
 * **Storage:** Embeddings are stored in **browser IndexedDB** per device (not synced via Supabase).
 * Re-enroll on each browser or after clearing site data.
 */

const FACE_DB = "fittrackgo_face"
const FACE_STORE = "face_embedding"
const FACE_LANDMARK_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const VIS_THRESH = 0.32
/** Cosine similarity gate; pose face vectors drift with light/angle. */
const MATCH_THRESHOLD = 0.82
const CK_MIN_VISIBLE = 4

/** Consecutive good frames before saving enrollment (see `pushConsecutiveEnrollmentFrame`). */
export const FACE_ENROLL_STABLE_FRAMES = 5

const MATCH_SMOOTH_WINDOW = 5
const MATCH_SMOOTH_MIN = 3

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

/** Element-wise mean of N face signatures (same length). */
export function averageFaceSignatures(signatures: number[][]): number[] | null {
  if (!signatures.length) return null
  const len = signatures[0].length
  if (len === 0 || signatures.some((s) => s.length !== len)) return null
  const out = new Array<number>(len).fill(0)
  for (const s of signatures) {
    for (let i = 0; i < len; i++) out[i] += s[i]!
  }
  const n = signatures.length
  for (let i = 0; i < len; i++) out[i]! /= n
  return out
}

/**
 * Reduces one-frame face flicker: after the window is full, "match" is true if at least
 * MATCH_SMOOTH_MIN of the last MATCH_SMOOTH_WINDOW instant matches were true.
 */
export function createFaceMatchSmoother() {
  const buf: boolean[] = []
  return (landmarks: LandmarkPoint[], storedSignature: number[] | null): boolean => {
    if (!storedSignature?.length) return true
    const instant = faceMatches(landmarks, storedSignature)
    buf.push(instant)
    if (buf.length > MATCH_SMOOTH_WINDOW) buf.shift()
    if (buf.length < MATCH_SMOOTH_WINDOW) return instant
    return buf.filter(Boolean).length >= MATCH_SMOOTH_MIN
  }
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

/** Persists the face signature in IndexedDB for this origin only. @returns false if DB unavailable. */
export async function saveFaceEnrollment(userId: string, signature: number[]): Promise<boolean> {
  const db = await dbPromise
  if (!db) return false
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FACE_STORE, "readwrite")
      tx.objectStore(FACE_STORE).put({ userId, signature, updatedAt: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return true
  } catch {
    return false
  }
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
