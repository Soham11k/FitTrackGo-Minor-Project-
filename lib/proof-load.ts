/**
 * Proof Load — a quality-weighted daily training load score that merges:
 *  - Coach sessions (form-weighted effective reps)
 *  - GPS runs (distance × pace factor)
 *  - Wearable readiness (recovery modifier)
 *
 * Unlike WHOOP Strain or Strava TRIMP, Proof Load *penalises junk volume*:
 * poor-form reps count for less than their raw count. Verified movement gets
 * a small bonus. The result is a 0–100+ scale where 40 is a moderate day,
 * 70+ is a heavy day, and 100+ is an elite/overload day.
 */

import type { CoachRecord, RunRecord } from "@/lib/store"
import { effectiveRepCount } from "@/lib/competition"

export interface ProofLoadResult {
  /** Total Proof Load score for the day (0–100+). */
  score: number
  /** Breakdown components. */
  coachLoad: number
  runLoad: number
  readinessModifier: number
  /** Human-readable hint. */
  hint: string
  /** Whether a deload is recommended. */
  deloadRecommended: boolean
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === todayIso()
}

/**
 * Compute Proof Load for today's sessions.
 *
 * @param coachSessions  All coach sessions (filtered to today inside).
 * @param runs           All run records (filtered to today inside).
 * @param readinessScore Optional 0–100 readiness from wearables (defaults to 72 = neutral).
 */
export function computeProofLoad(
  coachSessions: CoachRecord[],
  runs: RunRecord[],
  readinessScore = 72,
): ProofLoadResult {
  // --- Coach load ---
  // Each effective rep contributes load proportional to form quality.
  // Verified sessions get +15% bonus.
  let coachLoad = 0
  for (const s of coachSessions) {
    if (!isToday(s.completedAt)) continue
    const eff = s.effectiveReps ?? effectiveRepCount(s.reps, s.repScores, s.score)
    const verifiedBonus = s.verifiedMovement ? 1.15 : 1.0
    coachLoad += eff * verifiedBonus * 0.8
  }

  // --- Run load ---
  // Simplified TRIMP-lite: km × pace-zone factor.
  let runLoad = 0
  for (const r of runs) {
    if (!isToday(r.completedAt)) continue
    const km = r.distance / 1000
    const pacePerKm = r.duration / 60 / (km || 1) // min/km
    // Map pace to zone factor: sub-4min = 2.5, 4–5 = 2.0, 5–7 = 1.4, 7+ = 1.0
    const zoneFactor =
      pacePerKm < 4 ? 2.5 : pacePerKm < 5 ? 2.0 : pacePerKm < 7 ? 1.4 : 1.0
    runLoad += km * zoneFactor * 4
  }

  // --- Readiness modifier ---
  // readiness 72 = neutral (×1.0). Below 55 = high stress (load feels heavier).
  // Above 85 = well-recovered (load feels lighter).
  const readinessModifier =
    readinessScore >= 85 ? 0.88 :
    readinessScore >= 72 ? 1.0 :
    readinessScore >= 55 ? 1.15 : 1.3

  const rawScore = coachLoad + runLoad
  const score = Math.round(rawScore * readinessModifier * 10) / 10

  const deloadRecommended = score > 70 || (readinessScore < 55 && score > 40)

  const hint =
    score === 0
      ? "No training logged today. Light movement counts."
      : score < 20
        ? "Light day — good for recovery or an easy session."
        : score < 40
          ? "Moderate Proof Load — well within healthy range."
          : score < 70
            ? "Solid training load. Prioritise sleep tonight."
            : "Heavy day. Consider tomorrow an active recovery session."

  return { score, coachLoad, runLoad, readinessModifier, hint, deloadRecommended }
}

/**
 * Compute a 7-day Proof Load trend (oldest first) for charting.
 */
export function computeProofLoadWeek(
  coachSessions: CoachRecord[],
  runs: RunRecord[],
): number[] {
  const days: number[] = []
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    const iso = d.toISOString().slice(0, 10)
    let coachLoad = 0
    for (const s of coachSessions) {
      if (s.completedAt.slice(0, 10) !== iso) continue
      const eff = s.effectiveReps ?? effectiveRepCount(s.reps, s.repScores, s.score)
      coachLoad += eff * (s.verifiedMovement ? 1.15 : 1.0) * 0.8
    }
    let runLoad = 0
    for (const r of runs) {
      if (r.completedAt.slice(0, 10) !== iso) continue
      const km = r.distance / 1000
      const pacePerKm = r.duration / 60 / (km || 1)
      const zoneFactor = pacePerKm < 4 ? 2.5 : pacePerKm < 5 ? 2.0 : pacePerKm < 7 ? 1.4 : 1.0
      runLoad += km * zoneFactor * 4
    }
    days.push(Math.round((coachLoad + runLoad) * 10) / 10)
  }
  return days
}
