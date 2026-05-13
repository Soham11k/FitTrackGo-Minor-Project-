/**
 * Indicative 0–100 readiness from resting HR trend + SpO₂ + recent load (not medical).
 */

export type ReadinessInput = {
  /** Last 14+ resting HR samples (bpm), oldest first */
  restingSeries: number[]
  /** Most recent resting HR if known */
  latestResting: number | null
  /** Recent SpO₂ % samples (e.g. last 7 days) */
  spo2Series: number[]
  /** Workout sessions in last 7 days (any type) */
  sessionsLast7d: number
}

export function computeReadiness(input: ReadinessInput): { score: number; hint: string } {
  const { restingSeries, latestResting, spo2Series, sessionsLast7d } = input
  let score = 72
  const hints: string[] = []

  if (restingSeries.length >= 5 && latestResting != null) {
    const sorted = [...restingSeries].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const baseline = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    const delta = latestResting - baseline
    if (delta > 6) {
      score -= 12
      hints.push("Resting HR is elevated vs your recent baseline — consider an easy day.")
    } else if (delta < -3) {
      score += 6
      hints.push("Resting HR looks favorable vs baseline.")
    }
  }

  if (spo2Series.length > 0) {
    const avg = spo2Series.reduce((a, b) => a + b, 0) / spo2Series.length
    if (avg < 94) {
      score -= 10
      hints.push("Recent SpO₂ reads on the low side — recovery or environment may be a factor.")
    } else if (avg >= 96) {
      score += 4
    }
  }

  if (sessionsLast7d >= 6) {
    score -= 5
    hints.push("High weekly volume — prioritize sleep and easy movement.")
  } else if (sessionsLast7d <= 1) {
    score += 3
  }

  score = Math.max(15, Math.min(100, Math.round(score)))
  const hint = hints[0] ?? "Indicative score from your synced vitals and recent activity — not a medical assessment."
  return { score, hint }
}
