import type { ExerciseItem } from "@/lib/data"

const KEY = "ft-workout-session-v1"
const MAX_AGE_MS = 48 * 60 * 60 * 1000

export type WorkoutPhase = "active" | "rest"

export type WorkoutSessionSnapshot = {
  v: 1
  exerciseId: number
  exercise: ExerciseItem
  index: number
  phase: WorkoutPhase
  secondsLeft: number
  totalSeconds: number
  paused: boolean
  updatedAt: number
}

export function saveWorkoutSessionSnapshot(s: Omit<WorkoutSessionSnapshot, "v" | "updatedAt">): void {
  if (typeof window === "undefined") return
  try {
    const payload: WorkoutSessionSnapshot = {
      v: 1,
      updatedAt: Date.now(),
      ...s,
    }
    window.localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function clearWorkoutSessionSnapshot(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function readWorkoutSessionSnapshot(): WorkoutSessionSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as WorkoutSessionSnapshot
    if (o?.v !== 1 || typeof o.exerciseId !== "number" || !o.exercise) return null
    if (Date.now() - (o.updatedAt ?? 0) > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY)
      return null
    }
    if (o.phase !== "active" && o.phase !== "rest") return null
    return o
  } catch {
    return null
  }
}
