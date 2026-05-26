import type { ExerciseId } from "./form-analysis"
import { hasSpec } from "./form-engine/registry"

/** Map workout step names (normalized) to AI Coach exercise IDs for "Practice with AI" links */
const STEP_NAME_TO_AI: { pattern: RegExp; id: ExerciseId }[] = [
  // Specific hybrids first so they don't get swallowed by short prefixes.
  { pattern: /romanian|rdl\b|stiff[^\n]*leg/i, id: "rdl" },
  { pattern: /dead\s*lift|deadlift/i, id: "deadlift" },
  { pattern: /shoulder\s*press/i, id: "shoulder_press" },
  { pattern: /jumping\s*jack/i, id: "jumping_jacks" },
  { pattern: /high\s*knee/i, id: "high_knees" },
  { pattern: /plank/i, id: "plank" },
  { pattern: /push\s*up|pushup/i, id: "pushup" },
  { pattern: /lunge/i, id: "lunge" },
  { pattern: /squat/i, id: "squat" },
  { pattern: /bicep|curl/i, id: "bicep_curl" },
  { pattern: /crunch/i, id: "crunch" },
]

/**
 * Resolve a workout step name to an AI-Coach `ExerciseId` for the legacy
 * coach surface. Returns null when no legacy id matches.
 */
export function getAICoachIdForStep(stepName: string): ExerciseId | null {
  const name = stepName.trim()
  for (const { pattern, id } of STEP_NAME_TO_AI) {
    if (pattern.test(name)) return id
  }
  return null
}

/**
 * Extended map covering the spec catalog. Returns a registered spec id when
 * one matches. Includes the legacy ids and the newer movements that only
 * exist as FormSpec JSON files.
 */
const STEP_NAME_TO_SPEC: { pattern: RegExp; id: string }[] = [
  // Push-up variants before generic pushup.
  { pattern: /incline\s+push[\s-]*up|push[\s-]*up[^\n]*incline|incline\s+pushup/i, id: "pushup_incline" },
  { pattern: /diamond\s+push[\s-]*up|push[\s-]*up[^\n]*diamond|diamond\s+pushup/i, id: "pushup_diamond" },
  { pattern: /wide\s+push[\s-]*up|push[\s-]*up[^\n]*wide|wide\s+pushup|wide-grip\s+push/i, id: "pushup_wide" },
  {
    pattern: /knee\s+push[\s-]*up|push[\s-]*up[^\n]*knee|knee\s+pushup|on\s+knees\s+push|girl\s*push/i,
    id: "pushup_knee",
  },
  { pattern: /push\s*up|pushup/i, id: "pushup" },
  // Specific compound / hybrid lifts first.
  { pattern: /incline\s+bench\s*press/i, id: "incline_bench_press" },
  { pattern: /bench\s*press/i, id: "bench_press" },
  { pattern: /front\s+squat/i, id: "front_squat" },
  { pattern: /goblet\s+squat/i, id: "goblet_squat" },
  { pattern: /bulgarian\s+split/i, id: "bulgarian_split_squat" },
  { pattern: /romanian\s+split/i, id: "romanian_split_squat" },
  { pattern: /barbell\s*row/i, id: "barbell_row" },
  { pattern: /dumbbell\s*row|db\s*row|one\s*arm\s*row/i, id: "dumbbell_row" },
  { pattern: /lat\s*pull[- ]?down/i, id: "lat_pulldown" },
  { pattern: /pull[- ]?up/i, id: "pull_up" },
  { pattern: /chin[- ]?up/i, id: "chin_up" },
  { pattern: /bench\s*dip/i, id: "bench_dip" },
  { pattern: /tricep\s*dip|^dip\b/i, id: "dip" },
  {
    pattern:
      /triceps?\s*push[\s-]*down|rope[^\n]{0,28}push[\s-]*down|cable[^\n]{0,28}push[\s-]*down|push[\s-]*down[^\n]{0,40}(?:tricep|cable|rope)/i,
    id: "tricep_pushdown",
  },
  { pattern: /tricep\s*kickback|triceps\s*kickback/i, id: "tricep_kickback" },
  {
    pattern: /concentration\s*curl/i,
    id: "concentration_curl",
  },
  { pattern: /preacher\s*curl/i, id: "preacher_curl" },
  {
    pattern: /incline\s+dumbbell\s*curl|incline\s*(db|d\.b\.)\s*curl|curl[^\n]*incline\s*dumbbell/i,
    id: "incline_dumbbell_curl",
  },
  {
    pattern: /cable\s*(bicep|biceps)?\s*curl|curl[^\n]*(cable|stack)|standing\s*cable\s*curl/i,
    id: "cable_bicep_curl",
  },
  { pattern: /overhead\s*tricep|skull\s*crusher|tricep\s*extension|triceps\s*extension/i, id: "overhead_tricep_extension" },
  { pattern: /hammer\s*curl/i, id: "hammer_curl" },
  { pattern: /lateral\s*raise|side\s*raise/i, id: "lateral_raise" },
  { pattern: /front\s*raise/i, id: "front_raise" },
  { pattern: /face\s*pull/i, id: "face_pull" },
  { pattern: /reverse\s*fly|rear\s*delt\s*fly/i, id: "reverse_fly" },
  { pattern: /leg\s*press/i, id: "leg_press" },
  { pattern: /leg\s*extension/i, id: "leg_extension" },
  { pattern: /leg\s*curl|hamstring\s*curl/i, id: "leg_curl" },
  { pattern: /hip\s*thrust/i, id: "hip_thrust" },
  { pattern: /glute\s*bridge/i, id: "glute_bridge" },
  { pattern: /calf\s*raise/i, id: "calf_raise" },
  { pattern: /step[- ]?up/i, id: "step_up" },
  { pattern: /kettlebell\s*swing|kb\s*swing/i, id: "kettlebell_swing" },
  { pattern: /sit[- ]?up/i, id: "sit_up" },
  { pattern: /bicycle\s*crunch/i, id: "bicycle_crunch" },
  { pattern: /dead\s*bug/i, id: "dead_bug" },
  { pattern: /mountain\s*climber/i, id: "mountain_climber" },
  { pattern: /burpee/i, id: "burpee" },
  { pattern: /side\s*plank/i, id: "side_plank" },
  { pattern: /bird\s*dog/i, id: "bird_dog" },
  { pattern: /wall\s*sit/i, id: "wall_sit" },
  { pattern: /jump\s*rope|skip\s*rope|skipping/i, id: "jump_rope" },
  { pattern: /box\s*jump/i, id: "box_jump" },
  { pattern: /farmer\s*carry|farmer'?s\s*walk/i, id: "farmer_carry" },
]

/**
 * Resolve a workout step name to a `FormSpec` id, preferring more specific
 * compound names. Falls through to the legacy ExerciseId map when no spec
 * match was found. Returns null if neither matches a known movement.
 */
export function getSpecIdForStep(stepName: string): string | null {
  const name = stepName.trim()
  for (const { pattern, id } of STEP_NAME_TO_SPEC) {
    if (pattern.test(name) && hasSpec(id)) return id
  }
  const legacy = getAICoachIdForStep(stepName)
  return legacy && hasSpec(legacy) ? legacy : legacy
}
