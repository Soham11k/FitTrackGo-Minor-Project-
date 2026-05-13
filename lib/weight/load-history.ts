/**
 * Per-exercise load history. Backed by localStorage for the simple flow;
 * the canonical record lives in `coach_sessions.load_kg` once the migration
 * in `supabase/migrations/20260514101000_coach_session_load.sql` is applied.
 */

const STORAGE_KEY = "ft-load-history-v1"

interface LoadHistoryEntry {
  /** Last load used for this exercise, in kg. */
  lastKg: number
  /** Best load lifted for >= 5 reps, in kg. */
  bestKg?: number
  /** Best reps achieved at the best load. */
  bestReps?: number
  updatedAt: string
}

type Store = Record<string, LoadHistoryEntry>

function load(): Store {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function persist(s: Store): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // ignore quota errors
  }
}

export function getLastLoadKg(exerciseId: string): number | undefined {
  return load()[exerciseId]?.lastKg
}

export function getBestLoadKg(exerciseId: string): { kg: number; reps: number } | undefined {
  const e = load()[exerciseId]
  if (!e || e.bestKg === undefined || e.bestReps === undefined) return undefined
  return { kg: e.bestKg, reps: e.bestReps }
}

export function recordSet(exerciseId: string, opts: { loadKg: number; reps: number }): void {
  const s = load()
  const prev = s[exerciseId]
  const next: LoadHistoryEntry = {
    lastKg: opts.loadKg,
    bestKg: prev?.bestKg,
    bestReps: prev?.bestReps,
    updatedAt: new Date().toISOString(),
  }
  if (opts.reps >= 5) {
    if (!next.bestKg || opts.loadKg > next.bestKg) {
      next.bestKg = opts.loadKg
      next.bestReps = opts.reps
    } else if (next.bestKg === opts.loadKg && (!next.bestReps || opts.reps > next.bestReps)) {
      next.bestReps = opts.reps
    }
  }
  s[exerciseId] = next
  persist(s)
}
