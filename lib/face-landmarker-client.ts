"use client"

/**
 * MediaPipe Face Landmarker for enrollment / verification embeddings.
 * Uses the same WASM CDN pattern as pose-detection.ts.
 */
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from "@mediapipe/tasks-vision"
import {
  normalizeFaceMeshToSignature,
  normalizeFaceMeshToSignatureForEnrollment,
  faceMeshQualityOk,
  type MeshPoint,
} from "@/lib/face-mesh-signature"
import {
  withSuppressedMediapipeWasmWarn,
  ensureMediapipeWarnFilterInstalled,
} from "@/lib/mediapipe-console-noise"

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

let faceLandmarker: FaceLandmarker | null = null

export function isFaceLandmarkerReady(): boolean {
  return faceLandmarker !== null
}

export async function initFaceLandmarker(): Promise<boolean> {
  if (faceLandmarker) {
    ensureMediapipeWarnFilterInstalled()
    return true
  }
  const ok = await withSuppressedMediapipeWasmWarn(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
      const options = (delegate: "GPU" | "CPU") =>
        ({
          baseOptions: {
            modelAssetPath: FACE_MODEL,
            delegate,
          },
          // IMAGE + per-frame detect() avoids VIDEO timestamp / tracking path that can abort WASM on some Chrome/Mac setups.
          runningMode: "IMAGE" as const,
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        }) satisfies Parameters<typeof FaceLandmarker.createFromOptions>[1]

      // CPU first: Face Landmarker + GPU delegate often crashes (WASM/TFLite) on some Mac/Chrome setups.
      try {
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, options("CPU"))
      } catch {
        console.warn("Face Landmarker CPU failed, trying GPU")
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, options("GPU"))
      }
      return true
    } catch (e) {
      console.warn("Face Landmarker init failed:", e)
      faceLandmarker = null
      return false
    }
  })
  if (ok) ensureMediapipeWarnFilterInstalled()
  return ok
}

function asMeshPoints(lm: NormalizedLandmark[]): MeshPoint[] {
  return lm.map((p) => ({
    x: p.x,
    y: p.y,
    z: p.z,
    visibility: p.visibility,
  }))
}

function runFaceDetect(video: HTMLVideoElement, _timestampMs: number) {
  const landmarker = faceLandmarker
  if (!landmarker || video.readyState < 2 || video.videoWidth === 0) return null
  try {
    return landmarker.detect(video)
  } catch (e) {
    console.warn("[FaceLandmarker] detect failed:", e)
    return null
  }
}

/** True if a face mesh is present and passes quality checks (for rep gating). */
export function hasFaceMeshFrame(video: HTMLVideoElement, timestampMs: number): boolean {
  const result = runFaceDetect(video, timestampMs)
  if (!result) return false
  const first = result.faceLandmarks?.[0]
  if (!first?.length) return false
  return faceMeshQualityOk(asMeshPoints(first))
}

/**
 * L2-normalized embedding for storage / cosine match.
 * - `enroll` / `match`: same normalization as stored v2 mesh (webcam-friendly). Use `match` when comparing to enrolled embedding in Coach.
 * `verify`: strict quality (e.g. diagnostics); do not use for v2 cosine vs enrollment template.
 */
export function detectFaceSignature(
  video: HTMLVideoElement,
  timestampMs: number,
  purpose: "verify" | "enroll" | "match" = "verify"
): number[] | null {
  const result = runFaceDetect(video, timestampMs)
  if (!result) return null
  const first = result.faceLandmarks?.[0]
  if (!first?.length) return null
  const pts = asMeshPoints(first)
  return purpose === "enroll" || purpose === "match"
    ? normalizeFaceMeshToSignatureForEnrollment(pts)
    : normalizeFaceMeshToSignature(pts)
}
