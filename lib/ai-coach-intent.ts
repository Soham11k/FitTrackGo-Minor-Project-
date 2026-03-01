import type { ExerciseId } from "./form-analysis"

export interface AICoachIntent {
  exerciseId: ExerciseId
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

