export interface Landmark {
  x: number
  y: number
  z?: number
  visibility?: number
}

export type ExerciseId = "squat" | "pushup" | "plank" | "lunge" | "bicep_curl" | "shoulder_press" | "jumping_jacks" | "high_knees" | "crunch"

// MediaPipe indices: 11,12 shoulders, 13,14 elbows, 15,16 wrists, 23,24 hips, 25,26 knees, 27,28 ankles
function angle(a: Landmark, b: Landmark, c: Landmark): number {
  const ax = b.x - a.x
  const ay = b.y - a.y
  const cx = b.x - c.x
  const cy = b.y - c.y
  const dot = ax * cx + ay * cy
  const mag = Math.sqrt(ax * ax + ay * ay) * Math.sqrt(cx * cx + cy * cy) || 1
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI
}

function deg(rad: number) { return (rad * 180) / Math.PI }

export type FormRegion = "torso" | "legs" | "arms" | "core"

export interface FormBreakdown {
  label: string
  value: string
  ok: boolean
  detail?: string
  /**
   * High-level body region this metric belongs to.
   * Used to color skeleton segments (green/red) per region.
   */
  region?: FormRegion
}

export interface FormResult {
  feedback: string[]
  isGoodForm: boolean
  score: number
  breakdown: FormBreakdown[]
}

/** Landmark indices required per exercise for visibility gating */
const REQUIRED_LANDMARKS: Record<ExerciseId, number[]> = {
  squat: [11, 12, 23, 24, 25, 26, 27, 28],
  pushup: [11, 12, 13, 14, 15, 16, 23, 24],
  plank: [11, 12, 23, 24, 25, 26],
  lunge: [11, 12, 23, 24, 25, 26, 27, 28],
  bicep_curl: [11, 12, 13, 14, 15, 16],
  shoulder_press: [11, 12, 13, 14, 15, 16],
  jumping_jacks: [11, 12, 15, 16, 23, 24, 27, 28],
  high_knees: [11, 12, 23, 24, 25, 26, 27, 28],
  crunch: [0, 11, 12, 23, 24],
}

const VISIBILITY_MIN = 0.35

export function hasEnoughVisibility(lm: Landmark[], exercise: ExerciseId): boolean {
  const indices = REQUIRED_LANDMARKS[exercise] ?? REQUIRED_LANDMARKS.squat
  if (!lm?.length) return false
  let sum = 0
  let n = 0
  for (const i of indices) {
    const v = lm[i]?.visibility ?? 0
    sum += v
    n += 1
  }
  return n > 0 && sum / n >= VISIBILITY_MIN
}

