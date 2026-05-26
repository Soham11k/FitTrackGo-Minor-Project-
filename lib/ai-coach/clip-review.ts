/**
 * Provider interface and default implementation for post-set AI clip review.
 * The client samples N frames from the recorded WebM, uploads them (as data URLs
 * in JSON for simplicity) along with rep traces, and the route asks a vision
 * model to produce per-rep qualitative feedback.
 */

import { findVariantBySpecId } from "@/lib/coach-exercise-catalog"
import { isOpenAIConfigured, openaiVisionChatJson, type VisionContentPart } from "./openai-fetch"

export interface ClipReviewFrame {
  dataUrl: string
  timestampMs: number
  /** When frames are sampled per-rep, ties stills to rep index 0..N-1. */
  repIndex?: number
}

export interface ClipReviewRequest {
  exerciseId: string
  exerciseName: string
  loadKg?: number
  repCount: number
  /** Compact rep summaries (score 0-100, on-device faults). */
  reps: Array<{ index: number; score: number; faults: string[] }>
  frames: ClipReviewFrame[]
}

export interface RepCoachFeedback {
  repIndex: number
  good: string[]
  improve: string[]
  /** Optional internal reconciliation; not shown prominently in UI. */
  score?: number
}

export interface ClipReviewResult {
  summary: string
  perRep: RepCoachFeedback[]
  topThreeFixes: string[]
  highlightRepIndex: number
  /** @deprecated Derived from perRep.improve for legacy consumers. */
  perRepFaults: Array<{ repIndex: number; faults: string[]; score: number }>
}

export interface ClipReviewProvider {
  scoreClip(req: ClipReviewRequest): Promise<ClipReviewResult>
}

const DEFAULT_SYSTEM = `You are an expert strength coach doing a VIDEO review of one completed set.

You receive still frames (often tagged by rep index) AND JSON per-rep on-device faults/scores from our pose pipeline.

Rules:
• Ground specifics in what you SEE (limb angles, torso, bar path, symmetry, tempo, ROM) OR in logged on-device faults — do not invent details you cannot infer.
• If angle limits visibility, say so briefly instead of hallucinating cues.
• perRep MUST include exactly one entry per rep index 0..N-1 when N reps are logged.
• Each rep needs "good" (1–3 bullets: specific positives) AND "improve" (1–3 bullets: actionable cues). Never return score-only feedback.
• When form is solid, still name 1–2 concrete good details (depth, control, alignment). When form slips, still note 1 good if any (effort, ROM attempt).
• Ban vague praise ("great job"). Tie bullets to frames for that rep or logged faults.
• improve: short imperative cues (max ~8 words). good: short observational positives (max ~10 words).
• score (optional 0–100): internal reconciliation only; prioritize good/improve prose.
• highlightRepIndex: rep needing the biggest technical fix OR strongest teaching moment (0-based).

Output MUST be valid JSON ONLY (no markdown), shape:
{
  "summary": "<2–4 sentences addressing the athlete, name the movement>",
  "perRep": [{"repIndex": number, "good": string[], "improve": string[], "score": number}],
  "topThreeFixes": string[],
  "highlightRepIndex": number
}

topThreeFixes: up to 3 fixes ranked by impact across the WHOLE set.`

function buildCoachExerciseBrief(specId: string): string | null {
  const found = findVariantBySpecId(specId)
  if (!found) return null
  const { family, variant } = found
  const lines = [
    `Movement family: ${family.name}`,
    `Variant cues: ${variant.description}`,
    variant.cameraNote ? `Camera: ${variant.cameraNote}` : null,
    variant.tips?.length ? `Programming tips: ${variant.tips.slice(0, 4).join(" · ")}` : null,
  ].filter(Boolean) as string[]
  return lines.join("\n")
}

function formatRepsLines(reps: ClipReviewRequest["reps"], repCount: number): string {
  const rows = reps
    .filter((r) => typeof r.index === "number" && r.index >= 0 && r.index < repCount)
    .sort((a, b) => a.index - b.index)
    .slice(0, repCount)
  if (rows.length === 0) {
    return `Rep indices are 0 … ${Math.max(0, repCount - 1)}; no structured rep rows supplied — infer from visuals only where needed.`
  }
  return rows
    .map((r) => {
      const fx = Array.isArray(r.faults) && r.faults.length ? r.faults.join("; ") : "none logged"
      return `Rep ${r.index}: on-device faults (${fx})` + (typeof r.score === "number" ? ` · pose score ${r.score}` : "")
    })
    .join("\n")
}

