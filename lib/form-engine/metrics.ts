import type { Landmark } from "../form-analysis"
import { angle2d, hipPlumbLineDeviation, jointAngle } from "../pose-geometry"
import type { LandmarkBag, MetricId } from "./types"

const get = (lm: Landmark[], i: number): Landmark => lm[i] ?? { x: 0.5, y: 0.5 }

function wTriple(
  world: Landmark[] | undefined,
  a: number,
  b: number,
  c: number
): { a?: Landmark; b?: Landmark; c?: Landmark } | undefined {
  if (!world) return undefined
  if (world[a] && world[b] && world[c]) {
    return { a: world[a], b: world[b], c: world[c] }
  }
  return undefined
}

/**
 * Compute every metric the DSL can reference from the same landmarks.
 * Returns a partial map: metrics that can't be computed (missing landmarks)
 * are left undefined.
 */
export function computeMetrics(bag: LandmarkBag, loadRatio?: number): Partial<Record<MetricId, number>> {
  const { image: lm, world } = bag
  const m: Partial<Record<MetricId, number>> = {}

  const lS = get(lm, 11)
  const rS = get(lm, 12)
  const lE = get(lm, 13)
  const rE = get(lm, 14)
  const lW = get(lm, 15)
  const rW = get(lm, 16)
  const lH = get(lm, 23)
  const rH = get(lm, 24)
  const lK = get(lm, 25)
  const rK = get(lm, 26)
  const lA = get(lm, 27)
  const rA = get(lm, 28)
  const nose = get(lm, 0)

  // Knee angles
  const kneeAngleL = jointAngle(lH, lK, lA, wTriple(world, 23, 25, 27))
  const kneeAngleR = jointAngle(rH, rK, rA, wTriple(world, 24, 26, 28))
  m.knee_angle_left = kneeAngleL
  m.knee_angle_right = kneeAngleR
  m.knee_angle_avg = (kneeAngleL + kneeAngleR) / 2
  m.knee_angle_min = Math.min(kneeAngleL, kneeAngleR)
  m.knee_angle_max = Math.max(kneeAngleL, kneeAngleR)

  // Elbow angles
  const elbowL = jointAngle(lS, lE, lW, wTriple(world, 11, 13, 15))
  const elbowR = jointAngle(rS, rE, rW, wTriple(world, 12, 14, 16))
  m.elbow_angle_left = elbowL
  m.elbow_angle_right = elbowR
  m.elbow_angle_avg = (elbowL + elbowR) / 2

  // Back / hip hinge (shoulder-hip-knee at hip)
  const backL = jointAngle(lS, lH, lK, wTriple(world, 11, 23, 25))
  const backR = jointAngle(rS, rH, rK, wTriple(world, 12, 24, 26))
  m.back_angle_avg = (backL + backR) / 2
  m.hip_hinge_avg = m.back_angle_avg

  // Shoulder-elbow-wrist at shoulder (used for some upper-body specs)
  const shAngL = jointAngle(lH, lS, lE, wTriple(world, 23, 11, 13))
  const shAngR = jointAngle(rH, rS, rE, wTriple(world, 24, 12, 14))
  m.shoulder_angle_avg = (shAngL + shAngR) / 2

  // Y positions
  m.shoulder_y_avg = (lS.y + rS.y) / 2
  m.hip_y_avg = (lH.y + rH.y) / 2
  m.knee_y_avg = (lK.y + rK.y) / 2
  m.wrist_y_avg = (lW.y + rW.y) / 2
  m.ankle_y_avg = (lA.y + rA.y) / 2
  m.nose_y = nose.y

  // Squat depth ratio (hip below knee, normalized by leg height)
  const legHeight = Math.abs(lH.y - lA.y)
  const hipMinusKnee = m.hip_y_avg - m.knee_y_avg
  m.depth_ratio = legHeight > 1e-6 ? hipMinusKnee / legHeight : 0

  // Pushup-style metrics
  m.hip_sag_y = m.hip_y_avg - m.shoulder_y_avg
  m.shoulder_hip_y_delta = m.shoulder_y_avg - m.hip_y_avg

  // Body line deviation
  const plumbW =
    world && world[11] && world[12] && world[23] && world[24] && world[27] && world[28]
      ? {
          lShoulder: world[11],
          rShoulder: world[12],
          lHip: world[23],
          rHip: world[24],
          lAnkle: world[27],
          rAnkle: world[28],
        }
      : undefined
  const plumb = hipPlumbLineDeviation(lS, rS, lH, rH, lA, rA, plumbW)
  m.body_line_deviation = plumb.deviationFromStraight

  // Knee tracking (mean L+R lateral offset)
  m.knee_tracking_x = (Math.abs(lK.x - lA.x) + Math.abs(rK.x - rA.x)) / 2

  m.shoulder_width_x = Math.abs(lS.x - rS.x)
  const elbowWidth = Math.abs(lE.x - rE.x)
  m.elbow_flare_ratio = m.shoulder_width_x > 1e-6 ? elbowWidth / m.shoulder_width_x : 0

  m.knee_symmetry_diff = Math.abs(kneeAngleL - kneeAngleR)
  m.elbow_symmetry_diff = Math.abs(elbowL - elbowR)

  m.wrist_spread_x = Math.abs(lW.x - rW.x)
  m.ankle_spread_x = Math.abs(lA.x - rA.x)
  m.total_spread_x = m.wrist_spread_x + m.ankle_spread_x

  // Bar path proxy for deadlift-style (camera): midpoint of wrists vs midpoint of ankles
  const midFootX = (lA.x + rA.x) / 2
  const midWristX = (lW.x + rW.x) / 2
  m.bar_drift_x = Math.abs(midWristX - midFootX)

  // Helper for legacy 2D back angle approximation when desired
  void angle2d

  // Load ratio (forwarded so DSL rules can branch on load)
  if (loadRatio !== undefined && Number.isFinite(loadRatio)) {
    m.load_ratio = loadRatio
  }

  return m
}