export function analyzeForm(lm: Landmark[], exercise: ExerciseId): FormResult {
  const feedback: string[] = []
  const breakdown: FormBreakdown[] = []
  let score = 100

  if (!hasEnoughVisibility(lm, exercise)) {
    return {
      feedback: ["Position yourself in frame"],
      isGoodForm: false,
      score: 0,
      breakdown: [],
    }
  }

  const vis = (i: number) => (lm[i]?.visibility ?? 1) > 0.4
  const get = (i: number) => lm[i] ?? { x: 0.5, y: 0.5 }

  if (exercise === "squat") {
    const lHip = get(23)
    const rHip = get(24)
    const lKnee = get(25)
    const rKnee = get(26)
    const lAnkle = get(27)
    const rAnkle = get(28)
    const lShoulder = get(11)
    const rShoulder = get(12)
    const lWrist = get(15)
    const rWrist = get(16)
    
    const kneeAngleL = angle(lHip, lKnee, lAnkle)
    const kneeAngleR = angle(rHip, rKnee, rAnkle)
    const kneeAngle = (kneeAngleL + kneeAngleR) / 2
    
    // Enhanced back angle calculation
    const backAngleL = angle(lShoulder, lHip, lKnee)
    const backAngleR = angle(rShoulder, rHip, rKnee)
    const backAngle = (backAngleL + backAngleR) / 2
    
    // Knee tracking (knee should be over ankle, not caving in)
    const kneeTrackingL = Math.abs(lKnee.x - lAnkle.x)
    const kneeTrackingR = Math.abs(rKnee.x - rAnkle.x)
    const kneeTracking = (kneeTrackingL + kneeTrackingR) / 2
    const kneeTrackingOk = kneeTracking < 0.05
    
    // Hip-knee-ankle alignment
    const hipKneeAnkleL = angle(lHip, lKnee, lAnkle)
    const hipKneeAnkleR = angle(rHip, rKnee, rAnkle)
    const alignmentOk = Math.abs(hipKneeAnkleL - hipKneeAnkleR) < 10
    
    // Depth calculation (hip below knee)
    const hipHeight = (lHip.y + rHip.y) / 2
    const kneeHeight = (lKnee.y + rKnee.y) / 2
    const depthRatio = (hipHeight - kneeHeight) / Math.abs(lHip.y - lAnkle.y)
    const depthOk = depthRatio > 0.1 || kneeAngle < 100
    
    const kneeOk = kneeAngle > 70 && kneeAngle < 110
    const backOk = backAngle > 30 && backAngle < 80
    const sym = Math.abs(kneeAngleL - kneeAngleR) < 15

    breakdown.push({ label: "Knee angle", value: `${Math.round(kneeAngle)}°`, ok: kneeOk, detail: "Target 70–100° at bottom", region: "legs" })
    breakdown.push({ label: "Back angle", value: `${Math.round(backAngle)}°`, ok: backOk, detail: "Keep torso forward", region: "torso" })
    breakdown.push({ label: "Depth", value: depthOk ? "Good" : "Higher", ok: depthOk, detail: "Break parallel for full rep", region: "legs" })
    breakdown.push({ label: "Knee tracking", value: kneeTrackingOk ? "Good" : "Caving", ok: kneeTrackingOk, detail: "Knees over toes", region: "legs" })
    breakdown.push({ label: "Symmetry", value: sym ? "Even" : "Adjust", ok: sym, region: "legs" })

    if (!depthOk) { feedback.push("Go deeper: break parallel at the bottom"); score -= 15 }
    if (!kneeOk) { feedback.push("Keep knees over toes, don't cave in"); score -= 10 }
    if (!backOk) { feedback.push("Maintain a neutral spine, hinge at hips"); score -= 10 }
    if (!kneeTrackingOk) { feedback.push("Push knees out, don't let them cave inward"); score -= 8 }
    if (!sym) { feedback.push("Balance weight evenly between legs"); score -= 5 }
    if (feedback.length === 0) feedback.push("Great form — depth and alignment look good")
  }

  if (exercise === "pushup") {
    const lShoulder = get(11)
    const rShoulder = get(12)
    const lElbow = get(13)
    const rElbow = get(14)
    const lHip = get(23)
    const rHip = get(24)
    const lWrist = get(15)
    const rWrist = get(16)
    const lAnkle = get(27)
    const rAnkle = get(28)
    
    // Body alignment: shoulder-hip-ankle line
    const shoulderY = (lShoulder.y + rShoulder.y) / 2
    const hipY = (lHip.y + rHip.y) / 2
    const ankleY = (lAnkle.y + rAnkle.y) / 2
    const bodyLineAngle = Math.abs(Math.atan2(hipY - shoulderY, 0.1) - Math.atan2(ankleY - hipY, 0.1)) * (180 / Math.PI)
    const bodyStraight = bodyLineAngle < 15
    
    // Hip sag (hips shouldn't be lower than shoulders)
    const hipSag = hipY - shoulderY
    const noSag = hipSag < 0.05
    
    // Elbow angle
    const elbowL = angle(lShoulder, lElbow, lWrist)
    const elbowR = angle(rShoulder, rElbow, rWrist)
    const elbowAngle = (elbowL + elbowR) / 2
    const elbowOk = elbowAngle > 70 && elbowAngle < 100
    
    // Elbow flare (elbows shouldn't be too wide)
    const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x)
    const elbowWidth = Math.abs(lElbow.x - rElbow.x)
    const flareRatio = elbowWidth / shoulderWidth
    const noFlare = flareRatio < 1.5

    breakdown.push({ label: "Elbow angle", value: `${Math.round(elbowAngle)}°`, ok: elbowOk, detail: "~90° at bottom", region: "arms" })
    breakdown.push({ label: "Body line", value: bodyStraight ? "Straight" : "Adjust", ok: bodyStraight, detail: "Head to heels in line", region: "torso" })
    breakdown.push({ label: "Hip position", value: noSag ? "Level" : "Sagging", ok: noSag, detail: "Hips level with shoulders", region: "core" })
    breakdown.push({ label: "Elbow flare", value: noFlare ? "Good" : "Wide", ok: noFlare, detail: "Elbows ~45° from body", region: "arms" })

    if (!bodyStraight) { feedback.push("Keep a straight line from head to heels"); score -= 15 }
    if (!noSag) { feedback.push("Engage core and glutes to prevent hip sag"); score -= 12 }
    if (!elbowOk) { feedback.push("Elbows at ~45° from body, don't flare"); score -= 10 }
    if (!noFlare) { feedback.push("Keep elbows closer to body, don't flare out"); score -= 8 }
    if (feedback.length === 0) feedback.push("Solid push-up — body line and elbow position good")
  }

  if (exercise === "plank") {
    const lShoulder = get(11)
    const rShoulder = get(12)
    const lHip = get(23)
    const rHip = get(24)
    const lAnkle = get(27)
    const rAnkle = get(28)
    const slope = Math.atan2((lHip.y + rHip.y) / 2 - (lShoulder.y + rShoulder.y) / 2, 0.1) * (180 / Math.PI)
    const hipOk = Math.abs(slope) < 15
    const shoulderOk = (lShoulder.y + rShoulder.y) / 2 < (lHip.y + rHip.y) / 2 + 0.05

    breakdown.push({ label: "Hip height", value: hipOk ? "Neutral" : "Raise/lower", ok: hipOk, detail: "Hips in line with shoulders" })
    breakdown.push({ label: "Shoulders", value: shoulderOk ? "Above hips" : "Adjust", ok: shoulderOk })

    if (!hipOk) { feedback.push("Keep hips level — don't sag or pike"); score -= 15 }
    if (!shoulderOk) { feedback.push("Stack shoulders over wrists"); score -= 10 }
    if (feedback.length === 0) feedback.push("Strong plank — neutral spine and hips")
  }

  if (exercise === "lunge") {
    const lHip = get(23)
    const rHip = get(24)
    const lKnee = get(25)
    const rKnee = get(26)
    const lAnkle = get(27)
    const rAnkle = get(28)
    const kneeAngleL = angle(lHip, lKnee, lAnkle)
    const kneeAngleR = angle(rHip, rKnee, rAnkle)
    const frontKnee = kneeAngleL < 120 ? kneeAngleL : kneeAngleR
    const frontOk = frontKnee > 80 && frontKnee < 100
    const backKnee = kneeAngleL >= 120 ? kneeAngleL : kneeAngleR
    const backOk = backKnee > 140

    breakdown.push({ label: "Front knee", value: `${Math.round(frontKnee)}°`, ok: frontOk, detail: "~90° over ankle" })
    breakdown.push({ label: "Back knee", value: backOk ? "Low" : "Higher", ok: backOk, detail: "Back knee toward floor" })
    breakdown.push({ label: "Balance", value: "OK", ok: true })

    if (!frontOk) { feedback.push("Front knee over ankle, ~90°"); score -= 12 }
    if (!backOk) { feedback.push("Lower back knee toward the floor"); score -= 8 }
    if (feedback.length === 0) feedback.push("Good lunge — depth and alignment on point")
  }

  if (exercise === "bicep_curl") {
    const lShoulder = get(11)
    const rShoulder = get(12)
    const lElbow = get(13)
    const rElbow = get(14)
    const lWrist = get(15)
    const rWrist = get(16)
    const elbowL = angle(lShoulder, lElbow, lWrist)
    const elbowR = angle(rShoulder, rElbow, rWrist)
    const elbowAngle = (elbowL + elbowR) / 2
    const fullRange = elbowAngle > 30 && elbowAngle < 160
    const noSwing = Math.abs(lElbow.x - lShoulder.x) < 0.15 && Math.abs(rElbow.x - rShoulder.x) < 0.15
    breakdown.push({ label: "Elbow angle", value: `${Math.round(elbowAngle)}°`, ok: fullRange, detail: "Full range 30–160°" })
    breakdown.push({ label: "Elbow control", value: noSwing ? "Stable" : "Swing", ok: noSwing, detail: "Don't swing elbows" })
    if (!fullRange) { feedback.push("Use full range — extend at bottom, curl to top"); score -= 12 }
    if (!noSwing) { feedback.push("Keep elbows at your sides, no swinging"); score -= 10 }
    if (feedback.length === 0) feedback.push("Clean curl — full range and control")
  }

  if (exercise === "shoulder_press") {
    const lShoulder = get(11)
    const rShoulder = get(12)
    const lElbow = get(13)
    const rElbow = get(14)
    const lWrist = get(15)
    const rWrist = get(16)
    const elbowL = angle(lShoulder, lElbow, lWrist)
    const elbowR = angle(rShoulder, rElbow, rWrist)
    const elbowAngle = (elbowL + elbowR) / 2
    const sym = Math.abs(elbowL - elbowR) < 15
    const elbowsIn = (lElbow.x + rElbow.x) / 2 > 0.3 && (lElbow.x + rElbow.x) / 2 < 0.7
    breakdown.push({ label: "Elbow angle", value: `${Math.round(elbowAngle)}°`, ok: elbowAngle > 60, detail: "Extend overhead" })
    breakdown.push({ label: "Symmetry", value: sym ? "Even" : "Adjust", ok: sym })
    if (!sym) { feedback.push("Press evenly — both arms together"); score -= 12 }
    if (feedback.length === 0) feedback.push("Strong press — symmetry and control")
  }

  if (exercise === "jumping_jacks") {
    const lWrist = get(15)
    const rWrist = get(16)
    const lAnkle = get(27)
    const rAnkle = get(28)
    const spread = Math.abs(lWrist.x - rWrist.x) + Math.abs(lAnkle.x - rAnkle.x)
    const wideEnough = spread > 0.5
    breakdown.push({ label: "Arm/leg spread", value: wideEnough ? "Good" : "Wider", ok: wideEnough, detail: "Full star position" })
    if (!wideEnough) { feedback.push("Open arms and legs fully at the top"); score -= 10 }
    if (feedback.length === 0) feedback.push("Good jack — full range")
  }

  if (exercise === "high_knees") {
    const lHip = get(23)
    const rHip = get(24)
    const lKnee = get(25)
    const rKnee = get(26)
    const lKneeUp = lKnee.y < lHip.y
    const rKneeUp = rKnee.y < rHip.y
    const drive = lKneeUp || rKneeUp
    breakdown.push({ label: "Knee drive", value: drive ? "Good" : "Drive up", ok: drive, detail: "Knees toward chest" })
    if (!drive) { feedback.push("Drive knees up toward chest"); score -= 10 }
    if (feedback.length === 0) feedback.push("Strong drive — keep the pace")
  }

  if (exercise === "crunch") {
    const shoulder = (get(11).y + get(12).y) / 2
    const hip = (get(23).y + get(24).y) / 2
    const nose = get(0).y
    const curl = shoulder < hip + 0.1 && nose < shoulder + 0.15
    const notSitting = hip > 0.4
    breakdown.push({ label: "Curl", value: curl ? "Good" : "Curl more", ok: curl, detail: "Shoulders off floor" })
    breakdown.push({ label: "Position", value: notSitting ? "Lying" : "OK", ok: notSitting })
    if (!curl) { feedback.push("Curl up — shoulders off the floor"); score -= 12 }
    if (feedback.length === 0) feedback.push("Solid crunch — controlled curl")
  }

  score = Math.max(0, Math.min(100, score))
  // Make "green skeleton" stricter so bad/medium form shows as red more often
  return { feedback, isGoodForm: score >= 80, score, breakdown }
}

