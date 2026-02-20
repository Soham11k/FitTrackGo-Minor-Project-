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

export interface FormBreakdown {
  label: string
  value: string
  ok: boolean
  detail?: string
}

export interface FormResult {
  feedback: string[]
  isGoodForm: boolean
  score: number
  breakdown: FormBreakdown[]
}

export function analyzeForm(lm: Landmark[], exercise: ExerciseId): FormResult {
  const feedback: string[] = []
  const breakdown: FormBreakdown[] = []
  let score = 100

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

    breakdown.push({ label: "Knee angle", value: `${Math.round(kneeAngle)}°`, ok: kneeOk, detail: "Target 70–100° at bottom" })
    breakdown.push({ label: "Back angle", value: `${Math.round(backAngle)}°`, ok: backOk, detail: "Keep torso forward" })
    breakdown.push({ label: "Depth", value: depthOk ? "Good" : "Higher", ok: depthOk, detail: "Break parallel for full rep" })
    breakdown.push({ label: "Knee tracking", value: kneeTrackingOk ? "Good" : "Caving", ok: kneeTrackingOk, detail: "Knees over toes" })
    breakdown.push({ label: "Symmetry", value: sym ? "Even" : "Adjust", ok: sym })

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

    breakdown.push({ label: "Elbow angle", value: `${Math.round(elbowAngle)}°`, ok: elbowOk, detail: "~90° at bottom" })
    breakdown.push({ label: "Body line", value: bodyStraight ? "Straight" : "Adjust", ok: bodyStraight, detail: "Head to heels in line" })
    breakdown.push({ label: "Hip position", value: noSag ? "Level" : "Sagging", ok: noSag, detail: "Hips level with shoulders" })
    breakdown.push({ label: "Elbow flare", value: noFlare ? "Good" : "Wide", ok: noFlare, detail: "Elbows ~45° from body" })

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
  return { feedback, isGoodForm: score >= 70, score, breakdown }
}

export type RepPhase = "idle" | "eccentric" | "bottom" | "concentric" | "top"

// Rep phase detection with hysteresis to prevent false counts
let lastPhase: RepPhase = "idle"
let phaseHistory: RepPhase[] = []

