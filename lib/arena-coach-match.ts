import type { CoachRecord } from "@/lib/store"

export function normalizeMovementLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
}

/**
 * Match a duel's movement label to the user's latest compatible coach session
 * (order preserved — callers should pass sessions sorted newest-first).
 */
export function coachSessionForDuelExercise(
  sessions: CoachRecord[],
  duelExerciseLabel: string,
): CoachRecord | null {
  const d = normalizeMovementLabel(duelExerciseLabel)
  if (!d) return null
  for (const s of sessions) {
    const e = normalizeMovementLabel(s.exercise)
    if (!e) continue
    if (e === d || e.includes(d) || d.includes(e)) return s
  }
  return null
}
