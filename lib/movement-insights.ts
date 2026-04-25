/**
 * Pattern summaries from rep-level scores — educational only, not medical advice.
 */

export interface MovementInsight {
  id: string
  title: string
  detail: string
  severity: "info" | "watch"
}

export function insightsFromRepScores(repScores: number[], exerciseLabel: string): MovementInsight[] {
  const out: MovementInsight[] = []
  if (repScores.length < 4) return out

  const first = repScores.slice(0, Math.ceil(repScores.length / 3))
  const last = repScores.slice(-Math.ceil(repScores.length / 3))
  const a = first.reduce((x, y) => x + y, 0) / first.length
  const b = last.reduce((x, y) => x + y, 0) / last.length
  if (a - b > 10) {
    out.push({
      id: "fatigue-slope",
      title: "Form trend",
      detail: `${exerciseLabel}: quality tapered toward the end. Consider shorter sets or longer rest — discuss persistent fatigue with a professional if needed.`,
      severity: "watch",
    })
  }

  let maxJump = 0
  for (let i = 1; i < repScores.length; i++) {
    maxJump = Math.max(maxJump, Math.abs(repScores[i]! - repScores[i - 1]!))
  }
  if (maxJump > 25) {
    out.push({
      id: "variance",
      title: "Inconsistent reps",
      detail: "Large swings between rep scores usually mean visibility or tempo changed — stay centered in frame and move steadily.",
      severity: "info",
    })
  }

  return out
}
