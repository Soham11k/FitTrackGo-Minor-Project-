/**
 * Provider interface and default implementation for post-set AI clip review.
 * The client samples N frames from the recorded WebM, uploads them (as data URLs
 * in JSON for simplicity) along with rep traces, and the route asks a vision
 * model to produce per-rep feedback.
 */

import { isOpenAIConfigured, openaiVisionChatJson, type VisionContentPart } from "./openai-fetch"

export interface ClipReviewFrame {
  dataUrl: string
  timestampMs: number
}

export interface ClipReviewRequest {
  exerciseId: string
  exerciseName: string
  loadKg?: number
  repCount: number
  /** Compact rep summaries (score 0-100, faults joined). */
  reps: Array<{ index: number; score: number; faults: string[] }>
  frames: ClipReviewFrame[]
}

export interface ClipReviewResult {
  summary: string
  perRepFaults: Array<{ repIndex: number; faults: string[]; score: number }>
  topThreeFixes: string[]
  highlightRepIndex: number
}

export interface ClipReviewProvider {
  scoreClip(req: ClipReviewRequest): Promise<ClipReviewResult>
}

const DEFAULT_SYSTEM = `You are an elite movement coach reviewing a video of a single exercise set. You receive 6-12 still frames evenly spaced through the set, plus a JSON summary of each rep's form score and any flagged faults. Produce a candid, concise post-set review.

Reply ONLY in JSON with this exact shape:
{
  "summary": string,          // 1-2 sentences, plain English, address the lifter
  "perRepFaults": [{"repIndex": number, "faults": string[], "score": number}],
  "topThreeFixes": string[],   // up to 3 imperative cues, ranked by impact
  "highlightRepIndex": number  // 0-based index of the rep worth re-watching (worst rep or PB rep)
}

Keep cues concrete (e.g. "Sit back another inch to reach parallel"). Avoid generic safety language. Never invent reps that weren't in the JSON.`

export const OpenAiVisionProvider: ClipReviewProvider = {
  async scoreClip(req: ClipReviewRequest): Promise<ClipReviewResult> {
    if (!isOpenAIConfigured()) {
      throw new Error("OpenAI not configured")
    }

    const userParts: VisionContentPart[] = []
    userParts.push({
      type: "text",
      text: `Exercise: ${req.exerciseName} (${req.exerciseId})\nLoad: ${req.loadKg ?? "bodyweight"}\nRep summaries: ${JSON.stringify(req.reps)}\n\n${req.frames.length} frames follow, in chronological order.`,
    })
    for (const f of req.frames.slice(0, 12)) {
      userParts.push({
        type: "image_url",
        image_url: { url: f.dataUrl, detail: "low" },
      })
    }

    const raw = await openaiVisionChatJson({
      model: "gpt-4o-mini",
      maxTokens: 600,
      messages: [
        { role: "system", content: DEFAULT_SYSTEM },
        { role: "user", content: userParts },
      ],
    })
    const match = raw.match(/\{[\s\S]*\}$/)
    let parsed: unknown
    try {
      parsed = JSON.parse(match ? match[0] : raw)
    } catch {
      throw new Error(`model_bad_json: ${raw.slice(0, 300)}`)
    }
    return normalize(parsed, req.repCount)
  },
}

export function normalize(parsed: unknown, repCount: number): ClipReviewResult {
  const p = parsed as Partial<ClipReviewResult>
  const summary = typeof p.summary === "string" ? p.summary.trim() : ""
  const perRepFaults = Array.isArray(p.perRepFaults)
    ? (p.perRepFaults as Array<Partial<ClipReviewResult["perRepFaults"][number]>>)
        .map((r) => ({
          repIndex: typeof r?.repIndex === "number" ? Math.max(0, Math.min(repCount - 1, Math.round(r.repIndex))) : 0,
          faults: Array.isArray(r?.faults) ? (r.faults as unknown[]).filter((f): f is string => typeof f === "string").slice(0, 4) : [],
          score: typeof r?.score === "number" ? Math.max(0, Math.min(100, Math.round(r.score))) : 0,
        }))
        .slice(0, repCount)
    : []
  const topThreeFixes = Array.isArray(p.topThreeFixes)
    ? (p.topThreeFixes as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 3)
    : []
  const highlightRepIndex =
    typeof p.highlightRepIndex === "number"
      ? Math.max(0, Math.min(Math.max(0, repCount - 1), Math.round(p.highlightRepIndex)))
      : 0
  return { summary, perRepFaults, topThreeFixes, highlightRepIndex }
}