function formatFramesLines(frames: ClipReviewFrame[]): string {
  if (!frames.length) return "No frames supplied."
  const byRep = new Map<number, number>()
  const untagged: number[] = []
  frames.forEach((f, i) => {
    if (typeof f.repIndex === "number" && f.repIndex >= 0) {
      byRep.set(f.repIndex, (byRep.get(f.repIndex) ?? 0) + 1)
    } else {
      untagged.push(i + 1)
    }
  })
  const lines: string[] = []
  if (byRep.size > 0) {
    lines.push("Frames grouped by rep (image order follows text, then images):")
    for (const [rep, count] of [...byRep.entries()].sort((a, b) => a[0] - b[0])) {
      lines.push(`  Rep ${rep}: ${count} still(s)`)
    }
  }
  if (untagged.length) {
    lines.push(`Additional chronological stills (no rep tag): positions ${untagged.join(", ")}`)
  }
  return lines.join("\n")
}

function buildClipReviewUserText(req: ClipReviewRequest, frameSlice: ClipReviewFrame[]): string {
  const brief = buildCoachExerciseBrief(req.exerciseId)
  const load = typeof req.loadKg === "number" && Number.isFinite(req.loadKg) ? `${req.loadKg} kg` : "bodyweight / not specified"

  return [
    `Exercise display name: ${req.exerciseName}`,
    `FormSpec / id: ${req.exerciseId}`,
    `Recorded load label: ${load}`,
    brief ? `\nCoach catalog hints for this variation:\n${brief}` : "",
    `\nOfficial rep count N = ${Math.max(1, req.repCount)}. On-device rep summaries (0-based index):`,
    formatRepsLines(req.reps, Math.max(1, req.repCount)),
    `\n${formatFramesLines(frameSlice)}`,
    `\nYou have ${frameSlice.length} still images attached after this text (respect repIndex tags when present).`,
    "\nProduce the JSON object now.",
  ]
    .filter(Boolean)
    .join("\n")
}

/** Key frames get higher fidelity to read joint angles despite low-res clips. */
function frameNeedsHighDetail(idx: number, total: number): boolean {
  if (total <= 4) return true
  if (idx === 0 || idx === total - 1) return true
  const mid = Math.floor(total / 2)
  return idx === mid
}

function coerceStringList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[])
    .filter((s): s is string => typeof s === "string" && !!s.trim())
    .map((s) => s.trim())
    .slice(0, max)
}

function coerceRepFeedback(
  r: Partial<RepCoachFeedback> | undefined,
  safeN: number,
): RepCoachFeedback | null {
  if (!r || typeof r.repIndex !== "number") return null
  const repIndex = Math.max(0, Math.min(safeN - 1, Math.round(r.repIndex)))
  const good = coerceStringList(r.good, 3)
  const improve = coerceStringList(r.improve, 3)
  const score =
    typeof r.score === "number" ? Math.max(0, Math.min(100, Math.round(r.score))) : undefined
  return { repIndex, good, improve, score }
}

export function perRepToLegacyFaults(perRep: RepCoachFeedback[]): ClipReviewResult["perRepFaults"] {
  return perRep.map((r) => ({
    repIndex: r.repIndex,
    faults: r.improve,
    score: r.score ?? 0,
  }))
}

/** Upgrade cached / persisted JSON to the current result shape. */
export function migrateClipReviewResult(raw: unknown, repCount?: number): ClipReviewResult | null {
  if (!raw || typeof raw !== "object") return null
  const n =
    typeof repCount === "number" && repCount > 0
      ? repCount
      : Math.max(
          1,
          Array.isArray((raw as { perRep?: unknown }).perRep)
            ? (raw as { perRep: unknown[] }).perRep.length
            : Array.isArray((raw as { perRepFaults?: unknown }).perRepFaults)
              ? (raw as { perRepFaults: unknown[] }).perRepFaults.length
              : 1,
        )
  return normalize(raw, n)
}

