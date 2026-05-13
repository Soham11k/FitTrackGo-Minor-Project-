import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { OpenAiVisionProvider, type ClipReviewFrame, type ClipReviewRequest } from "@/lib/ai-coach/clip-review"

/**
 * Post-set AI clip review. Body shape:
 *   {
 *     sessionId: string,
 *     exerciseId: string,
 *     exerciseName: string,
 *     loadKg?: number,
 *     reps: { index, score, faults[] }[],
 *     frames: { dataUrl, timestampMs }[]  // 3-40, JPEG/PNG data URLs
 *   }
 *
 * Persists the result to coach_clip_reviews. Returns the review JSON.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const rate = await checkRateLimit({
    key: `coach-review-clip:${user.id}`,
    limit: 4,
    windowMs: 5 * 60_000,
  })
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 })
  }

  let body: Partial<ClipReviewRequest> & { sessionId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
  const exerciseId = typeof body.exerciseId === "string" ? body.exerciseId : ""
  const exerciseName = typeof body.exerciseName === "string" ? body.exerciseName : ""
  if (!sessionId || !exerciseId || !exerciseName) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }
  const frames = Array.isArray(body.frames) ? (body.frames as ClipReviewFrame[]) : []
  if (frames.length < 3) {
    return NextResponse.json({ error: "too_few_frames" }, { status: 400 })
  }
  if (frames.length > 40) frames.length = 40
  // Reject very large data URLs (e.g. > 350KB each) to keep payloads bounded.
  for (const f of frames) {
    if (typeof f.dataUrl !== "string" || !f.dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "bad_frame" }, { status: 400 })
    }
    if (f.dataUrl.length > 350_000) {
      return NextResponse.json({ error: "frame_too_large" }, { status: 400 })
    }
  }

  const repCount = Math.max(1, Math.round(typeof body.repCount === "number" ? body.repCount : 1))
  const reps = Array.isArray(body.reps) ? body.reps : []

  try {
    const result = await OpenAiVisionProvider.scoreClip({
      exerciseId,
      exerciseName,
      loadKg: typeof body.loadKg === "number" ? body.loadKg : undefined,
      repCount,
      reps,
      frames,
    })

    // Best-effort persistence — non-fatal if the table doesn't exist yet.
    try {
      await supabase
        .from("coach_clip_reviews")
        .upsert({
          session_id: sessionId,
          user_id: user.id,
          summary: result.summary,
          result,
        })
    } catch (e) {
      console.warn("[review-clip] persist failed:", e)
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: "upstream_error", message: String(err) }, { status: 502 })
  }
}
