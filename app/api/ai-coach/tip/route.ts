import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { isOpenAIConfigured, openaiChatJson } from "@/lib/ai-coach/openai-fetch"
import { buildMidsetTipMessages } from "@/lib/ai-coach/midset-prompt"
import type { ExerciseId } from "@/lib/form-analysis"
import type { RepTracePair } from "@/lib/rep-trace"

/** Short mid-set coaching bursts (cheap model, tight max tokens). */
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
    key: `coach-tip:${subject}`,
    limit: 6,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 })
  }

  let body: {
    exerciseId?: ExerciseId
    exerciseName?: string
    repScores?: number[]
    repTraces?: RepTracePair[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const exerciseId = body.exerciseId
  const exerciseName = typeof body.exerciseName === "string" ? body.exerciseName.trim() : ""
  if (!exerciseId || !exerciseName) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }

  const repScores = Array.isArray(body.repScores) ? body.repScores.filter((n) => typeof n === "number") : []
  const repTraces = Array.isArray(body.repTraces) ? (body.repTraces as RepTracePair[]) : []

  const { system, user: userMsg } = buildMidsetTipMessages({
    exerciseId,
    exerciseName,
    repScores,
    repTraces,
  })

  const raw = await openaiChatJson({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    maxTokens: 96,
  })

  const tip = raw
    .replace(/["']/g, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)[0] ?? raw.trim()

  return NextResponse.json({ tip: tip.slice(0, 220) })
}