/**
 * GPT-vision often replies with ```json ... ``` despite "ONLY JSON"; parse defensively.
 * Exported for unit tests only.
 */
export function parseVisionModelJsonPayload(raw: string): unknown {
  const trimmed = raw.trim()
  const fencedOuter =
    trimmed.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/im) ??
    trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/im)
  let candidate = fencedOuter ? fencedOuter[1].trim() : trimmed

  if (candidate.startsWith("```")) {
    candidate = candidate.replace(/^```(?:json)?\s*\r?\n?/im, "").replace(/\r?\n?```[\s\S]*$/m, "").trim()
  }

  try {
    return JSON.parse(candidate)
  } catch {
    const open = candidate.indexOf("{")
    const close = candidate.lastIndexOf("}")
    if (open === -1 || close <= open) {
      throw new Error(`model_bad_json: ${raw.slice(0, 320)}`)
    }
    return JSON.parse(candidate.slice(open, close + 1))
  }
}

export const OpenAiVisionProvider: ClipReviewProvider = {
  async scoreClip(req: ClipReviewRequest): Promise<ClipReviewResult> {
    if (!isOpenAIConfigured()) {
      throw new Error("OpenAI not configured")
    }

    const slices = req.frames.slice(0, 14)
    const userParts: VisionContentPart[] = []
    userParts.push({
      type: "text",
      text: buildClipReviewUserText(req, slices),
    })
    const total = slices.length
    for (let i = 0; i < slices.length; i++) {
      const f = slices[i]!
      userParts.push({
        type: "image_url",
        image_url: { url: f.dataUrl, detail: frameNeedsHighDetail(i, total) ? "high" : "low" },
      })
    }

    const raw = await openaiVisionChatJson({
      model: "gpt-4o-mini",
      maxTokens: 1400,
      temperature: 0.35,
      responseFormatJson: true,
      messages: [
        { role: "system", content: DEFAULT_SYSTEM },
        { role: "user", content: userParts },
      ],
    })
    let parsed: unknown
    try {
      parsed = parseVisionModelJsonPayload(raw)
    } catch {
      throw new Error(`model_bad_json: ${raw.slice(0, 300)}`)
    }
    return normalize(parsed, req.repCount)
  },
}

export function normalize(parsed: unknown, repCount: number): ClipReviewResult {
  const safeN = Math.max(1, repCount)
  const p = parsed as Record<string, unknown>
  const summary = typeof p.summary === "string" ? p.summary.trim() : ""

  let perRep: RepCoachFeedback[] = []

  if (Array.isArray(p.perRep)) {
    perRep = (p.perRep as Array<Partial<RepCoachFeedback>>)
      .map((r) => coerceRepFeedback(r, safeN))
      .filter((r): r is RepCoachFeedback => r !== null)
      .sort((a, b) => a.repIndex - b.repIndex)
  }

  if (perRep.length === 0 && Array.isArray(p.perRepFaults)) {
    perRep = (p.perRepFaults as Array<{ repIndex?: number; faults?: unknown; score?: number }>)
      .map((r) =>
        coerceRepFeedback(
          {
            repIndex: r.repIndex,
            improve: coerceStringList(r.faults, 6),
            good: [],
            score: r.score,
          },
          safeN,
        ),
      )
      .filter((r): r is RepCoachFeedback => r !== null)
      .sort((a, b) => a.repIndex - b.repIndex)
  }

  // Fill missing indices with empty shells so UI always has N rows
  const byIndex = new Map(perRep.map((r) => [r.repIndex, r]))
  perRep = Array.from({ length: safeN }, (_, i) => {
    const existing = byIndex.get(i)
    return (
      existing ?? {
        repIndex: i,
        good: [],
        improve: [],
      }
    )
  })

  const topThreeFixes = coerceStringList(p.topThreeFixes, 3)
  const highlightRepIndex =
    typeof p.highlightRepIndex === "number"
      ? Math.max(0, Math.min(safeN - 1, Math.round(p.highlightRepIndex)))
      : 0

  return {
    summary,
    perRep,
    topThreeFixes,
    highlightRepIndex,
    perRepFaults: perRepToLegacyFaults(perRep),
  }
}
