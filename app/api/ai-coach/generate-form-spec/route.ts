import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { isOpenAIConfigured } from "@/lib/ai-coach/openai-fetch"
import { generateFormSpecFromDescription } from "@/lib/ai-coach/generate-form-spec"
import type { LoadType } from "@/lib/form-engine/types"
import { hasSpec } from "@/lib/form-engine/registry"

const LOAD_TYPES = new Set<string>(["none", "bodyweight", "external"])

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "Custom exercise generation requires OPENAI_API_KEY on the server (.env.local in dev or host env vars in production).",
      },
      { status: 503 },
    )
  }

  const rate = await checkRateLimit({
    key: `coach-generate-spec:${user.id}`,
    limit: 6,
    windowMs: 10 * 60_000,
  })
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const description = typeof body.description === "string" ? body.description.trim() : ""
  if (!name || name.length > 80) {
    return NextResponse.json({ error: "bad_request", message: "name required (max 80 chars)" }, { status: 400 })
  }
  if (!description || description.length < 12 || description.length > 2000) {
    return NextResponse.json(
      { error: "bad_request", message: "description required (12–2000 chars)" },
      { status: 400 },
    )
  }

  const category = typeof body.category === "string" ? body.category.trim() : undefined
  const loadTypeRaw = typeof body.loadType === "string" ? body.loadType : undefined
  const loadType = loadTypeRaw && LOAD_TYPES.has(loadTypeRaw) ? (loadTypeRaw as LoadType) : undefined
  const similarToSpecId =
    typeof body.similarToSpecId === "string" && hasSpec(body.similarToSpecId) ? body.similarToSpecId : undefined

  try {
    const result = await generateFormSpecFromDescription({
      name,
      description,
      category,
      loadType,
      similarToSpecId,
    })
    return NextResponse.json({
      spec: result.spec,
      specId: result.specId,
      preview: result.preview,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith("validation_failed:")) {
      return NextResponse.json(
        { error: "invalid_spec", message: msg.replace(/^validation_failed:\s*/, "") },
        { status: 422 },
      )
    }
    console.error("[generate-form-spec]", msg)
    return NextResponse.json({ error: "generation_failed", message: msg.slice(0, 400) }, { status: 500 })
  }
}
