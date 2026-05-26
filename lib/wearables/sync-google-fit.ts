import type { SupabaseClient } from "@supabase/supabase-js"
import { googleFitAdapter } from "@/lib/wearables/providers/google-fit"
import type { WearableDayWindow } from "@/lib/wearables/local-day-windows"

export type GoogleFitConnectionRow = {
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

export async function getGoogleFitConnection(
  admin: SupabaseClient,
  userId: string
): Promise<GoogleFitConnectionRow | null> {
  const { data, error } = await admin
    .from("wearable_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google_fit")
    .maybeSingle()
  if (error || !data) return null
  return data as GoogleFitConnectionRow
}

export async function getValidGoogleFitAccessToken(
  admin: SupabaseClient,
  conn: GoogleFitConnectionRow
): Promise<string> {
  const exp = new Date(conn.token_expires_at).getTime()
  if (Number.isFinite(exp) && Date.now() < exp - 120_000) {
    return conn.access_token
  }
  const tokens = await googleFitAdapter.refreshTokens(conn.refresh_token)
  const refresh = tokens.refreshToken || conn.refresh_token
  const { error } = await admin
    .from("wearable_connections")
    .update({
      access_token: tokens.accessToken,
      refresh_token: refresh,
      token_expires_at: tokens.expiresAt,
      scopes: tokens.scopes || conn.scopes,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", conn.user_id)
    .eq("provider", "google_fit")
  if (error) throw error
  return tokens.accessToken
}

async function persistGoogleFitDaily(
  admin: SupabaseClient,
  userId: string,
  metricDate: string,
  row: {
    steps: number | null
    resting_heart_rate: number | null
    avg_hr: number | null
    sleep_min: number | null
    spo2_avg_pct: number | null
    spo2_min_pct: number | null
    spo2_max_pct: number | null
  }
): Promise<void> {
  const { error } = await admin.from("wearable_daily_metrics").upsert(
    {
      user_id: userId,
      provider: "google_fit",
      metric_date: metricDate,
      ...row,
      source: "google_fit_api",
      ingested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider,metric_date" }
  )
  if (error) throw error
}

/** ~0.04 kcal/step — rough Active Energy analogue for Move ring (not medically precise). */
export function stepsToMoveCalories(steps: number): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0
  return Math.min(Math.round(steps * 0.045), 2000)
}

export async function syncGoogleFitForUser(
  admin: SupabaseClient,
  userId: string,
  windowsInput: WearableDayWindow[]
): Promise<{ daysWritten: number; lastMetricDate: string | null }> {
  let conn = await getGoogleFitConnection(admin, userId)
  if (!conn) throw new Error("Not connected")

  let access = await getValidGoogleFitAccessToken(admin, conn)
  conn = (await getGoogleFitConnection(admin, userId))!

  let daysWritten = 0
  let lastMetricDate: string | null = null

  for (const win of windowsInput) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(win.metricDate)) continue
    if (!Number.isFinite(win.startMs) || !Number.isFinite(win.endMs) || win.endMs <= win.startMs) continue
    if (win.endMs - win.startMs > 36 * 60 * 60 * 1000) continue

    let summary = await googleFitAdapter.fetchDailySummary(access, win.metricDate, {
      startMs: win.startMs,
      endMs: win.endMs,
    })
    // Token may have expired mid-loop — refresh once and retry this window.
    if (!summary) {
      try {
        access = await getValidGoogleFitAccessToken(admin, conn)
        conn = (await getGoogleFitConnection(admin, userId))!
        summary = await googleFitAdapter.fetchDailySummary(access, win.metricDate, {
          startMs: win.startMs,
          endMs: win.endMs,
        })
      } catch {
        /* fall through — skip day */
      }
    }
    if (!summary) continue

    const hasData =
      (summary.steps != null && summary.steps > 0) ||
      summary.restingHeartRate != null ||
      summary.averageHeartRate != null ||
      summary.spo2AvgPct != null ||
      summary.sleepMinutes != null

    if (!hasData) continue

    await persistGoogleFitDaily(admin, userId, win.metricDate, {
      steps: summary.steps ?? null,
      resting_heart_rate: summary.restingHeartRate ?? null,
      avg_hr: summary.averageHeartRate ?? null,
      sleep_min: summary.sleepMinutes ?? null,
      spo2_avg_pct: summary.spo2AvgPct ?? null,
      spo2_min_pct: summary.spo2MinPct ?? null,
      spo2_max_pct: summary.spo2MaxPct ?? null,
    })
    daysWritten += 1
    lastMetricDate = win.metricDate
  }

  await admin
    .from("wearable_connections")
    .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", "google_fit")

  return { daysWritten, lastMetricDate }
}
