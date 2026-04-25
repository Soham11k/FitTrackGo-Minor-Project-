import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { checkRateLimit } from "@/lib/rate-limit"

/**
 * Store or update a Web Push subscription for the authenticated user.
 * Payload: { endpoint, keys: { p256dh, auth } }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const rate = await checkRateLimit({
    key: `push:subscribe:${user.id}`,
    limit: 10,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  let body: {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const endpoint = body.endpoint?.trim()
  const p256dh = body.keys?.p256dh?.trim()
  const auth = body.keys?.auth?.trim()
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Missing subscription fields" }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { error: "Push is not configured on this environment" },
      { status: 503 }
    )
  }

  const userAgent = request.headers.get("user-agent") ?? null

  const { error: upsertError } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
    },
    { onConflict: "user_id,endpoint" }
  )

  if (upsertError) {
    console.error("[push/subscribe] upsert failed:", upsertError)
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })

  const admin = createServiceRoleClient()
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)

  return NextResponse.json({ ok: true })
}
