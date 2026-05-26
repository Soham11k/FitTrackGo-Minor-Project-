import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { isFitbitConfigured } from "@/lib/wearables/fitbit"
import { syncFitbitForUser } from "@/lib/wearables/sync-fitbit"
import { googleFitAdapter } from "@/lib/wearables/providers/google-fit"
import { rollingLocalDayWindows } from "@/lib/wearables/local-day-windows"
import { syncGoogleFitForUser } from "@/lib/wearables/sync-google-fit"
import type { WearableDayWindow } from "@/lib/wearables/local-day-windows"

function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for")
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip") || "unknown"
}

function parseDayWindows(raw: unknown): WearableDayWindow[] | null {
  if (!Array.isArray(raw)) return null
  const out: WearableDayWindow[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const metricDate = (item as { metricDate?: unknown }).metricDate
    const startMs = (item as { startMs?: unknown }).startMs
    const endMs = (item as { endMs?: unknown }).endMs
    if (typeof metricDate !== "string") return null
    if (typeof startMs !== "number" || typeof endMs !== "number") return null
    out.push({ metricDate, startMs, endMs })
  }
  return out
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const ip = getClientIp(request)

  let body: {
    provider?: string
    googleFitDays?: unknown
  } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    /* default */
  }

  const provider = (body.provider ?? "fitbit").toLowerCase()

  if (provider !== "fitbit" && provider !== "google_fit") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 })
  }

  const rate = await checkRateLimit({
    key: `wearables-sync:${provider}:${user.id}:${ip}`,
    limit: 12,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 })
  }

  if (provider === "fitbit") {
    if (!isFitbitConfigured()) {
      return NextResponse.json({ error: "Fitbit is not configured on the server" }, { status: 503 })
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

  if (!googleFitAdapter.isConfigured()) {
    return NextResponse.json({ error: "Google Fit is not configured on the server" }, { status: 503 })
  }

  const parsed = parseDayWindows(body.googleFitDays)
  const windows = parsed && parsed.length > 0 ? parsed : rollingLocalDayWindows(14)

  try {
    const result = await syncGoogleFitForUser(admin, user.id, windows)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed"
    if (msg.includes("Not connected")) {
      return NextResponse.json({ error: "Google Fit not connected" }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
