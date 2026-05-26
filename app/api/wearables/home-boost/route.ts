import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { stepsToMoveCalories } from "@/lib/wearables/sync-google-fit"

const YMD = /^\d{4}-\d{2}-\d{2}$/

function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for")
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip") || "unknown"
}

/**
 * Home tab: Google Fit steps stored in `wearable_daily_metrics` → Move ring bump (~kcal from steps).
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })
  }

  const ip = getClientIp(request)
  const rate = await checkRateLimit({
    key: `wearables-home-boost:${user.id}:${ip}`,
    limit: 60,
    windowMs: 60_000,
  })
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const url = new URL(request.url)
  const localToday = url.searchParams.get("localToday")?.trim() ?? ""

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: true, googleFitSteps: null, moveCalBump: 0 })
  }

  const db = admin

  const todayOk = localToday.length > 0 && YMD.test(localToday)

  async function lookup(d: string) {
    const { data: row } = await db
      .from("wearable_daily_metrics")
      .select("steps, metric_date")
      .eq("user_id", user.id)
      .eq("provider", "google_fit")
      .eq("metric_date", d)
      .maybeSingle()
    const steps =
      row?.steps != null && Number(row.steps) > 0 ? Math.round(Number(row.steps)) : null
    return { steps, metric_date: row?.metric_date ?? d }
  }

  let metricDate: string | null = null

  let steps: number | null = null
  if (todayOk) {
    const r = await lookup(localToday)
    steps = r.steps
    metricDate = steps != null ? r.metric_date ?? localToday : null
  }

  // If today's row is missing, try rolling back a day (timezone / partial-sync skew).
  if (steps == null && todayOk) {
    try {
      const d = new Date(`${localToday}T12:00:00`)
      d.setDate(d.getDate() - 1)
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      const r = await lookup(ymd)
      if (r.steps != null) {
        steps = r.steps
        metricDate = r.metric_date ?? ymd
      }
    } catch {
      /* ignore */
    }
  }

  const moveCalBump = stepsToMoveCalories(steps ?? 0)

  return NextResponse.json({
    ok: true,
    googleFitSteps: steps,
    /** Active-energy style bump added to logged in-app calorie burn */
    moveCalBump,
    metricDate,
  })
}
