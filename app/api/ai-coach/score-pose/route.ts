import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { isOpenAIConfigured, openaiChatJson } from "@/lib/ai-coach/openai-fetch"

/**
 * AI fallback form scorer for exercises that have no FormSpec.
 *
 * Body shape:
 *   {
 *     exerciseName: string
 *     angles: { name: string; deg: number }[]   // current frame joint angles
 *     prevAngles?: { name: string; deg: number }[]  // a frame ~0.5s prior
 *     loadKg?: number
 *     bodyWeightKg?: number
 *   }
 *
 * Returns:
 *   { score: 0..100, isGoodForm: bool, feedback: string[], faultRegions: string[] }
 */
export async function POST(request: Request) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 })
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const subject = user?.id ?? "anon"
  const rate = await checkRateLimit({
    key: `coach-score-pose:${subject}`,
    limit: 8,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 })
  }

  let body: {
    exerciseName?: string
    angles?: { name?: unknown; deg?: unknown }[]
    prevAngles?: { name?: unknown; deg?: unknown }[]
    loadKg?: number
    bodyWeightKg?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const exerciseName = typeof body.exerciseName === "string" ? body.exerciseName.trim() : ""
  if (!exerciseName) return NextResponse.json({ error: "bad_request" }, { status: 400 })

  const cleanAngles = (arr: unknown): { name: string; deg: number }[] => {
    if (!Array.isArray(arr)) return []
    return arr
      .map((row) => {
        if (!row || typeof row !== "object") return null
        const r = row as { name?: unknown; deg?: unknown }
        if (typeof r.name !== "string") return null
        if (typeof r.deg !== "number" || !Number.isFinite(r.deg)) return null
        return { name: r.name, deg: Math.round(r.deg) }
      })
      .filter((v): v is { name: string; deg: number } => Boolean(v))
      .slice(0, 16)
  }

  const angles = cleanAngles(body.angles)
  const prevAngles = cleanAngles(body.prevAngles)
  const loadKg = typeof body.loadKg === "number" && body.loadKg > 0 ? body.loadKg : undefined
  const bodyWeightKg = typeof body.bodyWeightKg === "number" && body.bodyWeightKg > 0 ? body.bodyWeightKg : undefined

  if (angles.length === 0) {
    return NextResponse.json({ error: "no_angles" }, { status: 400 })
  }

  const system = `You are a movement form coach. You receive a short summary of joint angles from a single video frame of a user performing an exercise. Score the form 0-100 based on common faults for that movement. Reply ONLY in JSON with this exact shape:
{"score": number, "isGoodForm": boolean, "feedback": string[], "faultRegions": ("legs"|"arms"|"torso"|"core")[]}.
Keep feedback under 14 words each, imperative voice. Maximum 3 items. faultRegions only lists regions whose feedback fires.`

  const angleLines = angles.map((a) => `- ${a.name}: ${a.deg} degrees`).join("\n")
  const prevLine = prevAngles.length > 0
    ? `Prior frame (~0.5s earlier):\n${prevAngles.map((a) => `- ${a.name}: ${a.deg}`).join("\n")}\n`
    : ""
  const loadLine = loadKg !== undefined ? `External load: ${loadKg} kg.${bodyWeightKg ? ` Body weight: ${bodyWeightKg} kg.` : ""}\n` : ""

  const userMsg = `Exercise: ${exerciseName}\nCurrent joint angles:\n${angleLines}\n${prevLine}${loadLine}`

  let raw: string
  try {
    raw = await openaiChatJson({
      model: "gpt-4o-mini",
      maxTokens: 220,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
    })
  } catch (err) {
    return NextResponse.json({ error: "upstream_error", message: String(err) }, { status: 502 })
  }

  // Best-effort JSON extraction.
  const match = raw.match(/\{[\s\S]*\}$/)
  let parsed: unknown
  try {
    parsed = JSON.parse(match ? match[0] : raw)
  } catch {
    return NextResponse.json({ error: "model_bad_json", raw }, { status: 502 })
  }

  const p = parsed as { score?: unknown; isGoodForm?: unknown; feedback?: unknown; faultRegions?: unknown }
  const score = typeof p.score === "number" ? Math.max(0, Math.min(100, Math.round(p.score))) : 0
  const isGoodForm = typeof p.isGoodForm === "boolean" ? p.isGoodForm : score >= 80
  const feedback = Array.isArray(p.feedback)
    ? p.feedback.filter((s): s is string => typeof s === "string").slice(0, 3)
    : []
  const allowedRegions = new Set(["legs", "arms", "torso", "core"])
  const faultRegions = Array.isArray(p.faultRegions)
    ? (p.faultRegions as unknown[]).filter((s): s is string => typeof s === "string" && allowedRegions.has(s))
    : []

  return NextResponse.json({ score, isGoodForm, feedback, faultRegions })
}
