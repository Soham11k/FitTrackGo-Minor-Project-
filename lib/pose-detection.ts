"use client"

import { PoseLandmarker, HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision"
import {
  VIS_REGION_SCAN,
  VIS_INTERPOLATION_TRIGGER,
  VIS_DRAW_JOINT,
  VIS_DRAW_SEGMENT,
  INITIAL_DETECTION_CONFIDENCE,
  TRACKED_DETECTION_CONFIDENCE,
  POSE_PRESENCE_CONFIDENCE,
  TRACKING_CONFIDENCE,
  CONFIDENCE_TIGHTEN_AFTER_FRAMES,
  ONE_EURO_MIN_CUTOFF,
  ONE_EURO_BETA,
  ONE_EURO_D_CUTOFF,
  MIN_COVERAGE_PERCENT,
  MAX_COVERAGE_PERCENT,
  MIN_ACCEPTABLE_FPS,
  FPS_WINDOW_SIZE,
  SIDE_VIEW_SHOULDER_RATIO,
  FRONT_VIEW_SHOULDER_RATIO,
  RECOMMENDED_CAMERA_ANGLE,
} from "./pose-config"
import { withSuppressedMediapipeWasmWarn, ensureMediapipeWarnFilterInstalled } from "./mediapipe-console-noise"

let landmarker: PoseLandmarker | null = null
let handLandmarker: HandLandmarker | null = null
let detectionQuality = 0.5
let consecutiveFailures = 0
let consecutiveSuccesses = 0
let confidenceTightened = false

// ---------------------------------------------------------------------------
// Pose body connections (original 33 landmarks)
// ---------------------------------------------------------------------------

export const BODY_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32],
]

// ---------------------------------------------------------------------------
// Hand connections — 21 MediaPipe hand landmarks per hand
// Thumb: 0→1→2→3→4, Index: 5→6→7→8, Middle: 9→10→11→12,
// Ring: 13→14→15→16, Pinky: 17→18→19→20, Palm: 5-9, 9-13, 13-17, 0-17
// ---------------------------------------------------------------------------

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
]

const HAND_FINGER_TIPS = [4, 8, 12, 16, 20]
const HAND_PALM_BASE = [0, 5, 9, 13, 17]

export const KEY_JOINTS = [
  "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner", "right_eye", "right_eye_outer",
  "left_ear", "right_ear", "mouth_left", "mouth_right", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
  "left_wrist", "right_wrist", "left_pinky", "right_pinky", "left_index", "right_index", "left_thumb", "right_thumb",
  "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle",
  "left_heel", "right_heel", "left_foot_index", "right_foot_index",
]

export interface LandmarkPoint {
  x: number
  y: number
  z?: number
  visibility?: number
}

export interface PoseResult {
  landmarks: LandmarkPoint[]
  worldLandmarks?: LandmarkPoint[]
  leftHandLandmarks?: LandmarkPoint[]
  rightHandLandmarks?: LandmarkPoint[]
}

const BODY_REGIONS = {
  face: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  torso: [11, 12, 23, 24],
  leftArm: [11, 13, 15, 17, 19, 21],
  rightArm: [12, 14, 16, 18, 20, 22],
  leftLeg: [23, 25, 27, 29, 31],
  rightLeg: [24, 26, 28, 30, 32],
} as const

export type BodyRegionId = keyof typeof BODY_REGIONS

export interface BodyScanDetail {
  regions: { [K in BodyRegionId]: boolean }
  visibleCount: number
  coveragePercent: number
  summary: string
}

