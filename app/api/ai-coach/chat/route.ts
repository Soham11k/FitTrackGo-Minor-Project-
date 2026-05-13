import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { isOpenAIConfigured, openaiChatJson } from "@/lib/ai-coach/openai-fetch"
import { retrieveRelevantChunks } from "@/lib/ai-coach/retrieve"

export const maxDuration = 30

const MAX_Q = 600

type BreakdownRow = {
  label: string
  value: string
  ok: boolean
  detail?: string
  region?: string
}

type SessionPayload = {
  exerciseName: string
  exerciseId: string
  reps: number
  score: number
  repScores: number[]
  feedback: string[]
  /** Last live form metrics from on-device analysis (labels/values, not video). */
  breakdown?: BreakdownRow[]
  /** Aggregated rep-score stats when multiple reps were recorded. */
  repScoreStats?: { min: number; max: number; avg: number }
  /** Effective reps, verification flags from the session summary card. */
  sessionDna?: {
    effectiveReps: number
    verifiedMovement: boolean
    faceVerifiedSession: boolean
  }
  /** In-app camera/setup cues for this exercise. */
  exerciseTips?: string[]
  /** Current on-device live cue line (mid-session only). */
  liveCue?: string
  /** live = session in progress; completed = post-session summary. */
  sessionPhase?: "live" | "completed"
}

function formatBreakdownForPrompt(rows: BreakdownRow[] | undefined): string | null {
  if (!rows?.length) return null
  const lines = rows.slice(0, 24).map((r) => {
    const status = r.ok ? "ok" : "needs work"
    const tail = [r.detail, r.region ? `region:${r.region}` : null].filter(Boolean).join(" · ")
    return `- ${r.label}: ${r.value} (${status})${tail ? ` — ${tail}` : ""}`
  })
  return `Form breakdown (last frame / simulated metrics):\n${lines.join("\n")}`
}

function formatSessionDnaForPrompt(d: SessionPayload["sessionDna"]): string | null {
  if (!d) return null
  return [
    "Session summary (DNA):",
    `- Effective reps: ${d.effectiveReps.toFixed(1)}`,
    `- Verified movement (consistency gate): ${d.verifiedMovement ? "yes" : "no"}`,
    `- Face verified for reps (enrolled user in frame): ${d.faceVerifiedSession ? "yes" : "no"}`,
  ].join("\n")
}

function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local"
}

/** Lets the client show setup instructions only when the key is missing (key stays server-only). */
export async function GET() {
  return NextResponse.json({ enabled: isOpenAIConfigured() })
}

export async function POST(request: Request) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "Set OPENAI_API_KEY for the server: add it to .env.local and restart the dev server, " +
          "or add it in your host’s environment (e.g. Vercel → Settings → Environment Variables). " +
          "See .env.local.example.",
      },
      { status: 503 }
    )
  }

  const ip = clientIp(request.headers)
  const rate = await checkRateLimit({
    key: `aicoach:${ip}`,
    limit: 12,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many questions. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    )
  }

  let body: { message?: string; session?: SessionPayload }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const message = (body.message ?? "").trim()
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 })
  }
  if (message.length > MAX_Q) {
    return NextResponse.json({ error: "message_too_long" }, { status: 400 })
  }

  const s = body.session
  if (!s || typeof s.exerciseName !== "string" || typeof s.exerciseId !== "string") {
    return NextResponse.json({ error: "session required" }, { status: 400 })
  }

  const chunks = await retrieveRelevantChunks({
    userQuery: `${message} ${s.exerciseName} ${s.exerciseId}`,
    exerciseId: s.exerciseId,
    topK: 6,
  })

  const contextBlock = chunks.length
    ? chunks.map((c, i) => `[${i + 1}] (${c.exerciseId}) ${c.text}`).join("\n")
    : "(No specific snippet retrieved—answer from general fitness knowledge, still no medical advice.)"

  const phase = s.sessionPhase === "live" ? "live" : "completed"
  const liveCueLine =
    s.liveCue && s.liveCue.trim()
      ? `Current live cue (on-device, this moment): "${s.liveCue.trim()}"`
      : null

  const sessionBlock = [
    `Session phase: ${phase === "live" ? "in progress (metrics update as the user moves)" : "completed"}`,
    `Exercise: ${s.exerciseName} (${s.exerciseId})`,
    `Reps: ${s.reps}, overall form score: ${s.score}%`,
    s.repScores?.length ? `Per-rep scores: ${s.repScores.join(", ")}` : null,
    s.repScoreStats
      ? `Rep score stats — min: ${s.repScoreStats.min}%, max: ${s.repScoreStats.max}%, avg: ${s.repScoreStats.avg}%`
      : null,
    s.feedback?.length ? `In-app session feedback lines: ${s.feedback.map((f) => `"${f}"`).join("; ")}` : null,
    formatSessionDnaForPrompt(s.sessionDna),
    formatBreakdownForPrompt(s.breakdown),
    liveCueLine,
    s.exerciseTips?.length
      ? `Exercise setup tips (from app):\n${s.exerciseTips
          .slice(0, 12)
          .map((t) => `- ${t}`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  const systemRules = [
    "- Use the CONTEXT below for anything specific to this app's exercises and camera setup; do not invent app features not listed.",
    "- Use SESSION SUMMARY in full: rep scores, feedback lines, session DNA, form breakdown rows, exercise setup tips, and any current live cue. Tie your answer to those specifics when the user asks how they are doing.",
    "- Never diagnose medical conditions. If injured or in pain, suggest seeing a professional.",
    "- Keep answers under 220 words, plain language, 1–2 short paragraphs or a short bullet list.",
    "- The user's pose and video are processed on their device; you never receive video—only the text/numbers in SESSION SUMMARY and CONTEXT.",
  ]
  if (phase === "live") {
    systemRules.splice(
      2,
      0,
      "- Session is LIVE: scores and breakdown reflect this moment and will change. Give short, actionable cues the user can apply while moving. Do not imply you watched video or a replay.",
    )
  }

  const system = ["You are a concise, supportive fitness coach for the FitTrack Go app.", "Rules:", ...systemRules].join("\n")

  const user = `CONTEXT (retrieved in-app knowledge — prioritize this for tips specific to the exercise and setup):\n${contextBlock}\n\nSESSION SUMMARY:\n${sessionBlock}\n\nQUESTION:\n${message}`

  try {
    const answer = await openaiChatJson({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 500,
    })
    return NextResponse.json({ answer: answer.trim() })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.error("[ai-coach]", m)
    return NextResponse.json(
      { error: "model_error", message: "The AI could not complete this request. Try again in a moment." },
      { status: 502 }
    )
  }
}
