/**
 * Joint-angle HUD + range-of-motion tracking.
 *
 * `computeJointAngles` returns the angles the HUD should display per
 * exercise. `RomTracker` remembers the deepest joint angle in the current
 * rep and converts it into a normalized 0..1 ROM bar.
 */
import type { Landmark, ExerciseId, CoachExerciseId } from "@/lib/form-analysis"
import { isLegacyExerciseId } from "@/lib/form-analysis"

export interface JointAngle {
  key: string
  label: string
  degrees: number
  /** Normalized 0..1 for drawing a gauge; domain depends on joint. */
  normalized: number
}

function angle(a: Landmark, b: Landmark, c: Landmark): number {
  const ax = b.x - a.x
  const ay = b.y - a.y
  const cx = b.x - c.x
  const cy = b.y - c.y
  const dot = ax * cx + ay * cy
  const mag = Math.sqrt(ax * ax + ay * ay) * Math.sqrt(cx * cx + cy * cy) || 1
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI
}
const safe = (lm: Landmark[], i: number): Landmark =>
  lm[i] ?? { x: 0, y: 0, z: 0, visibility: 0 }

/** Map FormSpec ids to a legacy HUD profile (angles shown on rep traces). */
function normalizeHudExercise(exercise: CoachExerciseId): ExerciseId {
  if (isLegacyExerciseId(exercise)) return exercise
  if (exercise.startsWith("pushup")) return "pushup"
  if (exercise === "side_plank") return "plank"
  if (["goblet_squat", "front_squat", "wall_sit"].includes(exercise)) return "squat"
  if (["bulgarian_split_squat", "romanian_split_squat", "step_up"].includes(exercise)) return "lunge"
  if (["hip_thrust", "glute_bridge"].includes(exercise)) return "deadlift"
  if (["sit_up", "bicycle_crunch", "dead_bug", "bird_dog"].includes(exercise)) return "crunch"
  if (["mountain_climber", "burpee"].includes(exercise)) return "plank"
  if (exercise === "jump_rope" || exercise === "box_jump") return "jumping_jacks"
  if (["leg_press", "leg_extension", "leg_curl", "calf_raise"].includes(exercise)) return "squat"
  if (["kettlebell_swing", "farmer_carry"].includes(exercise)) return "deadlift"
  if (
    [
      "bench_press",
      "incline_bench_press",
      "lateral_raise",
      "front_raise",
      "overhead_tricep_extension",
      "face_pull",
      "reverse_fly",
    ].includes(exercise)
  )
    return "shoulder_press"
  return "pushup"
}

export function computeJointAngles(lm: Landmark[], exercise: CoachExerciseId): JointAngle[] {
  if (!lm?.length) return []
  const out: JointAngle[] = []
  const ex = normalizeHudExercise(exercise)

  switch (ex) {
    case "lunge":
    case "high_knees":
    case "deadlift":
    case "rdl": {
      const kneeL = angle(safe(lm, 23), safe(lm, 25), safe(lm, 27))
      const kneeR = angle(safe(lm, 24), safe(lm, 26), safe(lm, 28))
      const hipL = angle(safe(lm, 11), safe(lm, 23), safe(lm, 25))
      const hipR = angle(safe(lm, 12), safe(lm, 24), safe(lm, 26))
      out.push(
        { key: "knee.l", label: "Knee L", degrees: kneeL, normalized: normalize(kneeL, 50, 180) },
        { key: "knee.r", label: "Knee R", degrees: kneeR, normalized: normalize(kneeR, 50, 180) },
        { key: "hip.l", label: "Hip L", degrees: hipL, normalized: normalize(hipL, 60, 180) },
        { key: "hip.r", label: "Hip R", degrees: hipR, normalized: normalize(hipR, 60, 180) }
      )
      break
    }
    case "pushup":
    case "shoulder_press":
    case "bicep_curl": {
      const elbowL = angle(safe(lm, 11), safe(lm, 13), safe(lm, 15))
      const elbowR = angle(safe(lm, 12), safe(lm, 14), safe(lm, 16))
      const shoulderL = angle(safe(lm, 13), safe(lm, 11), safe(lm, 23))
      const shoulderR = angle(safe(lm, 14), safe(lm, 12), safe(lm, 24))
      out.push(
        { key: "elbow.l", label: "Elbow L", degrees: elbowL, normalized: normalize(elbowL, 30, 180) },
        { key: "elbow.r", label: "Elbow R", degrees: elbowR, normalized: normalize(elbowR, 30, 180) },
        { key: "shoulder.l", label: "Shoulder L", degrees: shoulderL, normalized: normalize(shoulderL, 30, 180) },
        { key: "shoulder.r", label: "Shoulder R", degrees: shoulderR, normalized: normalize(shoulderR, 30, 180) }
      )
      break
    }
    case "plank":
    case "crunch": {
      const hipL = angle(safe(lm, 11), safe(lm, 23), safe(lm, 25))
      const hipR = angle(safe(lm, 12), safe(lm, 24), safe(lm, 26))
      out.push(
        { key: "hip.l", label: "Hip L", degrees: hipL, normalized: normalize(hipL, 120, 200) },
        { key: "hip.r", label: "Hip R", degrees: hipR, normalized: normalize(hipR, 120, 200) }
      )
      break
    }
    case "jumping_jacks": {
      const armSpread =
        Math.abs(safe(lm, 15).x - safe(lm, 16).x) + Math.abs(safe(lm, 27).x - safe(lm, 28).x)
      out.push({
        key: "spread",
        label: "Spread",
        degrees: armSpread * 180,
        normalized: normalize(armSpread, 0.2, 1),
      })
      break
    }
  }

  return out
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

/**
 * Tracks range of motion for the current rep and the best rep of the set.
 *
 * Usage: call `update(minJointAngle)` each frame with the primary joint
 * angle the exercise rewards (e.g. minimum knee angle on a squat). On every
 * rep boundary, call `commitRep()` which returns a ROM fraction 0..1 for the
 * rep just finished and resets tracking.
 */
export class RomTracker {
  private min = Infinity
  private max = -Infinity
  private best = 0
  private lastCommitted = 0

  update(deg: number) {
    if (!Number.isFinite(deg)) return
    if (deg < this.min) this.min = deg
    if (deg > this.max) this.max = deg
  }

  commitRep(domain: [number, number] = [60, 170]): number {
    if (!Number.isFinite(this.min) || !Number.isFinite(this.max)) {
      this.reset()
      return 0
    }
    const [lo, hi] = domain
    const rom = Math.max(0, Math.min(1, (this.max - this.min) / (hi - lo)))
    this.lastCommitted = rom
    this.best = Math.max(this.best, rom)
    this.reset()
    return rom
  }

  private reset() {
    this.min = Infinity
    this.max = -Infinity
  }

  getBest(): number {
    return this.best
  }

  getLast(): number {
    return this.lastCommitted
  }
}
