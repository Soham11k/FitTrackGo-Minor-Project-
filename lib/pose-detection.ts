"use client"

// @ts-expect-error MediaPipe types may be incomplete
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision"

let landmarker: PoseLandmarker | null = null
let detectionQuality = 0.5 // Track detection quality for adaptive thresholds
let consecutiveFailures = 0

// Full body: every segment so every part has "those lines" (torso, arms, legs, hands, feet, face)
export const BODY_CONNECTIONS: [number, number][] = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  // Torso (shoulders, hips, spine)
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left arm
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  // Right arm
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  // Left leg + foot
  [23, 25], [25, 27], [27, 29], [27, 31],
  // Right leg + foot
  [24, 26], [26, 28], [28, 30], [28, 32],
]

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
}

/** Visibility threshold for "region visible" */
const VIS_THRESH = 0.35

/** Body regions with their MediaPipe landmark indices */
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
  /** Which regions have enough visible landmarks */
  regions: { [K in BodyRegionId]: boolean }
  /** Count of visible landmarks (max 33) */
  visibleCount: number
  /** 0–100 rough coverage score */
  coveragePercent: number
  /** Human-readable summary e.g. "Face, torso, arms, legs" */
  summary: string
}

/**
 * Scan the full body: which regions are visible from the 33 landmarks.
 * Use this to show "how much" of the body is being detected.
 */
export function getBodyScanDetail(landmarks: LandmarkPoint[]): BodyScanDetail | null {
  if (!landmarks?.length) return null
  const regions: { [K in BodyRegionId]: boolean } = {
    face: false,
    torso: false,
    leftArm: false,
    rightArm: false,
    leftLeg: false,
    rightLeg: false,
  }
  let visibleCount = 0
  for (let i = 0; i < landmarks.length; i++) {
    const vis = landmarks[i]?.visibility ?? 0
    if (vis > VIS_THRESH) visibleCount++
  }
  for (const [region, indices] of Object.entries(BODY_REGIONS)) {
    const count = (indices as number[]).filter((i) => (landmarks[i]?.visibility ?? 0) > VIS_THRESH).length
    regions[region as BodyRegionId] = count >= Math.min(2, (indices as number[]).length)
  }
  const coveragePercent = Math.round((visibleCount / 33) * 100)
  const names: BodyRegionId[] = ["face", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg"]
  const summary = names.filter((r) => regions[r]).join(", ") || "Partial"
  return { regions, visibleCount, coveragePercent, summary }
}

export async function initPoseDetection(): Promise<boolean> {
  if (landmarker) return true
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
    )
    // Use Heavy model for better accuracy (falls back to Lite if Heavy fails)
    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { 
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task", 
          delegate: "GPU" 
        },
        runningMode: "VIDEO",
        numPoses: 1,
        // Adaptive thresholds: start lenient, tighten if detection is good
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    } catch (heavyError) {
      console.warn("Heavy model failed, using Lite:", heavyError)
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { 
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", 
          delegate: "GPU" 
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
    }
    // Reset tracking state
    detectionQuality = 0.5
    consecutiveFailures = 0
    smoothedPrevious = null
    poseHistory = []
    return true
  } catch (e) {
    console.warn("Pose init failed:", e)
    return false
  }
}

// Strong smoothing for stable rep detection: longer history, lower alpha
let poseHistory: LandmarkPoint[][] = []
let smoothedPrevious: LandmarkPoint[] | null = null
const MAX_HISTORY = 9
const SMOOTHING_ALPHA = 0.55

function smoothLandmarks(current: LandmarkPoint[]): LandmarkPoint[] {
  poseHistory.push(current)
  if (poseHistory.length > MAX_HISTORY) {
    poseHistory.shift()
  }
  
  // Exponential smoothing: blend current with previous smoothed value
  if (!smoothedPrevious) {
    smoothedPrevious = current
    return current
  }
  
  // Weighted average: recent frames matter more
  const smoothed: LandmarkPoint[] = current.map((point, i) => {
    const prev = smoothedPrevious![i]
    if (!prev) return point
    
    const vis = point.visibility ?? 1
    const prevVis = prev.visibility ?? 1
    
    // Adaptive alpha: use more of current frame if visibility is high
    const alpha = SMOOTHING_ALPHA * (0.5 + vis * 0.5)
    
    // Exponential smoothing: new = alpha * current + (1-alpha) * previous
    const smoothedX = alpha * point.x + (1 - alpha) * prev.x
    const smoothedY = alpha * point.y + (1 - alpha) * prev.y
    const smoothedZ = point.z !== undefined && prev.z !== undefined
      ? alpha * point.z + (1 - alpha) * prev.z
      : point.z ?? prev.z
    
    // Weighted visibility: prefer higher visibility
    const smoothedVis = Math.max(vis, prevVis * 0.9)
    
    return {
      x: smoothedX,
      y: smoothedY,
      z: smoothedZ,
      visibility: smoothedVis,
    }
  })
  
  smoothedPrevious = smoothed
  return smoothed
}

