"use client"

/**
 * Fall detection: body horizontal and low in frame (lying down).
 * Excludes plank and pushup where horizontal is normal.
 */

export interface LandmarkPoint {
  x: number
  y: number
  z?: number
  visibility?: number
}

const VIS = 0.4
function get(lm: LandmarkPoint[], i: number) {
  const p = lm[i]
  if (!p || (p.visibility ?? 0) < VIS) return null
  return p
}

/** Torso angle from vertical in degrees. 0 = standing, 90 = horizontal. */
function torsoAngleFromVertical(lm: LandmarkPoint[]): number | null {
  const shoulder = get(lm, 11) && get(lm, 12)
    ? { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2 }
    : null
  const hip = get(lm, 23) && get(lm, 24)
    ? { x: (lm[23].x + lm[24].x) / 2, y: (lm[23].y + lm[24].y) / 2 }
    : null
  if (!shoulder || !hip) return null
  const dx = hip.x - shoulder.x
  const dy = hip.y - shoulder.y
  const len = Math.sqrt(dx * dx + dy * dy) || 0.001
  const angleFromVertical = (Math.acos(Math.max(-1, Math.min(1, dy / len))) * 180) / Math.PI
  return angleFromVertical
}

/** Hip center Y (0 = top, 1 = bottom). High Y = low in frame. */
function hipCenterY(lm: LandmarkPoint[]): number | null {
  const l = get(lm, 23)
  const r = get(lm, 24)
  if (!l || !r) return null
  return (l.y + r.y) / 2
}

// Stricter: only trigger when clearly lying flat and very low (reduces random false positives)
const TORSO_HORIZONTAL_DEG = 68
const HIP_LOW_THRESHOLD = 0.86
const FRAMES_REQUIRED = 12

let fallFrameCount = 0

export type ExerciseId =
  | "squat"
  | "pushup"
  | "plank"
  | "lunge"
  | "deadlift"
  | "rdl"
  | "bicep_curl"
  | "shoulder_press"
  | "jumping_jacks"
  | "high_knees"
  | "crunch"

/** Returns true if a possible fall is detected (body horizontal and low). Disabled for plank/pushup. */
export function detectFall(
  landmarks: LandmarkPoint[],
  exercise: ExerciseId
): boolean {
  if (
    exercise === "plank" ||
    exercise === "pushup" ||
    exercise === "crunch" ||
    exercise === "deadlift" ||
    exercise === "rdl"
  ) {
    fallFrameCount = 0
    return false
  }
  if (!landmarks?.length) {
    fallFrameCount = 0
    return false
  }
  const angle = torsoAngleFromVertical(landmarks)
  const hipY = hipCenterY(landmarks)
  if (angle == null || hipY == null) {
    fallFrameCount = 0
    return false
  }
  const isHorizontal = angle >= TORSO_HORIZONTAL_DEG
  const isLow = hipY >= HIP_LOW_THRESHOLD
  if (isHorizontal && isLow) {
    fallFrameCount += 1
    if (fallFrameCount >= FRAMES_REQUIRED) return true
  } else {
    fallFrameCount = 0
  }
  return false
}

export function resetFallDetection(): void {
  fallFrameCount = 0
}
