import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { isFitbitConfigured } from "@/lib/wearables/fitbit"
import {
  fetchLatestMinuteHeartRate,
  fetchLatestRestingFromRecentSeries,
  fetchRestingHeartForDate,
  fetchSpo2ForDate,
  previousCalendarDay,
} from "@/lib/wearables/fitbit-live"
import { getFitbitConnection, getValidFitbitAccessToken } from "@/lib/wearables/sync-fitbit"

function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for")
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip") || "unknown"
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const configured = isFitbitConfigured()
  if (!configured) {
    return NextResponse.json({
      ok: true,
      fitbitConfigured: false,
      connected: false,
    })
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
    key: `wearables-live:${user.id}:${ip}`,
    limit: 45,
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
    return NextResponse.json({
      ok: true,
      fitbitConfigured: true,
      connected: false,
      note: "Wearables require server configuration.",
    })
  }

  const conn = await getFitbitConnection(admin, user.id)
  if (!conn) {
    return NextResponse.json({
      ok: true,
      fitbitConfigured: true,
      connected: false,
    })
  }

  const url = new URL(request.url)
  const qDate = url.searchParams.get("date")?.trim()
  const today = qDate && YMD.test(qDate) ? qDate : new Date().toISOString().slice(0, 10)
  const yday = previousCalendarDay(today)

  let access: string
  try {
    access = await getValidFitbitAccessToken(admin, conn)
  } catch {
    return NextResponse.json(
      { ok: false, fitbitConfigured: true, connected: true, error: "Could not refresh Fitbit session" },
      { status: 502 }
    )
  }

  let heartBpm: number | null = null
  let heartAsOf: string | null = null
  let heartSource: string | null = null
  let usedPriorDay = false
  let spo2AvgPct: number | null = null
  let spo2Date: string | null = null
  let spo2Source: string | null = null

  // Heart rate: walk the priority ladder serially (each call can short-circuit).
  async function resolveHeart() {
    const tryIntraday = async (d: "today" | string) => {
      try {
        const intraday = await fetchLatestMinuteHeartRate(access, d)
        if (intraday?.bpm != null) {
          heartBpm = intraday.bpm
          heartAsOf = intraday.asOf
          heartSource = "intraday_1min"
          return true
        }
      } catch (err) {
        console.warn("[wearables/live] intraday lookup failed:", err)
      }
      return false
    }
    const tryResting = async (d: "today" | string) => {
      try {
        const resting = await fetchRestingHeartForDate(access, d)
        if (resting?.bpm != null) {
          heartBpm = resting.bpm
          heartAsOf = resting.asOf
          heartSource = "resting_daily"
          return true
        }
      } catch (err) {
        console.warn("[wearables/live] resting lookup failed:", err)
      }
      return false
    }

    if (await tryIntraday("today")) return
    if (await tryResting("today")) return
    if (await tryIntraday(today)) return
    if (await tryResting(today)) return
    if (await tryIntraday(yday)) {
      usedPriorDay = true
      return
    }
    if (await tryResting(yday)) {
      usedPriorDay = true
      return
    }
    try {
      const series = await fetchLatestRestingFromRecentSeries(access)
      if (series) {
        heartBpm = series.bpm
        heartAsOf = series.asOf
        heartSource = "resting_series"
        usedPriorDay = true
      }
    } catch (err) {
      console.warn("[wearables/live] series lookup failed:", err)
    }
  }

  // SpO₂: simpler 3-day priority ladder.
  async function resolveSpo2() {
    const trySpo2 = async (d: "today" | string) => {
      try {
        const live = await fetchSpo2ForDate(access, d)
        if (live?.avgPct != null) {
          spo2AvgPct = live.avgPct
          spo2Date = live.date
          spo2Source = "live"
          return true
        }
      } catch (err) {
        console.warn("[wearables/live] spo2 lookup failed:", err)
      }
      return false
    }
    if (await trySpo2("today")) return
    if (await trySpo2(today)) return
    if (await trySpo2(yday)) usedPriorDay = true
  }

  // Heart-rate and SpO₂ tracks are independent — run in parallel.
  await Promise.all([resolveHeart(), resolveSpo2()])

  // If either is still missing, fall back to last cached daily metric.
  // Single DB read (not two) with only the columns we need.
  if (heartBpm == null || spo2AvgPct == null) {
    const { data: row } = await admin
      .from("wearable_daily_metrics")
      .select("metric_date, resting_heart_rate, spo2_avg_pct")
      .eq("user_id", user.id)
      .eq("provider", "fitbit")
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (row) {
      if (heartBpm == null && row.resting_heart_rate != null) {
        heartBpm = row.resting_heart_rate
        heartAsOf = row.metric_date ?? null
        heartSource = "cached"
      }
      if (spo2AvgPct == null && row.spo2_avg_pct != null) {
        spo2AvgPct = Number(row.spo2_avg_pct)
        spo2Date = row.metric_date ?? null
        spo2Source = "cached"
      }
    }
  }

  const parts: string[] = []
  if (heartSource && heartSource !== "intraday_1min") {
    parts.push("Live minute HR may be unavailable; using daily resting or last sync.")
  }
  if (heartSource === "resting_series") {
    parts.push("Showing the most recent resting HR Fitbit has published (today may still be processing).")
  }
  if (usedPriorDay && (heartBpm != null || spo2AvgPct != null)) {
    parts.push("Fitbit often finishes “today’s” summary after sync—showing the latest available day where needed.")
  }
  if (heartBpm == null && spo2AvgPct == null) {
    parts.push(
      "No heart or SpO₂ yet: wear the device, open the Fitbit app to sync, then use Profile → Sync now."
    )
  }

  return NextResponse.json({
    ok: true,
    fitbitConfigured: true,
    connected: true,
    heartBpm,
    heartAsOf,
    heartSource,
    spo2AvgPct,
    spo2Date,
    spo2Source,
    note: parts.length ? parts.join(" ") : null,
  })
}
