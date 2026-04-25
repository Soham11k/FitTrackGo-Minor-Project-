/**
 * Lightweight on-device “coach memory” — rolling aggregates only, no video.
 */

const KEY = "fittrackgo_coach_memory_v1"

export interface ExerciseMemory {
  exercise: string
  sessionCount: number
  lastAvgRepScore: number
  lastSessionScore: number
  weakHint: string | null
  updatedAt: string
}

interface Store {
  byExercise: Record<string, ExerciseMemory>
}

function load(): Store {
  if (typeof window === "undefined") return { byExercise: {} }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { byExercise: {} }
    const p = JSON.parse(raw) as Store
    return p?.byExercise ? p : { byExercise: {} }
  } catch {
    return { byExercise: {} }
  }
}

function save(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch { /* quota */ }
}

export function recordCoachSessionMemory(
  exercise: string,
  repScores: number[],
  sessionScore: number
) {
  const s = load()
  const prev = s.byExercise[exercise]
  const avgRep = repScores.length ? repScores.reduce((a, b) => a + b, 0) / repScores.length : sessionScore
  const late = repScores.length >= 4 ? repScores.slice(-3).reduce((a, b) => a + b, 0) / 3 : avgRep
  const early = repScores.length >= 4 ? repScores.slice(0, 3).reduce((a, b) => a + b, 0) / 3 : avgRep
  let weakHint: string | null = null
  if (repScores.length >= 6 && late < early - 12) {
    weakHint = "Last time, form dipped on later reps — pace yourself and reset if tired."
  } else if (avgRep < 72) {
    weakHint = "Last session averaged below your target — slow down and prioritize depth and alignment."
  } else if (prev?.lastAvgRepScore && avgRep < prev.lastAvgRepScore - 8) {
    weakHint = "Scores slipped vs your last session — check camera angle and lighting."
  }

  s.byExercise[exercise] = {
    exercise,
    sessionCount: (prev?.sessionCount ?? 0) + 1,
    lastAvgRepScore: Math.round(avgRep),
    lastSessionScore: Math.round(sessionScore),
    weakHint,
    updatedAt: new Date().toISOString(),
  }
  save(s)
}

export function getCoachMemoryTip(exercise: string): string | null {
  const m = load().byExercise[exercise]
  return m?.weakHint ?? null
}