export function getBodyScanDetail(landmarks: LandmarkPoint[]): BodyScanDetail | null {
  if (!landmarks?.length) return null
  const regions: { [K in BodyRegionId]: boolean } = {
    face: false, torso: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false,
  }
  let visibleCount = 0
  for (let i = 0; i < landmarks.length; i++) {
    if ((landmarks[i]?.visibility ?? 0) > VIS_REGION_SCAN) visibleCount++
  }
  for (const [region, indices] of Object.entries(BODY_REGIONS)) {
    const regionIndices = Array.from(indices)
    const count = regionIndices.filter((i) => (landmarks[i]?.visibility ?? 0) > VIS_REGION_SCAN).length
    regions[region as BodyRegionId] = count >= Math.min(2, regionIndices.length)
  }
  const coveragePercent = Math.round((visibleCount / 33) * 100)
  const names: BodyRegionId[] = ["face", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg"]
  const summary = names.filter((r) => regions[r]).join(", ") || "Partial"
  return { regions, visibleCount, coveragePercent, summary }
}

// ---------------------------------------------------------------------------
// 1-Euro Filter
// ---------------------------------------------------------------------------

interface OneEuroState {
  xHat: number
  dxHat: number
  lastTime: number
  initialized: boolean
}

function oneEuroFilterStep(
  state: OneEuroState, x: number, t: number,
  minCutoff: number, beta: number, dCutoff: number
): number {
  if (!state.initialized) {
    state.xHat = x; state.dxHat = 0; state.lastTime = t; state.initialized = true
    return x
  }
  const dt = Math.max(1 / 120, (t - state.lastTime) / 1000)
  state.lastTime = t
  const alphaD = smoothingAlpha(dt, dCutoff)
  const dx = (x - state.xHat) / dt
  state.dxHat = alphaD * dx + (1 - alphaD) * state.dxHat
  const cutoff = minCutoff + beta * Math.abs(state.dxHat)
  const alphaX = smoothingAlpha(dt, cutoff)
  state.xHat = alphaX * x + (1 - alphaX) * state.xHat
  return state.xHat
}

function smoothingAlpha(dt: number, cutoff: number): number {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}

interface LandmarkFilterState { x: OneEuroState; y: OneEuroState; z: OneEuroState }

let landmarkFilters: LandmarkFilterState[] = []

function resetFilters() { landmarkFilters = [] }

function ensureFilters(count: number) {
  while (landmarkFilters.length < count) {
    landmarkFilters.push({
      x: { xHat: 0, dxHat: 0, lastTime: 0, initialized: false },
      y: { xHat: 0, dxHat: 0, lastTime: 0, initialized: false },
      z: { xHat: 0, dxHat: 0, lastTime: 0, initialized: false },
    })
  }
}

function filterLandmarks(landmarks: LandmarkPoint[], timestamp: number): LandmarkPoint[] {
  ensureFilters(landmarks.length)
  return landmarks.map((p, i) => {
    const f = landmarkFilters[i]
    const vis = p.visibility ?? 0
    if (vis < VIS_INTERPOLATION_TRIGGER) return p
    return {
      x: oneEuroFilterStep(f.x, p.x, timestamp, ONE_EURO_MIN_CUTOFF, ONE_EURO_BETA, ONE_EURO_D_CUTOFF),
      y: oneEuroFilterStep(f.y, p.y, timestamp, ONE_EURO_MIN_CUTOFF, ONE_EURO_BETA, ONE_EURO_D_CUTOFF),
      z: p.z !== undefined
        ? oneEuroFilterStep(f.z, p.z, timestamp, ONE_EURO_MIN_CUTOFF, ONE_EURO_BETA, ONE_EURO_D_CUTOFF)
        : undefined,
      visibility: vis,
    }
  })
}

// ---------------------------------------------------------------------------
// Bone-length constrained interpolation
// ---------------------------------------------------------------------------

let lastGoodWorldLandmarks: LandmarkPoint[] | null = null
let lastGoodBoneLengths: Map<string, number> = new Map()

function boneKey(a: number, b: number): string { return a < b ? `${a}-${b}` : `${b}-${a}` }

function distance3d(a: LandmarkPoint, b: LandmarkPoint): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z ?? 0) - (b.z ?? 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function updateBoneLengths(worldLandmarks: LandmarkPoint[]) {
  for (const [a, b] of BODY_CONNECTIONS) {
    const pa = worldLandmarks[a], pb = worldLandmarks[b]
    if (!pa || !pb) continue
    if ((pa.visibility ?? 0) > 0.5 && (pb.visibility ?? 0) > 0.5) {
      const len = distance3d(pa, pb)
      if (len > 0.001) {
        const key = boneKey(a, b)
        const prev = lastGoodBoneLengths.get(key)
        lastGoodBoneLengths.set(key, prev ? prev * 0.8 + len * 0.2 : len)
      }
    }
  }
  lastGoodWorldLandmarks = worldLandmarks
}

function interpolateLandmarks(lm: LandmarkPoint[], worldLandmarks?: LandmarkPoint[]): LandmarkPoint[] {
  const interpolated = [...lm]
  if (worldLandmarks?.length) updateBoneLengths(worldLandmarks)

  for (let i = 0; i < interpolated.length; i++) {
    const p = interpolated[i]
    if (!p || (p.visibility ?? 0) < VIS_INTERPOLATION_TRIGGER) {
      const connections: number[] = []
      BODY_CONNECTIONS.forEach(([a, b]) => {
        if (a === i && interpolated[b] && (interpolated[b].visibility ?? 0) > 0.5) connections.push(b)
        if (b === i && interpolated[a] && (interpolated[a].visibility ?? 0) > 0.5) connections.push(a)
      })
      if (connections.length > 0) {
        let sumX = 0, sumY = 0, sumZ = 0, totalWeight = 0
        connections.forEach(idx => {
          const neighbor = interpolated[idx]
          if (!neighbor) return
          const key = boneKey(i, idx)
          const expectedLen = lastGoodBoneLengths.get(key)
          if (expectedLen && lastGoodWorldLandmarks?.[i] && lastGoodWorldLandmarks?.[idx]) {
            const prevSelf = lastGoodWorldLandmarks[i]
            const prevNeighbor = lastGoodWorldLandmarks[idx]
            const prevDir = { x: prevSelf.x - prevNeighbor.x, y: prevSelf.y - prevNeighbor.y }
            const prevDist = Math.sqrt(prevDir.x * prevDir.x + prevDir.y * prevDir.y) || 1
            const estScale = estimateWorldToScreenScale(interpolated)
            sumX += (neighbor.x + (prevDir.x / prevDist) * expectedLen * estScale) * 1.5
            sumY += (neighbor.y + (prevDir.y / prevDist) * expectedLen * estScale) * 1.5
            sumZ += (neighbor.z ?? 0) * 1.5
            totalWeight += 1.5
          } else {
            sumX += neighbor.x; sumY += neighbor.y; sumZ += neighbor.z ?? 0; totalWeight += 1
          }
        })
        if (totalWeight > 0) {
          interpolated[i] = { x: sumX / totalWeight, y: sumY / totalWeight, z: sumZ / totalWeight, visibility: 0.35 }
        }
      }
    }
  }
  return interpolated
}

function estimateWorldToScreenScale(lm: LandmarkPoint[]): number {
  const ls = lm[11], rs = lm[12]
  if (!ls || !rs) return 1
  const d = Math.abs(ls.x - rs.x)
  return d > 0.01 ? d / 0.35 : 1
}

// ---------------------------------------------------------------------------
// Camera environment assessment
// ---------------------------------------------------------------------------

export type CameraAngle = "front" | "side" | "unknown"

export interface EnvironmentAssessment {
  fps: number
  fpsLow: boolean
  coveragePercent: number
  tooFar: boolean
  tooClose: boolean
  cameraAngle: CameraAngle
  angleRecommended: boolean
  suggestion: string | null
  quality: number
}

let frameTimestamps: number[] = []

function measureFps(timestamp: number): number {
  frameTimestamps.push(timestamp)
  if (frameTimestamps.length > FPS_WINDOW_SIZE) frameTimestamps.shift()
  if (frameTimestamps.length < 2) return 30
  const elapsed = frameTimestamps[frameTimestamps.length - 1] - frameTimestamps[0]
  return elapsed <= 0 ? 30 : Math.round(((frameTimestamps.length - 1) / elapsed) * 1000)
}

function detectCameraAngle(landmarks: LandmarkPoint[]): CameraAngle {
  const ls = landmarks[11], rs = landmarks[12]
  if (!ls || !rs) return "unknown"
  if ((ls.visibility ?? 0) < 0.4 || (rs.visibility ?? 0) < 0.4) return "unknown"
  const w = Math.abs(ls.x - rs.x)
  if (w < SIDE_VIEW_SHOULDER_RATIO) return "side"
  if (w > FRONT_VIEW_SHOULDER_RATIO) return "front"
  return "unknown"
}

export function assessEnvironment(landmarks: LandmarkPoint[], timestamp: number, exercise?: string): EnvironmentAssessment {
  const fps = measureFps(timestamp)
  const fpsLow = fps < MIN_ACCEPTABLE_FPS
  const scan = getBodyScanDetail(landmarks)
  const coveragePercent = scan?.coveragePercent ?? 0
  const tooFar = coveragePercent < MIN_COVERAGE_PERCENT
  const tooClose = coveragePercent > MAX_COVERAGE_PERCENT
  const cameraAngle = detectCameraAngle(landmarks)
  const recommended = exercise ? RECOMMENDED_CAMERA_ANGLE[exercise] ?? "either" : "either"
  const angleRecommended = recommended === "either" || cameraAngle === "unknown" || cameraAngle === recommended

  let suggestion: string | null = null
  if (fpsLow) suggestion = "Low frame rate detected — try better lighting or close other apps."
  else if (tooFar) suggestion = "Move closer to the camera so your body fills more of the frame."
  else if (tooClose) suggestion = "Step back so your full body (head to feet) is visible."
  else if (!angleRecommended) {
    suggestion = `For best results with this exercise, try a ${recommended === "side" ? "side view" : "front view"}.`
  }

  return { fps, fpsLow, coveragePercent, tooFar, tooClose, cameraAngle, angleRecommended, suggestion, quality: detectionQuality }
}

// ---------------------------------------------------------------------------
// Initialization — Pose + Hand landmarkers
// ---------------------------------------------------------------------------

export async function initPoseDetection(): Promise<boolean> {
  if (landmarker) {
    ensureMediapipeWarnFilterInstalled()
    return true
  }
  const ok = await withSuppressedMediapipeWasmWarn(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
      )

      const heavyPoseUrl =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
      const litePoseUrl =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
      const handModelUrl =
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

      // Pose: prefer lite for frame rate, then heavy if lite fails (GPU→CPU each).
      landmarker = null
      outerPose: for (const modelAssetPath of [litePoseUrl, heavyPoseUrl]) {
        for (const delegate of ["GPU", "CPU"] as const) {
          try {
            landmarker = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath, delegate },
              runningMode: "VIDEO",
              numPoses: 1,
              minPoseDetectionConfidence: INITIAL_DETECTION_CONFIDENCE,
              minPosePresenceConfidence: POSE_PRESENCE_CONFIDENCE,
              minTrackingConfidence: TRACKING_CONFIDENCE,
            })
            if (modelAssetPath !== heavyPoseUrl || delegate !== "GPU") {
              console.warn(
                `Pose landmarker settled on ${modelAssetPath.includes("lite") ? "lite" : "heavy"} + ${delegate}`
              )
            }
            break outerPose
          } catch {
            /* next combo */
          }
        }
      }
      if (!landmarker) throw new Error("PoseLandmarker: exhausted GPU/CPU × heavy/lite")

      // Hands: optional; GPU→CPU fallback
      handLandmarker = null
      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: handModelUrl, delegate },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.4,
            minHandPresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          })
          break
        } catch {
          /* try CPU */
        }
      }
      if (!handLandmarker) {
        console.warn("Hand landmarker init failed on GPU and CPU — finger bones disabled")
      }

      detectionQuality = 0.5
      consecutiveFailures = 0
      consecutiveSuccesses = 0
      confidenceTightened = false
      resetFilters()
      lastGoodWorldLandmarks = null
      lastGoodBoneLengths = new Map()
      frameTimestamps = []
      return true
    } catch (e) {
      console.warn("Pose init failed:", e)
      return false
    }
  })
  if (ok) ensureMediapipeWarnFilterInstalled()
  return ok
}

