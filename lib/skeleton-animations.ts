/**
 * Canvas-based skeleton animation system.
 *
 * Manages 10 independent animation layers drawn on top of the skeleton:
 *  1. Joint pulse glow (on rep complete)
 *  2. Bone flow (animated dashes along segments)
 *  3. Form feedback ripple (expanding ring on form change)
 *  4. Breathing guide ring (pulsing circle on torso)
 *  5. Rep completion burst (particles from center of mass)
 *  6. Joint motion trails (ghosted past positions)
 *  7. Skeleton fade-in (progressive segment reveal)
 *  8. Form color gradient (smoothed hue shift red→green)
 *  9. Active region highlight (glow on exercise-relevant body part)
 * 10. Heartbeat pulse (rhythmic torso throb synced to rep cadence)
 *
 * Usage:
 *   import { skeletonAnim } from "@/lib/skeleton-animations"
 *   // each frame:
 *   skeletonAnim.update(timestamp, landmarks, { score, isGoodForm, phase, exercise })
 *   skeletonAnim.draw(ctx, width, height, landmarks)
 *   // on events:
 *   skeletonAnim.onRepComplete(landmarks)
 *   skeletonAnim.onFormChange(isGoodForm, landmarks)
 *   skeletonAnim.reset()
 */

import type { LandmarkPoint } from "./pose-detection"
import { getCoachA11yPrefs } from "./coach-a11y"

function motionReduced(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (getCoachA11yPrefs().reduceMotion) return true
  } catch {
    /* noop */
  }
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  size: number
  hue: number
}

interface Ripple {
  cx: number; cy: number
  startTime: number
  duration: number
  good: boolean
}

interface TrailPoint { x: number; y: number; t: number }

type RegionName = "torso" | "legs" | "arms" | "core" | null

const TRAIL_JOINTS = [0, 15, 16, 27, 28]
const TRAIL_MAX = 12

const ACTIVE_REGION_MAP: Record<string, Record<string, RegionName>> = {
  squat:          { eccentric: "legs", bottom: "legs", concentric: "legs", top: "torso" },
  pushup:         { eccentric: "arms", bottom: "arms", concentric: "arms", top: "core" },
  plank:          { top: "core", idle: "core" },
  lunge:          { eccentric: "legs", bottom: "legs", concentric: "legs", top: "torso" },
  bicep_curl:     { eccentric: "arms", bottom: "arms", concentric: "arms", top: "arms" },
  shoulder_press: { eccentric: "arms", bottom: "arms", concentric: "arms", top: "arms" },
  jumping_jacks:  { top: "arms", bottom: "legs" },
  high_knees:     { top: "legs", bottom: "legs" },
  crunch:         { bottom: "core", concentric: "core", top: "core" },
}

const REGION_INDICES: Record<string, number[]> = {
  torso: [11, 12, 23, 24],
  arms:  [11, 12, 13, 14, 15, 16],
  legs:  [23, 24, 25, 26, 27, 28],
  core:  [11, 12, 23, 24],
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let jointPulseTime = 0
let dashOffset = 0
let ripples: Ripple[] = []
let particles: Particle[] = []
let trails: Map<number, TrailPoint[]> = new Map()
let fadeInStart = 0
let fadeInDone = false
let smoothedScore = 50
let activeRegion: RegionName = null
let heartbeatPhase = 0
let repTimes: number[] = []
let breathPhase = 0
let lastTimestamp = 0
let poseEverDetected = false

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function reset() {
  jointPulseTime = 0
  dashOffset = 0
  ripples = []
  particles = []
  trails = new Map()
  fadeInStart = 0
  fadeInDone = false
  smoothedScore = 50
  activeRegion = null
  heartbeatPhase = 0
  repTimes = []
  breathPhase = 0
  lastTimestamp = 0
  poseEverDetected = false
}

interface UpdateContext {
  score: number
  isGoodForm: boolean
  phase: string
  exercise: string
}

function update(
  timestamp: number,
  landmarks: LandmarkPoint[] | null,
  ctx: UpdateContext
) {
  const dt = lastTimestamp > 0 ? Math.min(0.1, (timestamp - lastTimestamp) / 1000) : 1 / 30
  lastTimestamp = timestamp
  const reduced = motionReduced()

  // Trigger fade-in on first detection
  if (landmarks?.length && !poseEverDetected) {
    poseEverDetected = true
    fadeInStart = timestamp
  }

  if (!reduced) {
    dashOffset += dt * 40
    breathPhase += dt * (2 * Math.PI / 4)
  }

  if (!reduced) {
    particles = particles.filter((p) => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 120 * dt
      p.life -= dt
      p.size *= 0.97
      return p.life > 0
    })
  } else {
    particles = []
  }

  // 6. Joint trails
  if (!reduced && landmarks?.length) {
    for (const idx of TRAIL_JOINTS) {
      const lm = landmarks[idx]
      if (!lm || (lm.visibility ?? 0) < 0.3) continue
      let arr = trails.get(idx)
      if (!arr) { arr = []; trails.set(idx, arr) }
      arr.push({ x: lm.x, y: lm.y, t: timestamp })
      while (arr.length > TRAIL_MAX) arr.shift()
    }
  }

  // 7. Fade-in progress (1.2 seconds)
  if (!fadeInDone && fadeInStart > 0 && timestamp - fadeInStart > 1200) {
    fadeInDone = true
  }

  // 8. Smooth score
  smoothedScore += (ctx.score - smoothedScore) * Math.min(1, dt * 3)

  // 9. Active region
  const regionMap = ACTIVE_REGION_MAP[ctx.exercise]
  activeRegion = regionMap?.[ctx.phase] ?? null

  if (!reduced) {
    const cadence = estimateCadence()
    heartbeatPhase += dt * (2 * Math.PI * cadence)
  }

  // Ripple cleanup
  ripples = ripples.filter(r => timestamp - r.startTime < r.duration)
}