export type RepPhase = "idle" | "eccentric" | "bottom" | "concentric" | "top"

// Rep phase detection with strong hysteresis to prevent false counts
let lastPhase: RepPhase = "idle"
let phaseHistory: RepPhase[] = []
const PHASE_HISTORY_LEN = 9
const PHASE_CONSISTENCY_REQUIRED = 3

function stabilizePhase(newPhase: RepPhase, exercise: ExerciseId): RepPhase {
  phaseHistory.push(newPhase)
  if (phaseHistory.length > PHASE_HISTORY_LEN) {
    phaseHistory.shift()
  }

  if (phaseHistory.length >= PHASE_CONSISTENCY_REQUIRED) {
    const recent = phaseHistory.slice(-PHASE_CONSISTENCY_REQUIRED)
    const counts: Record<string, number> = {}
    recent.forEach((p) => { counts[p] = (counts[p] ?? 0) + 1 })
    const mostCommon = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? lastPhase) as RepPhase
    if (mostCommon !== lastPhase && (counts[mostCommon] ?? 0) >= PHASE_CONSISTENCY_REQUIRED) {
      lastPhase = mostCommon
    }
  } else {
    lastPhase = newPhase
  }
  return lastPhase
}

/** Key landmarks for rep counting (shoulders, elbows, wrists, hips, knees, ankles). Return true if enough are visible. */
export function hasEnoughVisibleLandmarks(lm: Landmark[], minVisible: number = 8): boolean {
  if (!lm?.length) return false
  const keyIndices = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
  let visible = 0
  for (const i of keyIndices) {
    if ((lm[i]?.visibility ?? 0) > 0.45) visible++
  }
  return visible >= minVisible
}

