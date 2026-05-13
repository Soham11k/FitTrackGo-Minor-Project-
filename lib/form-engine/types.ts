/**
 * FormSpec: a data-driven description of an exercise that the generic
 * FormEngine can read to produce form scores, faults, and rep phases.
 *
 * Compatible with the result shape of `lib/form-analysis.ts` (`FormResult`).
 */

import type { Landmark, FormRegion } from "../form-analysis"

export type LoadType = "none" | "bodyweight" | "external"

/** Pose-landmark slot we can address by friendly name. Maps to MediaPipe Pose indices. */
export type JointSlot =
  | "nose"
  | "left_shoulder"
  | "right_shoulder"
  | "left_elbow"
  | "right_elbow"
  | "left_wrist"
  | "right_wrist"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_ankle"
  | "right_ankle"

/** Friendly identifiers for things the DSL can compare. */
export type MetricId =
  // Joint angles (averaged when not side-specific)
  | "knee_angle_avg"
  | "knee_angle_left"
  | "knee_angle_right"
  | "knee_angle_min"
  | "knee_angle_max"
  | "elbow_angle_avg"
  | "elbow_angle_left"
  | "elbow_angle_right"
  | "back_angle_avg"
  | "hip_hinge_avg"
  | "shoulder_angle_avg"
  // Y positions (image-normalized, 0 top -> 1 bottom)
  | "shoulder_y_avg"
  | "hip_y_avg"
  | "knee_y_avg"
  | "wrist_y_avg"
  | "ankle_y_avg"
  | "nose_y"
  // Derived geometry
  | "depth_ratio"
  | "hip_sag_y"
  | "body_line_deviation"
  | "knee_tracking_x"
  | "shoulder_width_x"
  | "elbow_flare_ratio"
  | "knee_symmetry_diff"
  | "elbow_symmetry_diff"
  | "wrist_spread_x"
  | "ankle_spread_x"
  | "total_spread_x"
  | "bar_drift_x"
  | "shoulder_hip_y_delta"
  | "load_ratio"

export type Op = ">" | ">=" | "<" | "<=" | "between"

export interface CompareCondition {
  metric: MetricId
  op: Op
  value: number
  /** Used only when op === "between". */
  hi?: number
}

export interface AllCondition {
  all: Condition[]
}

export interface AnyCondition {
  any: Condition[]
}

export interface NotCondition {
  not: Condition
}

export type Condition = CompareCondition | AllCondition | AnyCondition | NotCondition

export interface LoadRelax {
  /** Threshold above which the relaxation applies, in load-to-bodyweight ratio. */
  perXBodyweight: number
  /** Degrees of leeway added to the comparison threshold for angle metrics. */
  addThresholdDeg: number
}

export interface BreakdownDef {
  label: string
  /** "${metric}°" => formatted angle; "OK|TEXT|TEXT2" => boolean labels (ok-label|fail-label). */
  format: "angle" | "text" | "boolean"
  metric?: MetricId
  /** Used with "text" / "boolean" formats. */
  okLabel?: string
  failLabel?: string
  detail?: string
  region?: FormRegion
  /** Condition determining `ok`. If omitted, mirrors the parent rule. */
  whenOk?: Condition
}

export interface RuleDef {
  id: string
  region: FormRegion | "global"
  /** Penalty applied when condition is TRUE (rule failed). */
  penalty: number
  /** When this evaluates true, the rule is *failed* (penalty applies). */
  when: Condition
  /** User-facing feedback shown when the rule fires. */
  feedback: string
  /** Optional load-aware relaxation: when load ratio exceeds, add tolerance to relevant comparisons. */
  loadRelax?: LoadRelax
  /** Optional UI breakdown row. */
  breakdown?: BreakdownDef
}

export type PhaseName = "idle" | "eccentric" | "bottom" | "concentric" | "top"

export interface PhaseDef {
  name: PhaseName
  /** Triggers entering this phase from any other phase. */
  enterWhen?: Condition
  /** Triggers exiting from this phase if a more specific transition fires. */
  exitWhen?: Condition
  /** Convenient hint for a typical pattern: "always hold" (plank-style). */
  always?: boolean
}

export interface AngleDef {
  name: string
  joints: [JointSlot, JointSlot, JointSlot]
  /** Mark as primary HUD angle (shown by default). */
  primary?: boolean
}

export interface FormSpec {
  id: string
  displayName: string
  /** Free-form taxonomy: "lower" / "upper" / "core" / "compound" / "cardio" etc. */
  category: string
  loadType: LoadType
  /** MediaPipe landmark indices required to be visible to score this exercise. */
  requiredLandmarks: number[]
  /** Fraction of `requiredLandmarks` that must clear visibility gate. */
  visibleFraction: number
  rules: RuleDef[]
  phases: PhaseDef[]
  /** Optional HUD angles to surface in coach-vision overlay. */
  hudAngles?: AngleDef[]
  /** Default feedback line when no rule fires (positive reinforcement). */
  positiveLine?: string
  /** Defines how a "rep" is counted. Default: top -> bottom -> top. */
  repPattern?: "top_bottom_top" | "bottom_top_bottom" | "hold"
}

export interface AnalyzeContext {
  bodyWeightKg?: number
  loadKg?: number
  /** Pre-computed loadKg / bodyWeightKg. Engine recomputes if absent. */
  loadRatio?: number
  /** Optional per-set rolling history of recent rep scores. */
  recentRepScores?: number[]
}

export interface AnalyzeResult {
  feedback: string[]
  isGoodForm: boolean
  score: number
  breakdown: Array<{
    label: string
    value: string
    ok: boolean
    detail?: string
    region?: FormRegion
  }>
  trackingReliability?: number
  /** Surfaced for the AI Coach to display under HUD. */
  triggeredRules: string[]
  /** True when "load.degraded" meta-rule fired this rep. */
  loadDegraded?: boolean
}

export type LandmarkBag = {
  /** MediaPipe image landmarks (33 entries). */
  image: Landmark[]
  /** MediaPipe world landmarks (optional). */
  world?: Landmark[]
}