// Validate landmark positions (lenient - allow side views, squats, etc.)
function validateLandmarks(lm: LandmarkPoint[]): boolean {
  if (lm.length < 33) return false
  
  const shoulders = [lm[11], lm[12]]
  const hips = [lm[23], lm[24]]
  
  if (!shoulders[0] || !shoulders[1] || !hips[0] || !hips[1]) return false
  
  // Allow tilted shoulders (side view, plank, pushup) - was 0.3, now 0.6
  const shoulderDiff = Math.abs(shoulders[0].y - shoulders[1].y)
  if (shoulderDiff > 0.6) return false
  
  // Hips should be roughly below shoulders (Y increases downward)
  const avgShoulderY = (shoulders[0].y + shoulders[1].y) / 2
  const avgHipY = (hips[0].y + hips[1].y) / 2
  if (avgHipY < avgShoulderY - 0.25) return false // Allow some flexibility for bent poses
  
  return true
}

// Interpolate missing landmarks from neighbors
function interpolateLandmarks(lm: LandmarkPoint[]): LandmarkPoint[] {
  const interpolated = [...lm]
  
  // For each landmark, if visibility is low, try to interpolate from neighbors
  for (let i = 0; i < interpolated.length; i++) {
    const p = interpolated[i]
    if (!p || (p.visibility ?? 0) < 0.3) {
      // Try to interpolate from connected landmarks
      const connections: number[] = []
      
      // Find connections for this landmark
      BODY_CONNECTIONS.forEach(([a, b]) => {
        if (a === i && interpolated[b] && (interpolated[b].visibility ?? 0) > 0.5) {
          connections.push(b)
        }
        if (b === i && interpolated[a] && (interpolated[a].visibility ?? 0) > 0.5) {
          connections.push(a)
        }
      })
      
      if (connections.length > 0) {
        // Average position from connected visible landmarks
        let sumX = 0, sumY = 0, sumZ = 0, count = 0
        connections.forEach(idx => {
          const neighbor = interpolated[idx]
          if (neighbor) {
            sumX += neighbor.x
            sumY += neighbor.y
            sumZ += neighbor.z ?? 0
            count++
          }
        })
        
        if (count > 0) {
          interpolated[i] = {
            x: sumX / count,
            y: sumY / count,
            z: sumZ / count,
            visibility: 0.4, // Lower confidence for interpolated
          }
        }
      }
    }
  }
  
  return interpolated
}

export function detectPose(video: HTMLVideoElement, timestamp: number): PoseResult | null {
  if (!landmarker) return null
  if (video.readyState < 2) return null
  
  // Validate video dimensions
  if (video.videoWidth === 0 || video.videoHeight === 0) return null
  
  try {
    const result = landmarker.detectForVideo(video, timestamp)
    if (!result?.landmarks?.[0]) {
      consecutiveFailures++
      // Clear history if no pose detected for too long
      if (consecutiveFailures > 10) {
        poseHistory = []
        smoothedPrevious = null
      }
      detectionQuality = Math.max(0, detectionQuality - 0.05)
      return null
    }
    
    consecutiveFailures = 0
    
    // Preserve real visibility so rep counting can require enough visible keypoints
    const rawLm = result.landmarks[0].map((p: { x: number; y: number; z?: number; visibility?: number }) => ({
      x: p.x,
      y: p.y,
      z: p.z,
      visibility: p.visibility ?? 0.5,
    }))
    
    // Interpolate missing landmarks
    const interpolated = interpolateLandmarks(rawLm)
    
    // Smooth landmarks
    const smoothed = smoothLandmarks(interpolated)
    
    return { 
      landmarks: smoothed, 
      worldLandmarks: result.worldLandmarks?.[0]?.map((p: { x: number; y: number; z?: number }) => ({ 
        x: p.x, 
        y: p.y, 
        z: p.z 
      })) 
    }
  } catch (e) {
    console.warn("Pose detection error:", e)
    consecutiveFailures++
    detectionQuality = Math.max(0, detectionQuality - 0.1)
    return null
  }
}

