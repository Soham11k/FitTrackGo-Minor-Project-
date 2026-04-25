import {
  buildFaceSignature,
  passesCKFaceFilter,
  averageFaceSignatures,
  FACE_ENROLL_STABLE_FRAMES,
  type LandmarkPoint,
} from "@/lib/face-verification"

export { FACE_ENROLL_STABLE_FRAMES } from "@/lib/face-verification"

/**
 * Accumulate consecutive good face frames; reset on any bad frame.
 * When `buffer.length` reaches `stableRequired`, returns averaged signature and clears buffer.
 */
export function pushConsecutiveEnrollmentFrame(
  buffer: number[][],
  lm: LandmarkPoint[],
  stableRequired: number = FACE_ENROLL_STABLE_FRAMES
): { buffer: number[][]; signature: number[] | null; progress: number } {
  if (!passesCKFaceFilter(lm)) {
    return { buffer: [], signature: null, progress: 0 }
  }
  const sig = buildFaceSignature(lm)
  if (!sig?.length) {
    return { buffer: [], signature: null, progress: 0 }
  }
  const next = [...buffer, sig]
  const progress = next.length
  if (next.length < stableRequired) {
    return { buffer: next, signature: null, progress }
  }
  const avg = averageFaceSignatures(next)
  return { buffer: [], signature: avg, progress: stableRequired }
}

export function getUserMediaErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) {
    const n = String((err as { name?: string }).name)
    if (n === "NotAllowedError" || n === "PermissionDeniedError") {
      return "Camera access was denied. Allow the camera in your browser settings and try again."
    }
    if (n === "NotFoundError" || n === "DevicesNotFoundError") {
      return "No camera found. Connect a camera and try again."
    }
    if (n === "NotReadableError" || n === "TrackStartError") {
      return "Camera is in use or unavailable. Close other apps using the camera."
    }
    if (n === "OverconstrainedError") {
      return "Camera does not support the requested settings. Try another device."
    }
    if (n === "SecurityError") {
      return "Camera blocked (e.g. insecure context). Use HTTPS or localhost."
    }
  }
  return "Camera access is required to capture your face."
}
