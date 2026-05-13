/** Range-of-motion / hold mobility drills tracked with the same pose runtime. */

import type { ExerciseId } from "@/lib/form-analysis"

export type MobilityDrillId = "deep_squat_hold" | "hip_9090_hold" | "shoulder_dislocates"

export interface MobilityDrill {
  id: MobilityDrillId
  /** Label stored on coach_sessions.exercise */
  name: string
  /** Landmark angle keys (`computeJointAngles`) to evaluate against band. */
  targetAngles: Partial<Record<string, [number, number]>>
  /** Target seconds cumulative in-band. */
  holdSec: number
  /** Which pose exercise-angle pack to reuse for HUD + sampling */
  poseExercise: ExerciseId
  description: string
}

export const MOBILITY_DRILLS: MobilityDrill[] = [
  {
    id: "deep_squat_hold",
    name: "Deep squat hold",
    description: "Sit into a deep squat; keep knees tracking as you breathe.",
    holdSec: 25,
    poseExercise: "squat",
    targetAngles: {
      "knee.l": [55, 105],
      "knee.r": [55, 105],
    },
  },
  {
    id: "hip_9090_hold",
    name: "Hip 90/90 hold",
    description: "Grounded 90/90 — keep torso tall, soft switch sides each round.",
    holdSec: 20,
    poseExercise: "lunge",
    targetAngles: {
      "hip.l": [70, 130],
      "hip.r": [70, 130],
    },
  },
  {
    id: "shoulder_dislocates",
    name: "Shoulder pass-through rhythm",
    description: "Arms wide, controlled overhead path — accumulate quality seconds.",
    holdSec: 18,
    poseExercise: "shoulder_press",
    targetAngles: {
      "shoulder.l": [25, 150],
      "shoulder.r": [25, 150],
    },
  },
]

export function drillById(id: MobilityDrillId): MobilityDrill | undefined {
  return MOBILITY_DRILLS.find((d) => d.id === id)
}