const LEG_INDICES = [23, 24, 25, 26, 27, 28]
const ARM_INDICES = [11, 12, 13, 14, 15, 16]
const TORSO_INDICES = [11, 12, 23, 24]
const MIN_VIS = 0.42

function countVisible(lm: Landmark[], indices: number[], minVis = MIN_VIS): number {
  return indices.filter((i) => (lm[i]?.visibility ?? 0) > minVis).length
}

/** Minimum fraction of exercise-specific required landmarks that must be visible (0–1). */
const VISIBLE_FRACTION: Record<ExerciseId, number> = {
  squat: 0.75,
  lunge: 0.75,
  pushup: 0.75,
  plank: 0.67,
  bicep_curl: 0.67,
  shoulder_press: 0.67,
  jumping_jacks: 0.67,
  high_knees: 0.75,
  crunch: 0.6,
}

/** Only count reps when the body parts needed for this exercise are visible (stops counting on wall/partial body). */
export function hasEnoughVisibilityForExercise(lm: Landmark[], exercise: ExerciseId): boolean {
  if (!lm?.length) return false
  const indices = REQUIRED_LANDMARKS[exercise] ?? REQUIRED_LANDMARKS.squat
  const visible = countVisible(lm, indices)
  const required = Math.max(1, Math.ceil(indices.length * (VISIBLE_FRACTION[exercise] ?? 0.7)))
  if (visible < required) return false
  switch (exercise) {
    case "squat":
    case "lunge":
      if (countVisible(lm, [25, 26, 27, 28]) < 2) return false
      if (countVisible(lm, TORSO_INDICES) < 2) return false
      return true
    case "jumping_jacks":
    case "high_knees":
      if (countVisible(lm, LEG_INDICES) < 3) return false
      if (countVisible(lm, TORSO_INDICES) < 2) return false
      return true
    case "crunch":
      if (countVisible(lm, [0, 11, 12, 23, 24]) < 3) return false
      return true
    case "pushup":
    case "plank":
      if (countVisible(lm, ARM_INDICES) < 3) return false
      if (countVisible(lm, TORSO_INDICES) < 2) return false
      return true
    case "bicep_curl":
    case "shoulder_press":
      if (countVisible(lm, ARM_INDICES) < 3) return false
      return true
    default:
      return visible >= required
  }
}

