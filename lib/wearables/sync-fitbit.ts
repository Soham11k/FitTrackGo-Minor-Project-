import type { SupabaseClient } from "@supabase/supabase-js"
import { fitbitApiGet, refreshFitbitToken, type FitbitTokenResponse } from "@/lib/wearables/fitbit"
import { extractSpo2Summary, extractSpo2Summaries } from "@/lib/wearables/fitbit-live"

export type WearableConnectionRow = {
  id: string
  user_id: string
  provider: string
  external_user_id: string | null
  access_token: string
  refresh_token: string
  token_expires_at: string
  scopes: string
  last_sync_at: string | null
}

type DailyHeart = {
  "activities-heart"?: Array<{
    dateTime?: string
    value?: { restingHeartRate?: number }
  }>
}

function expiresAtMs(tokens: FitbitTokenResponse): string {
  const sec = tokens.expires_in ?? 28800
  return new Date(Date.now() + sec * 1000).toISOString()
}

export async function getFitbitConnection(
  admin: SupabaseClient,
  userId: string
): Promise<WearableConnectionRow | null> {
  const { data, error } = await admin
    .from("wearable_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "fitbit")
    .maybeSingle()
  if (error || !data) return null
  return data as WearableConnectionRow
}

export async function persistTokens(
  admin: SupabaseClient,
  userId: string,
  tokens: FitbitTokenResponse,
  externalUserId: string | null,
  existingRefresh?: string
): Promise<void> {
  const refresh = tokens.refresh_token || existingRefresh
  if (!refresh) throw new Error("Missing refresh token")
  const row = {
    user_id: userId,
    provider: "fitbit" as const,
    external_user_id: externalUserId,
    access_token: tokens.access_token,
    refresh_token: refresh,
    token_expires_at: expiresAtMs(tokens),
    scopes: tokens.scope ?? "",
    updated_at: new Date().toISOString(),
  }
  const { error } = await admin.from("wearable_connections").upsert(row, {
    onConflict: "user_id,provider",
  })
  if (error) throw error
}

export async function getValidFitbitAccessToken(
  admin: SupabaseClient,
  conn: WearableConnectionRow
): Promise<string> {
  const exp = new Date(conn.token_expires_at).getTime()
  if (Date.now() < exp - 120_000) return conn.access_token

  const tokens = await refreshFitbitToken(conn.refresh_token)
  await persistTokens(admin, conn.user_id, tokens, conn.external_user_id, conn.refresh_token)
  return tokens.access_token
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addUtcDays(d: Date, delta: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + delta)
  return x
}

function isYmdInLastNDaysUTC(dateStr: string, now: Date, n: number): boolean {
  for (let i = 0; i < n; i++) {
    if (ymd(addUtcDays(now, -i)) === dateStr) return true
  }
  return false
}

export async function mergeDailyMetric(
  admin: SupabaseClient,
  userId: string,
  metricDate: string,
  patch: {
    resting_heart_rate?: number | null
    spo2_avg_pct?: number | null
    spo2_min_pct?: number | null
    spo2_max_pct?: number | null
  }
): Promise<void> {
  const { error } = await admin.from("wearable_daily_metrics").upsert(
    {
      user_id: userId,
      provider: "fitbit",
      metric_date: metricDate,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider,metric_date" }
  )
  if (error) throw error
}

export async function syncFitbitForUser(
  admin: SupabaseClient,
  userId: string
): Promise<{ spo2Days: number; heartSynced: boolean }> {
  let conn = await getFitbitConnection(admin, userId)
  if (!conn) throw new Error("Not connected")

  const access = await getValidFitbitAccessToken(admin, conn)
  conn = (await getFitbitConnection(admin, userId))!

  let spo2Days = 0
  let heartSynced = false
  const now = new Date()
  const endYmd = ymd(now)
  const start30Ymd = ymd(addUtcDays(now, -29))

  try {
    const spRange = await fitbitApiGet<unknown>(
      `/1/user/-/spo2/date/${start30Ymd}/${endYmd}.json`,
      access
    )
    const summaries = extractSpo2Summaries(spRange)
    for (const s of summaries) {
      const metricDate = s.dateTime.slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(metricDate)) continue
      await mergeDailyMetric(admin, userId, metricDate, {
        spo2_avg_pct: s.avg,
        spo2_min_pct: s.min,
        spo2_max_pct: s.max,
      })
      spo2Days += 1
    }
  } catch {
    /* fall back to per-day requests below */
  }

  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    const dateStr = ymd(d)

    // Match fitbit-live: range form first; "today" uses Fitbit account calendar (fixes UTC skew vs server ymd).
    const heartPaths =
      i === 0
        ? [
            "/1/user/-/activities/heart/date/today/today.json",
            "/1/user/-/activities/heart/date/today/1d.json",
            `/1/user/-/activities/heart/date/${dateStr}/${dateStr}.json`,
            `/1/user/-/activities/heart/date/${dateStr}/1d.json`,
          ]
        : [
            `/1/user/-/activities/heart/date/${dateStr}/${dateStr}.json`,
            `/1/user/-/activities/heart/date/${dateStr}/1d.json`,
          ]
    for (const hp of heartPaths) {
      try {
        const hr = await fitbitApiGet<DailyHeart>(hp, access)
        const row = hr["activities-heart"]?.[0]
        const rhr = row?.value?.restingHeartRate
        const rowDate = row?.dateTime?.slice(0, 10)
        if (rhr != null && rhr > 0) {
          const metricDate = rowDate && /^\d{4}-\d{2}-\d{2}$/.test(rowDate) ? rowDate : dateStr
          await mergeDailyMetric(admin, userId, metricDate, { resting_heart_rate: Math.round(rhr) })
          heartSynced = true
          break
        }
      } catch {
        /* try next path */
      }
    }

    if (spo2Days === 0) {
      const spo2Paths =
        i === 0
          ? [`/1/user/-/spo2/date/today.json`, `/1/user/-/spo2/date/${dateStr}.json`]
          : [`/1/user/-/spo2/date/${dateStr}.json`]
      for (const spPath of spo2Paths) {
        try {
          const sp = await fitbitApiGet<unknown>(spPath, access)
          const s = extractSpo2Summary(sp)
          if (s) {
            const metricDate = s.dateTime.slice(0, 10)
            await mergeDailyMetric(admin, userId, metricDate, {
              spo2_avg_pct: s.avg,
              spo2_min_pct: s.min,
              spo2_max_pct: s.max,
            })
            spo2Days += 1
            break
          }
        } catch {
          /* try next spo2 path or day */
        }
      }
    }
  }

  try {
    const series = await fitbitApiGet<DailyHeart>(
      "/1/user/-/activities/heart/date/today/30d.json",
      access
    )
    for (const row of series["activities-heart"] ?? []) {
      const rhr = row?.value?.restingHeartRate
      const dt = row?.dateTime?.slice(0, 10)
      if (rhr == null || rhr <= 0 || !dt || !/^\d{4}-\d{2}-\d{2}$/.test(dt)) continue
      await mergeDailyMetric(admin, userId, dt, { resting_heart_rate: Math.round(rhr) })
      if (isYmdInLastNDaysUTC(dt, now, 7)) heartSynced = true
    }
  } catch {
    /* optional backfill */
  }

  await admin
    .from("wearable_connections")
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", "fitbit")

  return { spo2Days, heartSynced }
}
