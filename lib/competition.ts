/**
 * Form-weighted scoring, verified-movement tier, and async duel composite scores.
 * Server can mirror these rules for fair leaderboards later.
 */

export const VERIFIED_FORM_MIN = 70

/** Reps weighted by form quality (0–100 scores). Poor form reduces “effective” volume. */
export function effectiveRepCount(reps: number, repScores: number[], sessionScore: number): number {
  if (reps <= 0) return 0
  const avgRep = repScores.length ? repScores.reduce((a, b) => a + b, 0) / repScores.length : sessionScore
  const q = Math.min(1, Math.max(0, avgRep / 100) * 0.65 + (sessionScore / 100) * 0.35)
  return Math.round(reps * q * 100) / 100
}

export function isVerifiedMovement(repScores: number[], sessionScore: number): boolean {
  if (repScores.length === 0) return sessionScore >= VERIFIED_FORM_MIN
  const avg = repScores.reduce((a, b) => a + b, 0) / repScores.length
  const minOk = repScores.filter((s) => s >= VERIFIED_FORM_MIN - 5).length / repScores.length >= 0.85
  return minOk && avg >= VERIFIED_FORM_MIN - 5 && sessionScore >= VERIFIED_FORM_MIN - 10
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const m = values.reduce((a, b) => a + b, 0) / values.length
  const v = values.reduce((a, x) => a + (x - m) ** 2, 0) / values.length
  return Math.sqrt(v)
}

/**
 * Single number for async duels: blends effective reps with consistency (lower variance = bonus).
 * Range roughly 0–200+ for typical sessions.
 */
export function duelCompositeScore(reps: number, repScores: number[], sessionScore: number): number {
  const eff = effectiveRepCount(reps, repScores, sessionScore)
  const cons = repScores.length ? Math.max(0, 100 - stddev(repScores)) : sessionScore
  return Math.round(eff * (0.72 + cons / 500) * 10) / 10
}

function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Consecutive local calendar days with at least one qualifying coach session. */
export function computeVerifiedDayStreak(
  sessions: Array<{ completedAt: string; faceVerifiedSession?: boolean }>,
  requireFace: boolean
): number {
  const active = new Set<string>()
  for (const s of sessions) {
    if (!s.completedAt) continue
    if (requireFace && !s.faceVerifiedSession) continue
    const iso = s.completedAt.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) active.add(iso)
  }
  if (active.size === 0) return 0

  const cursor = new Date()
  cursor.setHours(12, 0, 0, 0)
  if (!active.has(localDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  if (!active.has(localDateStr(cursor))) return 0

  let streak = 0
  while (active.has(localDateStr(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