export function getRepPhase(lm: Landmark[], exercise: ExerciseId, reset: boolean = false): RepPhase {
  if (reset) {
    lastPhase = "idle"
    phaseHistory = []
    return "idle"
  }
  
  const get = (i: number) => lm[i] ?? { x: 0.5, y: 0.5 }
  let rawPhase: RepPhase = "idle"
  
  if (exercise === "squat") {
    const lHip = get(23)
    const rHip = get(24)
    const lKnee = get(25)
    const rKnee = get(26)
    const lAnkle = get(27)
    const rAnkle = get(28)
    const kneeAngL = angle(lHip, lKnee, lAnkle)
    const kneeAngR = angle(rHip, rKnee, rAnkle)
    const kneeAng = (kneeAngL + kneeAngR) / 2

    // Thresholds: enough range to count reps without requiring extreme depth/extension
    const atBottom = kneeAng < 108
    const atTop = kneeAng > 156
    const goingDown = kneeAng < 142 && kneeAng >= 108
    const goingUp = kneeAng > 108 && kneeAng < 156

    if (lastPhase === "top" || lastPhase === "idle") {
      if (atBottom) rawPhase = "bottom"
      else if (goingDown || (kneeAng < 158 && kneeAng >= 108)) rawPhase = "eccentric"
      else rawPhase = "top"
    } else if (lastPhase === "bottom") {
      if (atTop) rawPhase = "top"
      else if (goingUp || kneeAng > 108) rawPhase = "concentric"
      else rawPhase = "bottom"
    } else if (lastPhase === "eccentric") {
      if (atBottom) rawPhase = "bottom"
      else if (kneeAng < 118) rawPhase = "eccentric"
      else rawPhase = "top"
    } else {
      if (atTop) rawPhase = "top"
      else if (kneeAng > 98) rawPhase = "concentric"
      else rawPhase = "bottom"
    }
  }
  
  if (exercise === "pushup") {
    const shoulder = (get(11).y + get(12).y) / 2
    const wrist = (get(15).y + get(16).y) / 2
    const depth = wrist - shoulder

    // Strict: clear down = bottom, clear up = top
    const atBottom = depth > 0.09
    const atTop = depth < 0.02
    if (lastPhase === "top" || lastPhase === "idle") {
      if (atBottom) rawPhase = "bottom"
      else if (depth > 0.04) rawPhase = "eccentric"
      else rawPhase = "top"
    } else if (lastPhase === "bottom") {
      if (atTop) rawPhase = "top"
      else if (depth < 0.06) rawPhase = "concentric"
      else rawPhase = "bottom"
    } else {
      if (atBottom) rawPhase = "bottom"
      else if (depth > 0.03) rawPhase = "eccentric"
      else if (depth > -0.02) rawPhase = "concentric"
      else rawPhase = "top"
    }
  }
  
  if (exercise === "plank") {
    rawPhase = "top"
  }
  
  if (exercise === "lunge") {
    const kneeAngleL = angle(get(23), get(25), get(27))
    const kneeAngleR = angle(get(24), get(26), get(28))
    const avg = (kneeAngleL + kneeAngleR) / 2
    const minKnee = Math.min(kneeAngleL, kneeAngleR)

    const atBottom = minKnee < 95
    const atTop = minKnee > 150
    if (lastPhase === "top" || lastPhase === "idle") {
      if (atBottom) rawPhase = "bottom"
      else if (minKnee < 120) rawPhase = "eccentric"
      else rawPhase = "top"
    } else if (lastPhase === "bottom") {
      if (atTop) rawPhase = "top"
      else if (minKnee > 110) rawPhase = "concentric"
      else rawPhase = "bottom"
    } else {
      if (minKnee < 100) rawPhase = "bottom"
      else if (avg < 155) rawPhase = "eccentric"
      else rawPhase = "top"
    }
  }

  if (exercise === "bicep_curl") {
    const elbowL = angle(get(11), get(13), get(15))
    const elbowR = angle(get(12), get(14), get(16))
    const avg = (elbowL + elbowR) / 2
    // Extended arm = high angle (~140–180°); curled = low angle (~30–60°). One rep: top (extended) → bottom (curled) → top.
    const atBottom = avg < 62
    const atTop = avg > 138
    if (lastPhase === "top" || lastPhase === "idle") {
      if (atBottom) rawPhase = "bottom"
      else if (avg < 95) rawPhase = "eccentric"
      else rawPhase = "top"
    } else if (lastPhase === "bottom") {
      if (atTop) rawPhase = "top"
      else if (avg > 95) rawPhase = "concentric"
      else rawPhase = "bottom"
    } else {
      if (avg < 58) rawPhase = "bottom"
      else if (avg < 100) rawPhase = "eccentric"
      else if (avg < 132) rawPhase = "concentric"
      else rawPhase = "top"
    }
  }

  if (exercise === "shoulder_press") {
    const elbowAngle = (angle(get(11), get(13), get(15)) + angle(get(12), get(14), get(16))) / 2
    const atBottom = elbowAngle < 95
    const atTop = elbowAngle > 165
    if (lastPhase === "top" || lastPhase === "idle") {
      if (atBottom) rawPhase = "bottom"
      else if (elbowAngle < 120) rawPhase = "eccentric"
      else rawPhase = "top"
    } else if (lastPhase === "bottom") {
      if (atTop) rawPhase = "top"
      else if (elbowAngle > 140) rawPhase = "concentric"
      else rawPhase = "bottom"
    } else {
      if (elbowAngle < 90) rawPhase = "bottom"
      else if (elbowAngle < 155) rawPhase = "concentric"
      else rawPhase = "top"
    }
  }

  if (exercise === "jumping_jacks" || exercise === "high_knees") {
    const wristSpread = Math.abs(get(15).x - get(16).x)
    const ankleSpread = Math.abs(get(27).x - get(28).x)
    const spread = wristSpread + ankleSpread
    const armsOut = wristSpread > 0.42
    const legsOut = ankleSpread > 0.38
    const atTop = spread > 0.78 && armsOut && legsOut
    const atBottom = spread < 0.22
    const deadZone = spread >= 0.22 && spread <= 0.78
    if (deadZone) {
      rawPhase = lastPhase
    } else if (lastPhase === "top" || lastPhase === "idle") {
      if (atTop) rawPhase = "top"
      else if (atBottom) rawPhase = "bottom"
      else rawPhase = lastPhase
    } else {
      if (atBottom) rawPhase = "bottom"
      else if (atTop) rawPhase = "top"
      else rawPhase = lastPhase
    }
  }

  if (exercise === "crunch") {
    const shoulderY = (get(11).y + get(12).y) / 2
    const hipY = (get(23).y + get(24).y) / 2
    const noseY = get(0).y
    const curlUp = shoulderY < hipY - 0.08 && noseY < shoulderY + 0.12
    const flat = hipY - shoulderY > 0.12
    if (lastPhase === "top" || lastPhase === "idle") {
      if (curlUp) rawPhase = "bottom"
      else if (flat) rawPhase = "top"
      else rawPhase = "top"
    } else if (lastPhase === "bottom") {
      if (flat) rawPhase = "top"
      else rawPhase = "concentric"
    } else {
      rawPhase = curlUp ? "bottom" : (flat ? "top" : "concentric")
    }
  }
  
  return stabilizePhase(rawPhase, exercise)
}

