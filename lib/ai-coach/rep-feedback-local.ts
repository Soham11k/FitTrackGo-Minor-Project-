/**
 * Instant per-rep coaching notes from on-device rep traces (no vision API).
 */

import { findVariantBySpecId } from "@/lib/coach-exercise-catalog"
import type { RepCoachFeedback } from "@/lib/ai-coach/clip-review"
import type { RepTracePair } from "@/lib/rep-trace"

export function mergeFaultsFromTrace(pair: RepTracePair | undefined): string[] {
  if (!pair) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const txt of [...pair.bottom.faults, ...pair.top.faults]) {
    const t = txt.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out.slice(0, 6)
}

function defaultGoodBullets(exerciseId: string, score?: number): string[] {
  const found = findVariantBySpecId(exerciseId)
  const tips = found?.variant.tips?.filter(Boolean).slice(0, 2) ?? []
  if (tips.length > 0) {
    return tips.map((t) => (t.length > 72 ? `${t.slice(0, 69)}…` : t))
  }
  if (typeof score === "number" && score >= 80) {
    return ["Solid rep control and consistency on this set"]
  }
  return ["Rep completed with tracking active — keep the same setup"]
}

/**
 * Build per-rep good/improve from on-device traces + scores (0-based rep index).
 */
export function buildLocalRepFeedback(
  repCount: number,
  traces: RepTracePair[],
  scores: number[],
  exerciseId: string,
): RepCoachFeedback[] {
  const safeN = Math.max(1, repCount)
  const out: RepCoachFeedback[] = []

  for (let i = 0; i < safeN; i++) {
    const trace = traces.find((t) => t.rep === i + 1) ?? traces[i]
    const improve = mergeFaultsFromTrace(trace)
    const score = typeof scores[i] === "number" ? scores[i] : undefined
    let good: string[] = []

    if (improve.length === 0) {
      good = defaultGoodBullets(exerciseId, score)
    } else if (typeof score === "number" && score >= 75) {
      good = ["You still hit depth/tempo targets on parts of this rep", ...defaultGoodBullets(exerciseId, score).slice(0, 1)]
    } else {
      good = defaultGoodBullets(exerciseId, score).slice(0, 1)
    }

    out.push({
      repIndex: i,
      good: good.slice(0, 3),
      improve: improve.slice(0, 3),
      score,
    })
  }

  return out
}
