/**
 * Pure functions: convert MediaPipe Face Landmarker mesh to a fixed-length,
 * L2-normalized embedding for cosine similarity (no WASM — testable in Vitest).
 */

/** MediaPipe face mesh: nose tip, inter-ocular outer corners (468/478 topology). */
export const FACE_MESH_NOSE_TIP = 4
export const FACE_MESH_LEFT_EYE_OUTER = 33
export const FACE_MESH_RIGHT_EYE_OUTER = 263

/** Subsample every Nth landmark to cap storage size. */
export const FACE_MESH_SUBSAMPLE_STEP = 3

const MIN_POINTS = 200
const MIN_KEY_VISIBILITY = 0.25
const MIN_MEAN_VISIBILITY = 0.15
/** Looser thresholds for one-time enrollment (coach rep gating stays strict). */
const ENROLL_KEY_VISIBILITY = 0.12
const ENROLL_MEAN_VISIBILITY = 0.06

export type MeshPoint = { x: number; y: number; z?: number; visibility?: number }

/**
 * @param visibilityIfMissing — Face Landmarker often omits `visibility` on points; `0` treats
 *   missing as occluded (strict). `1` matches key-point handling and avoids false rejections
 *   when only explicit low scores should fail.
 */
function meshQualityOk(
  landmarks: MeshPoint[],
  keyMin: number,
  meanMin: number,
  visibilityIfMissing: number
): boolean {
  if (!landmarks?.length || landmarks.length < MIN_POINTS) return false
  const n = landmarks[FACE_MESH_NOSE_TIP]
  const l = landmarks[FACE_MESH_LEFT_EYE_OUTER]
  const r = landmarks[FACE_MESH_RIGHT_EYE_OUTER]
  if (!n || !l || !r) return false
  if (
    (n.visibility ?? 1) < keyMin ||
    (l.visibility ?? 1) < keyMin ||
    (r.visibility ?? 1) < keyMin
  ) {
    return false
  }
  let s = 0
  let c = 0
  for (let i = 0; i < landmarks.length; i += FACE_MESH_SUBSAMPLE_STEP) {
    s += landmarks[i]?.visibility ?? visibilityIfMissing
    c++
  }
  return c > 0 && s / c >= meanMin
}

/** Whether the mesh is trustworthy enough to gate reps during a workout. */
export function faceMeshQualityOk(landmarks: MeshPoint[]): boolean {
  return meshQualityOk(landmarks, MIN_KEY_VISIBILITY, MIN_MEAN_VISIBILITY, 0)
}

/** Whether the mesh is good enough to build an enrollment template (webcam-friendly). */
export function faceMeshEnrollmentQualityOk(landmarks: MeshPoint[]): boolean {
  return meshQualityOk(landmarks, ENROLL_KEY_VISIBILITY, ENROLL_MEAN_VISIBILITY, 1)
}

/** When visibility scores are missing or zeroed, still allow enrollment if the mesh looks geometrically valid. */
function faceMeshEnrollmentGeometryOk(landmarks: MeshPoint[]): boolean {
  if (!landmarks?.length || landmarks.length < MIN_POINTS) return false
  const n = landmarks[FACE_MESH_NOSE_TIP]
  const l = landmarks[FACE_MESH_LEFT_EYE_OUTER]
  const r = landmarks[FACE_MESH_RIGHT_EYE_OUTER]
  if (!n || !l || !r) return false
  const scale = Math.hypot(l.x - r.x, l.y - r.y, (l.z ?? 0) - (r.z ?? 0))
  return scale > 0.02 && scale < 0.95
}

function computeMeshSignature(landmarks: MeshPoint[]): number[] | null {
  const nose = landmarks[FACE_MESH_NOSE_TIP]!
  const le = landmarks[FACE_MESH_LEFT_EYE_OUTER]!
  const re = landmarks[FACE_MESH_RIGHT_EYE_OUTER]!
  const scale =
    Math.hypot(le.x - re.x, le.y - re.y, (le.z ?? 0) - (re.z ?? 0)) || 0.08
  const out: number[] = []
  for (let i = 0; i < landmarks.length; i += FACE_MESH_SUBSAMPLE_STEP) {
    const p = landmarks[i]!
    out.push(
      (p.x - nose.x) / scale,
      (p.y - nose.y) / scale,
      ((p.z ?? 0) - (nose.z ?? 0)) / scale
    )
  }
  if (out.length < 24) return null
  let sum = 0
  for (const v of out) sum += v * v
  const norm = Math.sqrt(sum) || 1
  return out.map((v) => v / norm)
}

/**
 * Translate by nose, scale by inter-ocular distance, subsample xyz, L2-normalize.
 */
export function normalizeFaceMeshToSignature(landmarks: MeshPoint[]): number[] | null {
  if (!faceMeshQualityOk(landmarks)) return null
  return computeMeshSignature(landmarks)
}

/** Same geometry as normalizeFaceMeshToSignature but uses enrollment visibility thresholds + geometry fallback. */
export function normalizeFaceMeshToSignatureForEnrollment(landmarks: MeshPoint[]): number[] | null {
  if (!faceMeshEnrollmentQualityOk(landmarks) && !faceMeshEnrollmentGeometryOk(landmarks)) return null
  return computeMeshSignature(landmarks)
}
