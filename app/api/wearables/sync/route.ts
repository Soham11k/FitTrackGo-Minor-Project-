import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { isFitbitConfigured } from "@/lib/wearables/fitbit"
import { syncFitbitForUser } from "@/lib/wearables/sync-fitbit"

function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for")
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip") || "unknown"
}

export async function POST(request: Request) {
  if (!isFitbitConfigured()) {
    return NextResponse.json({ error: "Fitbit is not configured on the server" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const ip = getClientIp(request)
  const rate = await checkRateLimit({
    key: `wearables-sync:${user.id}:${ip}`,
    limit: 12,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  let body: { provider?: string } = {}
  try {
    body = (await request.json()) as { provider?: string }
  } catch {
    /* default */
  }
  if (body.provider && body.provider !== "fitbit") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 })
  }

  try {
    const result = await syncFitbitForUser(admin, user.id)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed"
    if (msg.includes("Not connected")) {
      return NextResponse.json({ error: "Fitbit not connected" }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
