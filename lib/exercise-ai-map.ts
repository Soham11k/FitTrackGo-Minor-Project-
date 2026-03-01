import type { ExerciseId } from "./form-analysis"

/** Map workout step names (normalized) to AI Coach exercise IDs for "Practice with AI" links */
const STEP_NAME_TO_AI: { pattern: RegExp; id: ExerciseId }[] = [
  { pattern: /squat/i, id: "squat" },
  { pattern: /push\s*up|pushup/i, id: "pushup" },
  { pattern: /plank/i, id: "plank" },
  { pattern: /lunge/i, id: "lunge" },
  { pattern: /bicep|curl/i, id: "bicep_curl" },
  { pattern: /shoulder\s*press/i, id: "shoulder_press" },
  { pattern: /jumping\s*jack/i, id: "jumping_jacks" },
  { pattern: /high\s*knee/i, id: "high_knees" },
  { pattern: /crunch/i, id: "crunch" },
]

export function getAICoachIdForStep(stepName: string): ExerciseId | null {
  const name = stepName.trim()
  for (const { pattern, id } of STEP_NAME_TO_AI) {
    if (pattern.test(name)) return id
  }
  return null
}