function stabilizePhase(newPhase: RepPhase, exercise: ExerciseId): RepPhase {
  phaseHistory.push(newPhase)
  if (phaseHistory.length > 5) {
    phaseHistory.shift()
  }
  
  // Require consistent phase for 3+ frames before changing
  if (phaseHistory.length >= 3) {
    const mostCommon = phaseHistory.slice(-3).reduce((a, b, _, arr) =>
      arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
    )
    
    // Hysteresis: require more extreme values to change from current phase
    if (mostCommon !== lastPhase) {
      // Only change phase if we've seen the new phase consistently
      const newPhaseCount = phaseHistory.filter(p => p === mostCommon).length
      if (newPhaseCount >= 3) {
        lastPhase = mostCommon
      }
    }
  } else {
    lastPhase = newPhase
  }
  
  return lastPhase
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
    
    // Use average of both legs for more stable detection
    const kneeAngL = angle(lHip, lKnee, lAnkle)
    const kneeAngR = angle(rHip, rKnee, rAnkle)
    const kneeAng = (kneeAngL + kneeAngR) / 2
    
    // LENIENT thresholds: count reps even with imperfect form (just movement pattern)
    // Bottom: any significant bend (relaxed from 95° to 110°)
    const atBottom = kneeAng < 110
    // Top: mostly standing (relaxed from 155° to 145°)
    const atTop = kneeAng > 145
    // Going down: any downward movement
    const goingDown = kneeAng < 135 && kneeAng >= 110
    // Going up: any upward movement
    const goingUp = kneeAng >= 110 && kneeAng < 145
    
    if (lastPhase === "top" || lastPhase === "idle") {
      if (atBottom) rawPhase = "bottom"
      else if (goingDown || kneeAng < 150) rawPhase = "eccentric"
      else rawPhase = "top"
    } else if (lastPhase === "bottom") {
      if (atTop) rawPhase = "top"
      else if (goingUp || kneeAng > 105) rawPhase = "concentric"
      else rawPhase = "bottom"
    } else if (lastPhase === "eccentric") {
      if (atBottom) rawPhase = "bottom"
      else if (kneeAng < 130) rawPhase = "eccentric"
      else rawPhase = "top"
    } else {
      // concentric
      if (atTop) rawPhase = "top"
      else if (kneeAng > 105) rawPhase = "concentric"
      else rawPhase = "bottom"
    }
  }
  
  if (exercise === "pushup") {
    const shoulder = (get(11).y + get(12).y) / 2
    const hip = (get(23).y + get(24).y) / 2
    const wrist = (get(15).y + get(16).y) / 2
    const dist = hip - shoulder
    const depth = wrist - shoulder
    
    // LENIENT pushup detection: count any up/down movement pattern
    // Bottom: any significant lowering (relaxed threshold)
    if (lastPhase === "top" || lastPhase === "idle") {
      if (depth > 0.06) rawPhase = "bottom"
      else if (depth > 0.02) rawPhase = "eccentric"
      else rawPhase = "top"
    } else if (lastPhase === "bottom") {
      if (depth < 0.05) rawPhase = "concentric"
      else rawPhase = "bottom"
    } else {
      if (depth > 0.05) rawPhase = "bottom"
      else if (depth > 0.01) rawPhase = "eccentric"
      else if (depth > -0.03) rawPhase = "concentric"
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
    
    // LENIENT lunge detection: count any step down/up movement
    if (lastPhase === "top" || lastPhase === "idle") {
      if (minKnee < 105) rawPhase = "bottom"  // relaxed from 95
      else rawPhase = "eccentric"
    } else if (lastPhase === "bottom") {
      if (minKnee > 115) rawPhase = "concentric"  // relaxed from 105
      else rawPhase = "bottom"
    } else {
      if (minKnee < 110) rawPhase = "bottom"
      else if (avg < 150) rawPhase = "eccentric"
      else rawPhase = "top"
    }
  }

  if (exercise === "bicep_curl") {
    const elbowL = angle(get(11), get(13), get(15))
    const elbowR = angle(get(12), get(14), get(16))
    const avg = (elbowL + elbowR) / 2
    // LENIENT: count any curl/extension movement
    if (lastPhase === "top" || lastPhase === "idle") {
      if (avg < 70) rawPhase = "bottom"  // relaxed from 50
      else rawPhase = "eccentric"
    } else if (lastPhase === "bottom") {
      if (avg > 120) rawPhase = "top"  // relaxed from 130
      else rawPhase = "concentric"
    } else {
      if (avg < 65) rawPhase = "bottom"
      else if (avg < 110) rawPhase = "eccentric"
      else if (avg < 130) rawPhase = "concentric"
      else rawPhase = "top"
    }
  }

  if (exercise === "shoulder_press") {
    const elbowAngle = (angle(get(11), get(13), get(15)) + angle(get(12), get(14), get(16))) / 2
    // LENIENT: count any press/lower movement
    if (lastPhase === "top" || lastPhase === "idle") {
      if (elbowAngle < 100) rawPhase = "bottom"  // relaxed from 90
      else rawPhase = "eccentric"
    } else if (lastPhase === "bottom") {
      if (elbowAngle > 150) rawPhase = "top"  // relaxed from 160
      else rawPhase = "concentric"
    } else {
      if (elbowAngle < 95) rawPhase = "bottom"
      else if (elbowAngle < 145) rawPhase = "concentric"
      else rawPhase = "top"
    }
  }

  if (exercise === "jumping_jacks" || exercise === "high_knees") {
    const spread = Math.abs(get(15).x - get(16).x) + Math.abs(get(27).x - get(28).x)
    if (lastPhase === "top" || lastPhase === "idle") {
      if (spread > 0.6) rawPhase = "top"
      else rawPhase = "bottom"
    } else {
      if (spread < 0.3) rawPhase = "bottom"
      else rawPhase = "top"
    }
  }

  if (exercise === "crunch") {
    const shoulderY = (get(11).y + get(12).y) / 2
    const hipY = (get(23).y + get(24).y) / 2
    const curl = hipY - shoulderY < 0.15
    if (lastPhase === "top" || lastPhase === "idle") {
      if (curl) rawPhase = "bottom"
      else rawPhase = "top"
    } else if (lastPhase === "bottom") {
      if (!curl) rawPhase = "top"
      else rawPhase = "concentric"
    } else {
      rawPhase = curl ? "bottom" : "top"
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