// ---------------------------------------------------------------------------
// Hand detection helpers
// ---------------------------------------------------------------------------

function detectHands(
  video: HTMLVideoElement,
  timestamp: number,
  poseLandmarks: LandmarkPoint[]
): { left?: LandmarkPoint[]; right?: LandmarkPoint[] } {
  if (!handLandmarker) return {}
  const lWrist = poseLandmarks[15]
  const rWrist = poseLandmarks[16]
  const wristVisible =
    ((lWrist?.visibility ?? 0) > 0.35) || ((rWrist?.visibility ?? 0) > 0.35)
  if (!wristVisible) return {}

  try {
    const result = handLandmarker.detectForVideo(video, timestamp)
    if (!result?.landmarks?.length) return {}

    const hands: { left?: LandmarkPoint[]; right?: LandmarkPoint[] } = {}

    for (let h = 0; h < result.landmarks.length; h++) {
      const handLm = result.landmarks[h].map(
        (p: { x: number; y: number; z?: number }) => ({
          x: p.x, y: p.y, z: p.z, visibility: 1,
        })
      )
      const handWrist = handLm[0]
      if (!handWrist) continue

      // Match to closest pose wrist (camera is mirrored, so pose "left" = screen right)
      const distL = lWrist ? Math.hypot(handWrist.x - lWrist.x, handWrist.y - lWrist.y) : Infinity
      const distR = rWrist ? Math.hypot(handWrist.x - rWrist.x, handWrist.y - rWrist.y) : Infinity

      if (distL < distR && distL < 0.15) {
        if (!hands.left) hands.left = handLm
      } else if (distR < 0.15) {
        if (!hands.right) hands.right = handLm
      }
    }

    return hands
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Main detection loop
// ---------------------------------------------------------------------------

export type DetectPoseOptions = {
  /** Skip optional hand landmarker pass (saves ~30–40% per frame on mid devices). */
  skipHands?: boolean
}

export function detectPose(
  video: HTMLVideoElement,
  timestamp: number,
  options?: DetectPoseOptions,
): PoseResult | null {
  if (!landmarker) return null
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null

  try {
    const result = landmarker.detectForVideo(video, timestamp)
    if (!result?.landmarks?.[0]) {
      consecutiveFailures++
      consecutiveSuccesses = 0
      if (consecutiveFailures > 10) { resetFilters(); lastGoodWorldLandmarks = null }
      detectionQuality = Math.max(0, detectionQuality - 0.05)
      if (confidenceTightened && consecutiveFailures > 8) {
        trySetDetectionConfidence(INITIAL_DETECTION_CONFIDENCE)
        confidenceTightened = false
      }
      return null
    }

    consecutiveFailures = 0
    consecutiveSuccesses++
    detectionQuality = Math.min(1, detectionQuality + 0.02)

    if (!confidenceTightened && consecutiveSuccesses >= CONFIDENCE_TIGHTEN_AFTER_FRAMES) {
      trySetDetectionConfidence(TRACKED_DETECTION_CONFIDENCE)
      confidenceTightened = true
    }

    const rawLm = result.landmarks[0].map((p: { x: number; y: number; z?: number; visibility?: number }) => ({
      x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 0.5,
    }))

    const worldLm = result.worldLandmarks?.[0]?.map((p: { x: number; y: number; z?: number; visibility?: number }) => ({
      x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 0.5,
    }))

    const interpolated = interpolateLandmarks(rawLm, worldLm)
    const filtered = detectionQuality > 0.15 ? filterLandmarks(interpolated, timestamp) : interpolated

    const hands = options?.skipHands ? {} : detectHands(video, timestamp, filtered)

    return {
      landmarks: filtered,
      worldLandmarks: worldLm,
      leftHandLandmarks: hands.left,
      rightHandLandmarks: hands.right,
    }
  } catch (e) {
    console.warn("Pose detection error:", e)
    consecutiveFailures++
    detectionQuality = Math.max(0, detectionQuality - 0.1)
    return null
  }
}

function trySetDetectionConfidence(confidence: number) {
  try { landmarker?.setOptions({ minPoseDetectionConfidence: confidence }) } catch { /* noop */ }
}

export function getDetectionQuality(): number { return detectionQuality }

// ---------------------------------------------------------------------------
// Synthetic anatomical points — computed from the 33 pose landmarks to give
// the skeleton a much more detailed, full-body appearance.
// ---------------------------------------------------------------------------

interface AnatomicalPoints {
  neckBase: LandmarkPoint | null       // between shoulders, shifted up
  sternum: LandmarkPoint | null        // midpoint of shoulders
  midSpine: LandmarkPoint | null       // halfway between sternum and pelvis
  pelvisCenter: LandmarkPoint | null   // midpoint of hips
  leftCollar: LandmarkPoint | null     // between neck and left shoulder
  rightCollar: LandmarkPoint | null    // between neck and right shoulder
  leftUpperArmMid: LandmarkPoint | null
  rightUpperArmMid: LandmarkPoint | null
  leftForearmMid: LandmarkPoint | null
  rightForearmMid: LandmarkPoint | null
  leftThighMid: LandmarkPoint | null
  rightThighMid: LandmarkPoint | null
  leftShinMid: LandmarkPoint | null
  rightShinMid: LandmarkPoint | null
}

function midpoint(a: LandmarkPoint | undefined, b: LandmarkPoint | undefined, t = 0.5, yOffset = 0): LandmarkPoint | null {
  if (!a || !b) return null
  const visA = a.visibility ?? 0, visB = b.visibility ?? 0
  if (visA < VIS_DRAW_SEGMENT && visB < VIS_DRAW_SEGMENT) return null
  return {
    x: a.x * (1 - t) + b.x * t,
    y: a.y * (1 - t) + b.y * t + yOffset,
    z: a.z !== undefined && b.z !== undefined ? a.z * (1 - t) + b.z * t : undefined,
    visibility: Math.min(visA, visB),
  }
}

function computeAnatomicalPoints(lm: LandmarkPoint[]): AnatomicalPoints {
  const sternum = midpoint(lm[11], lm[12])
  const pelvisCenter = midpoint(lm[23], lm[24])
  const shoulderDist = lm[11] && lm[12] ? Math.abs(lm[11].y - lm[12].y) : 0
  const neckYOffset = -(shoulderDist * 0.3 + 0.015)
  const neckBase = midpoint(lm[11], lm[12], 0.5, neckYOffset)

  return {
    neckBase,
    sternum,
    midSpine: sternum && pelvisCenter ? midpoint(sternum, pelvisCenter) : null,
    pelvisCenter,
    leftCollar: neckBase && lm[11] ? midpoint(neckBase, lm[11], 0.5) : null,
    rightCollar: neckBase && lm[12] ? midpoint(neckBase, lm[12], 0.5) : null,
    leftUpperArmMid: midpoint(lm[11], lm[13]),
    rightUpperArmMid: midpoint(lm[12], lm[14]),
    leftForearmMid: midpoint(lm[13], lm[15]),
    rightForearmMid: midpoint(lm[14], lm[16]),
    leftThighMid: midpoint(lm[23], lm[25]),
    rightThighMid: midpoint(lm[24], lm[26]),
    leftShinMid: midpoint(lm[25], lm[27]),
    rightShinMid: midpoint(lm[26], lm[28]),
  }
}

// ---------------------------------------------------------------------------
// Skeleton drawing — full anatomical detail
// ---------------------------------------------------------------------------

export function drawPlaceholderSkeleton(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cx = width / 2, cy = height / 2, u = Math.min(width, height) / 4
  ctx.strokeStyle = "rgba(59, 130, 246, 0.9)"
  ctx.lineWidth = 5
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(cx, cy - u); ctx.lineTo(cx, cy)
  ctx.moveTo(cx, cy); ctx.lineTo(cx - u * 0.8, cy + u)
  ctx.moveTo(cx, cy); ctx.lineTo(cx + u * 0.8, cy + u)
  ctx.moveTo(cx, cy); ctx.lineTo(cx - u * 0.6, cy - u * 0.3)
  ctx.moveTo(cx, cy); ctx.lineTo(cx + u * 0.6, cy - u * 0.3)
  ctx.stroke()
  ctx.fillStyle = "rgba(59, 130, 246, 0.9)"
  ctx.beginPath(); ctx.arc(cx, cy - u, 8, 0, Math.PI * 2); ctx.fill()
  ctx.font = "14px system-ui, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.9)"
  ctx.fillText("Waiting for pose...", cx - 55, cy + u + 24)
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  a: LandmarkPoint | null | undefined,
  b: LandmarkPoint | null | undefined,
  w: number, h: number,
  color: string, lineWidth: number
) {
  if (!a || !b) return
  if ((a.visibility ?? 1) < VIS_DRAW_SEGMENT || (b.visibility ?? 1) < VIS_DRAW_SEGMENT) return
  ctx.beginPath()
  ctx.moveTo(a.x * w, a.y * h)
  ctx.lineTo(b.x * w, b.y * h)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = "round"
  ctx.stroke()
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  p: LandmarkPoint | null | undefined,
  w: number, h: number,
  fill: string, stroke: string,
  radius: number, strokeWidth: number
) {
  if (!p) return
  if ((p.visibility ?? 1) < VIS_DRAW_JOINT) return
  ctx.beginPath()
  ctx.arc(p.x * w, p.y * h, radius, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  if (strokeWidth > 0) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = strokeWidth
    ctx.stroke()
  }
}

function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  handLm: LandmarkPoint[],
  w: number, h: number,
  boneColor: string,
  palmFill: string,
  scale: number
) {
  const boneW = Math.max(2, Math.round(2.5 * scale))
  const jointR = Math.max(2, Math.round(3 * scale))
  const tipR = Math.max(3, Math.round(4 * scale))

  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = handLm[a], pb = handLm[b]
    if (!pa || !pb) continue
    ctx.beginPath()
    ctx.moveTo(pa.x * w, pa.y * h)
    ctx.lineTo(pb.x * w, pb.y * h)
    ctx.strokeStyle = boneColor
    ctx.lineWidth = boneW
    ctx.lineCap = "round"
    ctx.stroke()
  }

  const palmPts = HAND_PALM_BASE.map(i => handLm[i]).filter(Boolean)
  if (palmPts.length >= 4) {
    ctx.beginPath()
    ctx.moveTo(palmPts[0].x * w, palmPts[0].y * h)
    for (let i = 1; i < palmPts.length; i++) {
      ctx.lineTo(palmPts[i].x * w, palmPts[i].y * h)
    }
    ctx.closePath()
    ctx.fillStyle = palmFill
    ctx.fill()
  }

  for (let i = 0; i < handLm.length; i++) {
    const p = handLm[i]
    if (!p) continue
    const isTip = HAND_FINGER_TIPS.includes(i)
    const r = isTip ? tipR : jointR
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2)
    ctx.globalAlpha = isTip ? 1 : 0.78
    ctx.fillStyle = boneColor
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

/** Form score 0–100 → hue 0 (red, wrong) … 120 (green, right) */
interface FormPalette {
  bonePrimary: string
  boneSecondary: string
  boneSubtle: string
  boneFoot: string
  torsoFill: string
  jointFill: string
  jointStroke: string
  synth: string
  headStroke: string
  handPalm: string
}

function formScoreToPalette(score: number): FormPalette {
  const s = Math.max(0, Math.min(100, score))
  const hue = (s / 100) * 120
  const sat = 70 + (s / 100) * 12
  const light = 46 + (1 - s / 100) * 10
  return {
    bonePrimary: `hsla(${hue}, ${sat}%, ${light}%, 0.96)`,
    boneSecondary: `hsla(${hue}, ${sat - 8}%, ${light + 6}%, 0.9)`,
    boneSubtle: `hsla(${hue}, ${sat - 12}%, ${light + 10}%, 0.42)`,
    boneFoot: `hsla(${hue}, ${sat - 4}%, ${light + 4}%, 0.85)`,
    torsoFill: `hsla(${hue}, ${sat}%, 52%, 0.09)`,
    jointFill: `hsla(${hue}, ${Math.min(88, sat + 8)}%, ${light + 12}%, 0.96)`,
    jointStroke: `hsla(${hue}, 88%, ${Math.max(32, light - 18)}%, 1)`,
    synth: `hsla(${hue}, 62%, 54%, 0.52)`,
    headStroke: `hsla(${hue}, ${sat - 6}%, ${light + 10}%, 0.9)`,
    handPalm: `hsla(${hue}, ${sat}%, ${light}%, 0.12)`,
  }
}

/**
 * Draws the full-body skeleton. All bones, hands, face, and joints use one palette:
 * form score drives hue — red (poor) → yellow (mid) → green (good).
 * Pass `formScore` (0–100) for smooth transitions; if omitted, uses `goodForm` as a coarse fallback.
 */
/** Returns true if the segment [a,b] is in the faulty set (order-independent). */
function isFaultySeg(a: number, b: number, pairs?: [number, number][]): boolean {
  if (!pairs?.length) return false
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/** Color used for a segment that will be overdrawn by renderFaults in red. */
const DIMMED_SEG = "rgba(255, 255, 255, 0.08)"

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  width: number,
  height: number,
  goodForm: boolean,
  handLandmarks?: { left?: LandmarkPoint[]; right?: LandmarkPoint[] },
  formScore?: number,
  faultSegmentPairs?: [number, number][]
) {
  if (!landmarks?.length) return
  const scale = Math.min(width / 640, height / 480, 2)
  const lm = landmarks
  const anat = computeAnatomicalPoints(lm)

  const effectiveScore = formScore ?? (goodForm ? 88 : 38)
  const c = formScoreToPalette(effectiveScore)

  /** Wrapper that dims the segment if it belongs to a detected fault. */
  const dl = (
    a: LandmarkPoint | null | undefined,
    b: LandmarkPoint | null | undefined,
    idxA: number, idxB: number,
    color: string, lw: number
  ) => {
    const segColor = isFaultySeg(idxA, idxB, faultSegmentPairs) ? DIMMED_SEG : color
    drawLine(ctx, a, b, width, height, segColor, lw)
  }

  // Line widths
  const wCore = Math.max(6, Math.round(7 * scale))
  const wLimb = Math.max(4, Math.round(5 * scale))
  const wDetail = Math.max(3, Math.round(3.5 * scale))
  const wFine = Math.max(2, Math.round(2.5 * scale))
  const wHair = Math.max(1, Math.round(1.5 * scale))

  // ── LAYER 1: Subtle body fill for torso ──────────────────────────────
  if (anat.sternum && anat.pelvisCenter && lm[11] && lm[12] && lm[23] && lm[24]) {
    ctx.beginPath()
    ctx.moveTo(lm[11].x * width, lm[11].y * height)
    ctx.lineTo(lm[12].x * width, lm[12].y * height)
    ctx.lineTo(lm[24].x * width, lm[24].y * height)
    ctx.lineTo(lm[23].x * width, lm[23].y * height)
    ctx.closePath()
    ctx.fillStyle = c.torsoFill
    ctx.fill()
  }

  // ── LAYER 2: Spine ───────────────────────────────────────────────────
  drawLine(ctx, anat.neckBase, anat.sternum, width, height, c.boneSecondary, wDetail)
  drawLine(ctx, anat.sternum, anat.midSpine, width, height, c.boneSecondary, wDetail)
  drawLine(ctx, anat.midSpine, anat.pelvisCenter, width, height, c.boneSecondary, wDetail)
  drawLine(ctx, lm[0], anat.neckBase, width, height, c.boneSecondary, wDetail)

  // ── LAYER 3: Ribcage cross-bracing ───────────────────────────────────
  // (synthetic midpoint segments — no fault index, use plain drawLine)
  drawLine(ctx, anat.sternum, lm[11], width, height, c.boneSubtle, wHair)
  drawLine(ctx, anat.sternum, lm[12], width, height, c.boneSubtle, wHair)
  drawLine(ctx, anat.midSpine, lm[11], width, height, c.boneSubtle, wHair)
  drawLine(ctx, anat.midSpine, lm[12], width, height, c.boneSubtle, wHair)
  drawLine(ctx, anat.midSpine, lm[23], width, height, c.boneSubtle, wHair)
  drawLine(ctx, anat.midSpine, lm[24], width, height, c.boneSubtle, wHair)
  dl(lm[11], lm[24], 11, 24, c.boneSubtle, wHair)
  dl(lm[12], lm[23], 12, 23, c.boneSubtle, wHair)

  // ── LAYER 4: Collar bones ────────────────────────────────────────────
  dl(lm[7],  lm[11], 7,  11, c.boneSecondary, wHair)
  dl(lm[8],  lm[12], 8,  12, c.boneSecondary, wHair)
  drawLine(ctx, anat.neckBase, lm[11], width, height, c.boneSecondary, wDetail)
  drawLine(ctx, anat.neckBase, lm[12], width, height, c.boneSecondary, wDetail)

  // ── LAYER 5: Torso frame ─────────────────────────────────────────────
  dl(lm[11], lm[12], 11, 12, c.bonePrimary, wCore)
  dl(lm[23], lm[24], 23, 24, c.bonePrimary, wCore)
  dl(lm[11], lm[23], 11, 23, c.bonePrimary, wCore)
  dl(lm[12], lm[24], 12, 24, c.bonePrimary, wCore)

  // ── LAYER 6: Face ────────────────────────────────────────────────────
  const faceConns: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  ]
  for (const [a, b] of faceConns) drawLine(ctx, lm[a], lm[b], width, height, c.boneSecondary, wFine)
  drawLine(ctx, lm[9], lm[7], width, height, c.boneSecondary, wHair)
  drawLine(ctx, lm[10], lm[8], width, height, c.boneSecondary, wHair)
  drawLine(ctx, lm[0], lm[1], width, height, c.boneSecondary, wHair)
  drawLine(ctx, lm[0], lm[4], width, height, c.boneSecondary, wHair)

  // ── LAYER 7: Arms ────────────────────────────────────────────────────
  // Upper arms use synthetic midpoints; fault check on the enclosing named segment pair
  dl(lm[11], anat.leftUpperArmMid,  11, 13, c.bonePrimary, wLimb)
  dl(anat.leftUpperArmMid,  lm[13], 11, 13, c.bonePrimary, wLimb)
  dl(lm[13], anat.leftForearmMid,   13, 15, c.bonePrimary, wLimb)
  dl(anat.leftForearmMid,   lm[15], 13, 15, c.bonePrimary, wLimb)
  dl(lm[15], lm[17], 15, 17, c.bonePrimary, wFine)
  dl(lm[15], lm[19], 15, 19, c.bonePrimary, wFine)
  dl(lm[15], lm[21], 15, 21, c.bonePrimary, wFine)
  dl(lm[17], lm[19], 17, 19, c.bonePrimary, wHair)
  dl(lm[19], lm[21], 19, 21, c.bonePrimary, wHair)

  dl(lm[12], anat.rightUpperArmMid, 12, 14, c.bonePrimary, wLimb)
  dl(anat.rightUpperArmMid, lm[14], 12, 14, c.bonePrimary, wLimb)
  dl(lm[14], anat.rightForearmMid,  14, 16, c.bonePrimary, wLimb)
  dl(anat.rightForearmMid,  lm[16], 14, 16, c.bonePrimary, wLimb)
  dl(lm[16], lm[18], 16, 18, c.bonePrimary, wFine)
  dl(lm[16], lm[20], 16, 20, c.bonePrimary, wFine)
  dl(lm[16], lm[22], 16, 22, c.bonePrimary, wFine)
  dl(lm[18], lm[20], 18, 20, c.bonePrimary, wHair)
  dl(lm[20], lm[22], 20, 22, c.bonePrimary, wHair)

  // ── LAYER 8: Legs ────────────────────────────────────────────────────
  dl(lm[23], anat.leftThighMid,  23, 25, c.bonePrimary, wLimb)
  dl(anat.leftThighMid,  lm[25], 23, 25, c.bonePrimary, wLimb)
  dl(lm[25], anat.leftShinMid,   25, 27, c.bonePrimary, wLimb)
  dl(anat.leftShinMid,   lm[27], 25, 27, c.bonePrimary, wLimb)

  dl(lm[24], anat.rightThighMid, 24, 26, c.bonePrimary, wLimb)
  dl(anat.rightThighMid, lm[26], 24, 26, c.bonePrimary, wLimb)
  dl(lm[26], anat.rightShinMid,  26, 28, c.bonePrimary, wLimb)
  dl(anat.rightShinMid,  lm[28], 26, 28, c.bonePrimary, wLimb)

  // ── LAYER 9: Feet ───────────────────────────────────────────────────
  dl(lm[27], lm[29], 27, 29, c.boneFoot, wDetail)
  dl(lm[27], lm[31], 27, 31, c.boneFoot, wDetail)
  dl(lm[29], lm[31], 29, 31, c.boneFoot, wFine)
  const leftFootArch = midpoint(lm[29], lm[31])
  drawLine(ctx, lm[27], leftFootArch, width, height, c.boneFoot, wHair)

  dl(lm[28], lm[30], 28, 30, c.boneFoot, wDetail)
  dl(lm[28], lm[32], 28, 32, c.boneFoot, wDetail)
  dl(lm[30], lm[32], 30, 32, c.boneFoot, wFine)
  const rightFootArch = midpoint(lm[30], lm[32])
  drawLine(ctx, lm[28], rightFootArch, width, height, c.boneFoot, wHair)

  // ── LAYER 10: Hands ───────────────────────────────────────────────────
  if (handLandmarks?.left?.length) {
    drawHandSkeleton(ctx, handLandmarks.left, width, height, c.bonePrimary, c.handPalm, scale)
  }
  if (handLandmarks?.right?.length) {
    drawHandSkeleton(ctx, handLandmarks.right, width, height, c.bonePrimary, c.handPalm, scale)
  }

  // ── LAYER 11: Joint circles ──────────────────────────────────────────
  const fill = c.jointFill
  const stroke = c.jointStroke

  // Joint size tiers
  const rMajor = Math.max(7, Math.round(9 * scale))   // shoulders, hips, knees
  const rMedium = Math.max(5, Math.round(7 * scale))   // elbows, ankles, wrists
  const rSmall = Math.max(4, Math.round(5 * scale))    // hands, feet extremities
  const rTiny = Math.max(3, Math.round(3.5 * scale))   // face, midpoints
  const majorJoints = new Set([11, 12, 23, 24, 25, 26])
  const mediumJoints = new Set([13, 14, 15, 16, 27, 28])
  const smallJoints = new Set([17, 18, 19, 20, 21, 22, 29, 30, 31, 32])

  for (let i = 0; i < lm.length; i++) {
    const p = lm[i]
    if (!p || (p.visibility ?? 1) < VIS_DRAW_JOINT) continue
    let r = rTiny
    if (majorJoints.has(i)) r = rMajor
    else if (mediumJoints.has(i)) r = rMedium
    else if (smallJoints.has(i)) r = rSmall
    drawDot(ctx, p, width, height, fill, stroke, r, 2.5)
  }

  // Synthetic joint dots (smaller, no outline)
  const synthPoints = [
    anat.neckBase, anat.sternum, anat.midSpine, anat.pelvisCenter,
    anat.leftCollar, anat.rightCollar,
    anat.leftUpperArmMid, anat.rightUpperArmMid,
    anat.leftForearmMid, anat.rightForearmMid,
    anat.leftThighMid, anat.rightThighMid,
    anat.leftShinMid, anat.rightShinMid,
    leftFootArch, rightFootArch,
  ]
  const rSynth = Math.max(2, Math.round(3 * scale))
  for (const sp of synthPoints) {
    drawDot(ctx, sp, width, height, c.synth, "transparent", rSynth, 0)
  }

  const nose = lm[0]
  if (nose && (nose.visibility ?? 0) > VIS_DRAW_JOINT) {
    const headR = Math.max(12, Math.round(18 * scale))
    ctx.beginPath()
    ctx.arc(nose.x * width, nose.y * height - headR * 0.3, headR, 0, Math.PI * 2)
    ctx.strokeStyle = c.headStroke
    ctx.lineWidth = wFine
    ctx.stroke()
  }
}