export const EXERCISE_TIPS: Record<ExerciseId, string[]> = {
  squat: ["Stand 6–8 ft from camera, full body in frame", "Feet shoulder-width, toes slightly out", "Break at hips first, then knees", "Aim for knee angle 70–100° at bottom", "Keep chest up, core braced"],
  pushup: ["Camera from the side for best angle", "Hands under shoulders, body in one line", "Lower until chest nearly touches floor", "Elbows ~45° from body", "Squeeze glutes to avoid sagging"],
  plank: ["Side view preferred", "Forearms or hands under shoulders", "Hips level with shoulders", "Engage core and glutes", "Breathe steadily"],
  lunge: ["Full body in frame, side or 45°", "Step far enough: front knee ~90°", "Back knee drops toward floor", "Keep torso upright", "Drive through front heel to stand"],
  bicep_curl: ["Face camera, full upper body visible", "Elbows at sides, no swinging", "Full range: extend at bottom, curl to top", "Control the weight, no momentum"],
  shoulder_press: ["Face or slight angle, upper body in frame", "Start elbows ~90°, press straight up", "Keep core tight, don't arch back", "Lower with control"],
  jumping_jacks: ["Full body in frame, step back if needed", "Arms overhead, legs apart at top", "Land softly, stay light on feet", "Steady rhythm"],
  high_knees: ["Full body in frame", "Drive knees up toward chest", "Quick feet, land on balls of feet", "Pump arms naturally"],
  crunch: ["Lie down, camera from the side", "Feet flat or knees up", "Curl shoulders off floor, don't pull neck", "Controlled up and down"],
}
