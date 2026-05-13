/**
 * Client-side AI form fallback. When the active exercise has no FormSpec,
 * we summarize the current frame as joint angles and POST them to
 * `/api/ai-coach/score-pose`. The route asks an LLM to score the form.
 *
 * Throttled to once every 2s per call site so we don't hammer the route.
 */

import type { Landmark } from "../form-analysis"
import { angle2d } from "../pose-geometry"

const get = (lm: Landmark[], i: number): Landmark => lm[i] ?? { x: 0.5, y: 0.5 }

export interface AiFallbackResult {
  score: number
  isGoodForm: boolean
  feedback: string[]
  faultRegions: string[]
}

export interface AiFallbackContext {
  exerciseName: string
  bodyWeightKg?: number
  loadKg?: number
  /** Optional landmarks from ~0.5s prior, to give the model a sense of motion. */
  prevLandmarks?: Landmark[]
}

/** Compute the angle bundle we send to the server. Small payload (~16 numbers). */
function summarizeAngles(lm: Landmark[]): { name: string; deg: number }[] {
  if (!lm?.length) return []
  return [
    { name: "left_knee", deg: angle2d(get(lm, 23), get(lm, 25), get(lm, 27)) },
    { name: "right_knee", deg: angle2d(get(lm, 24), get(lm, 26), get(lm, 28)) },
    { name: "left_elbow", deg: angle2d(get(lm, 11), get(lm, 13), get(lm, 15)) },
    { name: "right_elbow", deg: angle2d(get(lm, 12), get(lm, 14), get(lm, 16)) },
    { name: "left_hip", deg: angle2d(get(lm, 11), get(lm, 23), get(lm, 25)) },
    { name: "right_hip", deg: angle2d(get(lm, 12), get(lm, 24), get(lm, 26)) },
    { name: "left_shoulder", deg: angle2d(get(lm, 23), get(lm, 11), get(lm, 13)) },
    { name: "right_shoulder", deg: angle2d(get(lm, 24), get(lm, 12), get(lm, 14)) },
  ].map((a) => ({ name: a.name, deg: Math.round(a.deg) }))
}

const MIN_GAP_MS = 2000
let lastCallAt = -Infinity
let inflight = false

/**
 * Throttled call into the score-pose route. Returns null when:
 *   - called too soon since the previous call (throttling)
 *   - already a request in flight
 *   - the network call fails or returns a non-200
 * Callers should treat null as "fall back to the local generic scorer".
 */
export async function analyzeFormAi(
  lm: Landmark[],
  ctx: AiFallbackContext
): Promise<AiFallbackResult | null> {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now()
  if (inflight || now - lastCallAt < MIN_GAP_MS) return null
  lastCallAt = now
  inflight = true
  try {
    const payload = {
      exerciseName: ctx.exerciseName,
      angles: summarizeAngles(lm),
      prevAngles: ctx.prevLandmarks ? summarizeAngles(ctx.prevLandmarks) : undefined,
      loadKg: ctx.loadKg,
      bodyWeightKg: ctx.bodyWeightKg,
    }
    const res = await fetch("/api/ai-coach/score-pose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<AiFallbackResult>
    if (typeof data.score !== "number") return null
    return {
      score: data.score,
      isGoodForm: Boolean(data.isGoodForm),
      feedback: Array.isArray(data.feedback) ? data.feedback : [],
      faultRegions: Array.isArray(data.faultRegions) ? data.faultRegions : [],
    }
  } catch {
    return null
  } finally {
    inflight = false
  }
}

export function _resetAiFallbackThrottleForTests(): void {
  lastCallAt = -Infinity
  inflight = false
}