function onRepComplete(landmarks: LandmarkPoint[]) {
  const now = performance.now()
  jointPulseTime = now
  repTimes.push(now)
  if (repTimes.length > 10) repTimes.shift()

  if (motionReduced()) return

  const com = centerOfMass(landmarks)
  if (com) {
    const count = 18
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const speed = 80 + Math.random() * 120
      particles.push({
        x: com.x, y: com.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
        size: 3 + Math.random() * 4,
        hue: 120 + Math.random() * 40, // green-ish
      })
    }
  }
}

function onFormChange(isGoodForm: boolean, landmarks: LandmarkPoint[]) {
  const com = centerOfMass(landmarks)
  if (com) {
    ripples.push({
      cx: com.x, cy: com.y,
      startTime: performance.now(),
      duration: 800,
      good: isGoodForm,
    })
  }
}

// ---------------------------------------------------------------------------
// Draw — called after drawSkeleton each frame
// ---------------------------------------------------------------------------

function draw(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  landmarks: LandmarkPoint[] | null
) {
  if (!landmarks?.length) return
  if (motionReduced()) return

  const now = performance.now()

  // Fade-in progress
  const fadeProgress = fadeInDone ? 1 : fadeInStart > 0 ? Math.min(1, (now - fadeInStart) / 1200) : 0
  if (fadeProgress < 1) {
    drawFadeIn(ctx, w, h, landmarks, fadeProgress)
  }

  // 1. Joint pulse glow
  if (jointPulseTime > 0) {
    const elapsed = (now - jointPulseTime) / 1000
    if (elapsed < 0.6) {
      drawJointPulse(ctx, w, h, landmarks, elapsed)
    }
  }

  // 2. Bone flow
  drawBoneFlow(ctx, w, h, landmarks)

  // 3. Form ripples
  for (const ripple of ripples) {
    drawRipple(ctx, w, h, ripple, now)
  }

  // 4. Breathing guide
  drawBreathingGuide(ctx, w, h, landmarks)

  // 5. Particles
  drawParticles(ctx, w, h)

  // 6. Joint trails
  drawTrails(ctx, w, h)

  // 8. Form color gradient overlay
  drawFormGradientOverlay(ctx, w, h, landmarks)

  // 9. Active region highlight
  if (activeRegion) {
    drawActiveRegion(ctx, w, h, landmarks, activeRegion)
  }

  // 10. Heartbeat
  drawHeartbeat(ctx, w, h, landmarks)
}

// ---------------------------------------------------------------------------
// Body scan sweep (separate, called during setup phase)
// ---------------------------------------------------------------------------

let scanSweepStart = 0

function startScanSweep() {
  scanSweepStart = performance.now()
}

