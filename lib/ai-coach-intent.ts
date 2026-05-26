export interface AICoachIntent {
  /** FormSpec id (legacy `ExerciseId` or catalog variant). */
  exerciseId?: string
  /** Open Mobility Coach immediately (recovery / readiness prescription). */
  openMobility?: boolean
  /** Open the custom exercise builder sheet on the Coach tab. */
  openCustomExerciseBuilder?: boolean
}

let pendingIntent: AICoachIntent | null = null

export function setAICoachIntent(intent: AICoachIntent) {
  pendingIntent = intent
}

export function consumeAICoachIntent(): AICoachIntent | null {
  const intent = pendingIntent
  pendingIntent = null
  return intent
}

