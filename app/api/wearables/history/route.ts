import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { isFitbitConfigured } from "@/lib/wearables/fitbit"
import { getFitbitConnection } from "@/lib/wearables/sync-fitbit"

function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for")
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip") || "unknown"
}

const LIMIT_MAX = 90

export async function GET(request: Request) {
  if (!isFitbitConfigured()) {
    return NextResponse.json({ ok: true, fitbitConfigured: false, rows: [] as unknown[] })
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
    key: `wearables-history:${user.id}:${ip}`,
    limit: 30,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(Math.ceil((rate.resetAt - Date.now()) / 1000), 1)),
        },
      }
    )
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: true, fitbitConfigured: true, connected: false, rows: [] })
  }

  const conn = await getFitbitConnection(admin, user.id)
  if (!conn) {
    return NextResponse.json({ ok: true, fitbitConfigured: true, connected: false, rows: [] })
  }

  const url = new URL(request.url)
  const rawLimit = Number(url.searchParams.get("limit") ?? "30")
  const limit = Number.isFinite(rawLimit) ? Math.min(LIMIT_MAX, Math.max(1, Math.floor(rawLimit))) : 30

  const { data: rows, error: qErr } = await admin
    .from("wearable_daily_metrics")
    .select("metric_date, resting_heart_rate, spo2_avg_pct, spo2_min_pct, spo2_max_pct")
    .eq("user_id", user.id)
    .eq("provider", "fitbit")
    .order("metric_date", { ascending: false })
    .limit(limit)

  if (qErr) {
    return NextResponse.json({ error: "Could not load history" }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    fitbitConfigured: true,
    connected: true,
    rows: rows ?? [],
  })
}