function drawScanSweep(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  landmarks: LandmarkPoint[] | null
) {
  if (scanSweepStart <= 0) return
  const elapsed = (performance.now() - scanSweepStart) / 1000
  const duration = 2.5
  if (elapsed > duration) { scanSweepStart = 0; return }

  const progress = elapsed / duration
  const sweepY = progress * h

  // Sweep line
  const grad = ctx.createLinearGradient(0, sweepY - 30, 0, sweepY + 2)
  grad.addColorStop(0, "rgba(59, 130, 246, 0)")
  grad.addColorStop(0.7, "rgba(59, 130, 246, 0.5)")
  grad.addColorStop(1, "rgba(59, 130, 246, 0.8)")
  ctx.fillStyle = grad
  ctx.fillRect(0, sweepY - 30, w, 32)

  // Bright line
  ctx.fillStyle = "rgba(59, 130, 246, 0.9)"
  ctx.fillRect(0, sweepY, w, 2)

  // Highlight detected landmarks above the sweep line
  if (landmarks?.length) {
    for (let i = 0; i < landmarks.length; i++) {
      const p = landmarks[i]
      if (!p || (p.visibility ?? 0) < 0.3) continue
      const py = p.y * h
      if (py <= sweepY) {
        ctx.beginPath()
        ctx.arc(p.x * w, py, 6, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(74, 222, 128, 0.7)"
        ctx.fill()

        // Ping animation
        const pingProgress = Math.max(0, Math.min(1, (sweepY - py) / (h * 0.1)))
        if (pingProgress < 1) {
          ctx.beginPath()
          ctx.arc(p.x * w, py, 6 + pingProgress * 12, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(74, 222, 128, ${0.5 * (1 - pingProgress)})`
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Individual animation draw functions
// ---------------------------------------------------------------------------

function drawJointPulse(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  lm: LandmarkPoint[],
  elapsed: number
) {
  const progress = elapsed / 0.6
  const radius = 8 + progress * 25
  const alpha = 0.6 * (1 - progress)
  const majorJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

  for (const idx of majorJoints) {
    const p = lm[idx]
    if (!p || (p.visibility ?? 0) < 0.2) continue
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(74, 222, 128, ${alpha * 0.3})`
    ctx.fill()
    ctx.strokeStyle = `rgba(74, 222, 128, ${alpha})`
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function drawBoneFlow(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  lm: LandmarkPoint[]
) {
  const flowConns: [number, number][] = [
    [11, 13], [13, 15], [12, 14], [14, 16],
    [23, 25], [25, 27], [24, 26], [26, 28],
    [11, 23], [12, 24],
  ]

  ctx.save()
  ctx.setLineDash([4, 8])
  ctx.lineDashOffset = -dashOffset
  ctx.lineWidth = 1.5
  ctx.lineCap = "round"
  ctx.strokeStyle = "rgba(147, 197, 253, 0.35)"

  for (const [a, b] of flowConns) {
    const pa = lm[a], pb = lm[b]
    if (!pa || !pb) continue
    if ((pa.visibility ?? 0) < 0.2 || (pb.visibility ?? 0) < 0.2) continue
    ctx.beginPath()
    ctx.moveTo(pa.x * w, pa.y * h)
    ctx.lineTo(pb.x * w, pb.y * h)
    ctx.stroke()
  }
  ctx.restore()
}

function drawRipple(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  ripple: Ripple,
  now: number
) {
  const progress = (now - ripple.startTime) / ripple.duration
  if (progress < 0 || progress > 1) return
  const radius = progress * Math.max(w, h) * 0.3
  const alpha = 0.5 * (1 - progress)
  const color = ripple.good ? `rgba(74, 222, 128, ${alpha})` : `rgba(239, 68, 68, ${alpha})`

  ctx.beginPath()
  ctx.arc(ripple.cx * w, ripple.cy * h, radius, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = 3 * (1 - progress) + 1
  ctx.stroke()
}

function drawBreathingGuide(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  lm: LandmarkPoint[]
) {
  const ls = lm[11], rs = lm[12], lh = lm[23], rh = lm[24]
  if (!ls || !rs || !lh || !rh) return
  if ((ls.visibility ?? 0) < 0.3 || (rs.visibility ?? 0) < 0.3) return

  const cx = ((ls.x + rs.x + lh.x + rh.x) / 4) * w
  const cy = ((ls.y + rs.y + lh.y + rh.y) / 4) * h
  const baseR = Math.abs(ls.x - rs.x) * w * 0.8
  const pulse = Math.sin(breathPhase) * 0.15 + 1
  const r = baseR * pulse

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(147, 197, 253, ${0.12 + Math.sin(breathPhase) * 0.06})`
  ctx.lineWidth = 1.5
  ctx.setLineDash([3, 6])
  ctx.stroke()
  ctx.setLineDash([])
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  w: number, h: number
) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife)
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, p.size * alpha, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${alpha * 0.8})`
    ctx.fill()
  }
}

function drawTrails(
  ctx: CanvasRenderingContext2D,
  w: number, h: number
) {
  const now = performance.now()
  const maxAge = 400

  for (const [, points] of trails) {
    if (points.length < 2) continue
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1], curr = points[i]
      const age = now - curr.t
      if (age > maxAge) continue
      const alpha = 0.4 * (1 - age / maxAge) * (i / points.length)
      ctx.beginPath()
      ctx.moveTo(prev.x * w, prev.y * h)
      ctx.lineTo(curr.x * w, curr.y * h)
      ctx.strokeStyle = `rgba(192, 132, 252, ${alpha})`
      ctx.lineWidth = 2 * (i / points.length)
      ctx.lineCap = "round"
      ctx.stroke()
    }
  }
}

function drawFadeIn(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  lm: LandmarkPoint[],
  progress: number
) {
  // Animated scan line at the construction front
  const sweepY = progress * h
  const grad = ctx.createLinearGradient(0, sweepY - 15, 0, sweepY + 2)
  grad.addColorStop(0, "rgba(59, 130, 246, 0)")
  grad.addColorStop(1, "rgba(59, 130, 246, 0.3)")
  ctx.fillStyle = grad
  ctx.fillRect(0, sweepY - 15, w, 17)
}

function drawFormGradientOverlay(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  lm: LandmarkPoint[]
) {
  // Subtle tinted glow on the body based on smoothed score
  const hue = (smoothedScore / 100) * 120 // 0=red, 60=yellow, 120=green
  const com = centerOfMass(lm)
  if (!com) return

  const grad = ctx.createRadialGradient(
    com.x * w, com.y * h, 10,
    com.x * w, com.y * h, Math.min(w, h) * 0.25
  )
  grad.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.08)`)
  grad.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

function drawActiveRegion(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  lm: LandmarkPoint[],
  region: string
) {
  const indices = REGION_INDICES[region]
  if (!indices) return

  const pulse = Math.sin(performance.now() / 300) * 0.3 + 0.7
  const alpha = 0.15 * pulse

  for (const idx of indices) {
    const p = lm[idx]
    if (!p || (p.visibility ?? 0) < 0.2) continue
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 18, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`
    ctx.fill()
  }
}

function drawHeartbeat(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  lm: LandmarkPoint[]
) {
  const ls = lm[11], rs = lm[12], lh = lm[23], rh = lm[24]
  if (!ls || !rs || !lh || !rh) return
  if ((ls.visibility ?? 0) < 0.3 || (rs.visibility ?? 0) < 0.3) return

  const cx = ((ls.x + rs.x) / 2) * w
  const cy = ((ls.y + rs.y + lh.y + rh.y) / 4) * h

  // Sharp heartbeat pulse shape (double peak)
  const phase = heartbeatPhase % (Math.PI * 2)
  const beat = phase < 0.4 ? Math.sin(phase * Math.PI / 0.4) * 0.6 :
               phase < 0.8 ? Math.sin((phase - 0.4) * Math.PI / 0.4) * 0.3 : 0
  if (beat < 0.05) return

  const r = 15 + beat * 10
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(239, 68, 68, ${beat * 0.12})`
  ctx.fill()
  ctx.strokeStyle = `rgba(239, 68, 68, ${beat * 0.25})`
  ctx.lineWidth = 1.5
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function centerOfMass(lm: LandmarkPoint[]): { x: number; y: number } | null {
  const indices = [11, 12, 23, 24]
  let sx = 0, sy = 0, n = 0
  for (const i of indices) {
    const p = lm[i]
    if (p && (p.visibility ?? 0) > 0.3) {
      sx += p.x; sy += p.y; n++
    }
  }
  return n > 0 ? { x: sx / n, y: sy / n } : null
}

function estimateCadence(): number {
  if (repTimes.length < 2) return 1
  const intervals: number[] = []
  for (let i = 1; i < repTimes.length; i++) {
    intervals.push(repTimes[i] - repTimes[i - 1])
  }
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  return avgInterval > 0 ? 1000 / avgInterval : 1
}

// ---------------------------------------------------------------------------
// Export singleton
// ---------------------------------------------------------------------------

export const skeletonAnim = {
  reset,
  update,
  draw,
  onRepComplete,
  onFormChange,
  startScanSweep,
  drawScanSweep,
}
