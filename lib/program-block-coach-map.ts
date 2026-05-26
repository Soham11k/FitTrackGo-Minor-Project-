/**
 * Maps seeded `program_day_blocks.exercise_id` values from `supabase/seed.sql`
 * to descriptive step names → FormSpec ids via `getSpecIdForStep`.
 */

import { getSpecIdForStep } from "@/lib/exercise-ai-map"

/** Keys match Bodyweight Foundations Day 1 blocks in seed.sql comments. */
const PROGRAM_BLOCK_STEP_NAME: Partial<Record<number, string>> = {
  1: "Squats",
  2: "Push ups",
  3: "Plank hold",
  4: "Lunges",
}

export function getProgramBlockSpecId(blockExerciseId: number): string | null {
  const stepName = PROGRAM_BLOCK_STEP_NAME[blockExerciseId]
  if (!stepName) return null
  return getSpecIdForStep(stepName)
}