// Segment groups for detailed colored skeleton (full body: face, neck, torso, arms, legs, hands, feet)
const TORSO_CONNECTIONS = [[11, 12], [11, 23], [12, 24], [23, 24]]
const NECK_CONNECTIONS = [[0, 11], [0, 12]]  // Nose to shoulders for full neck/head
const LEFT_ARM_CONNECTIONS = [[11, 13], [13, 15], [15, 17], [15, 19], [15, 21]]
const RIGHT_ARM_CONNECTIONS = [[12, 14], [14, 16], [16, 18], [16, 20], [16, 22]]
const LEFT_LEG_CONNECTIONS = [[23, 25], [25, 27], [27, 29], [27, 31]]
const RIGHT_LEG_CONNECTIONS = [[24, 26], [26, 28], [28, 30], [28, 32]]
const FACE_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10]]

const SEGMENT_STYLES: { connections: number[][]; stroke: string }[] = [
  { connections: TORSO_CONNECTIONS, stroke: "rgba(59, 130, 246, 0.95)" },   // blue - torso
  { connections: NECK_CONNECTIONS, stroke: "rgba(192, 132, 252, 0.9)" },   // purple - neck
  { connections: LEFT_ARM_CONNECTIONS, stroke: "rgba(234, 179, 8, 0.95)" },  // yellow - left arm
  { connections: RIGHT_ARM_CONNECTIONS, stroke: "rgba(234, 179, 8, 0.95)" }, // yellow - right arm
  { connections: LEFT_LEG_CONNECTIONS, stroke: "rgba(34, 197, 94, 0.95)" },  // green - left leg
  { connections: RIGHT_LEG_CONNECTIONS, stroke: "rgba(34, 197, 94, 0.95)" }, // green - right leg
  { connections: FACE_CONNECTIONS, stroke: "rgba(192, 132, 252, 0.9)" },    // purple - face
]

function drawSegment(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  width: number,
  height: number,
  conn: [number, number],
  strokeStyle: string,
  lineWidth: number
) {
  const pa = landmarks[conn[0]]
  const pb = landmarks[conn[1]]
  if (!pa || !pb) return
  const va = pa.visibility ?? 1
  const vb = pb.visibility ?? 1
  if (va < 0.2 || vb < 0.2) return
  const x1 = pa.x * width
  const y1 = pa.y * height
  const x2 = pb.x * width
  const y2 = pb.y * height
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.lineCap = "round"
  ctx.stroke()
}

/** Draw a placeholder skeleton when no pose is detected (proves canvas works) */
export function drawPlaceholderSkeleton(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cx = width / 2
  const cy = height / 2
  const u = Math.min(width, height) / 4
  ctx.strokeStyle = "rgba(59, 130, 246, 0.9)"
  ctx.lineWidth = 5
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(cx, cy - u)
  ctx.lineTo(cx, cy)
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx - u * 0.8, cy + u)
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + u * 0.8, cy + u)
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx - u * 0.6, cy - u * 0.3)
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + u * 0.6, cy - u * 0.3)
  ctx.stroke()
  ctx.fillStyle = "rgba(59, 130, 246, 0.9)"
  ctx.beginPath()
  ctx.arc(cx, cy - u, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = "14px system-ui, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.9)"
  ctx.fillText("Waiting for pose...", cx - 55, cy + u + 24)
}

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  width: number,
  height: number,
  goodForm: boolean
) {
  if (!landmarks?.length) return
  const scale = Math.min(width / 640, height / 480, 2)
  const lineW = Math.max(4, Math.round(5 * scale))
  const lineWCore = Math.max(6, Math.round(7 * scale))

  // Draw segments first (thicker, so they're visible)
  SEGMENT_STYLES.forEach(({ connections, stroke }) => {
    connections.forEach((conn) => {
      const isTorso = conn[0] === 11 && conn[1] === 23 || conn[0] === 12 && conn[1] === 24 || conn[0] === 11 && conn[1] === 12 || conn[0] === 23 && conn[1] === 24
      drawSegment(ctx, landmarks, width, height, conn as [number, number], stroke, isTorso ? lineWCore : lineW)
    })
  })

  // Draw keypoints (lower visibility threshold so more show)
  const jointR = Math.max(5, Math.round(6 * scale))
  const jointRKey = Math.max(7, Math.round(9 * scale))
  const mainJoints = new Set([11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28])
  const fillColor = goodForm ? "rgba(74, 222, 128, 0.95)" : "rgba(251, 191, 36, 0.95)"
  const strokeColor = goodForm ? "rgb(74, 222, 128)" : "rgb(239, 68, 68)"

  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i]
    if (!p) continue
    const visibility = p.visibility ?? 1
    if (visibility < 0.15) continue
    const x = p.x * width
    const y = p.y * height
    const radius = mainJoints.has(i) ? jointRKey : jointR
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = fillColor
    ctx.globalAlpha = 1
    ctx.fill()
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}
