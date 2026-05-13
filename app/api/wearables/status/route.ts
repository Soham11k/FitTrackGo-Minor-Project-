import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import { getFitbitCallbackUrl, isFitbitConfigured } from "@/lib/wearables/fitbit"

export const runtime = "edge"

export async function GET() {
  const configured = isFitbitConfigured()
  const hasClientId = Boolean(process.env.FITBIT_CLIENT_ID?.trim())
  const hasClientSecret = Boolean(process.env.FITBIT_CLIENT_SECRET?.trim())

  if (!configured) {
    return NextResponse.json({
      fitbit: {
        configured: false,
        connected: false,
        lastSyncAt: null,
        setupError: undefined,
        setup: {
          oauthCallbackUrl: getFitbitCallbackUrl(),
          reason: "missing_keys",
          serverHasClientId: hasClientId,
          serverHasClientSecret: hasClientSecret,
        },
        latest: null,
      },
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

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({
      fitbit: {
        configured: true,
        connected: false,
        lastSyncAt: null,
        setupError:
          "Supabase service role key missing. In .env.local set SUPABASE_SERVICE_ROLE_KEY to the service_role secret from Dashboard → Settings → API, then restart npm run dev.",
        setup: {
          oauthCallbackUrl: getFitbitCallbackUrl(),
          reason: "service_role",
          serverHasClientId: true,
          serverHasClientSecret: true,
        },
        latest: null,
      },
    })
  }

  const { data: conn } = await admin
    .from("wearable_connections")
    .select("last_sync_at")
    .eq("user_id", user.id)
    .eq("provider", "fitbit")
    .maybeSingle()

  const { data: latestRow } = await admin
    .from("wearable_daily_metrics")
    .select("metric_date, resting_heart_rate, spo2_avg_pct")
    .eq("user_id", user.id)
    .eq("provider", "fitbit")
    .order("metric_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  const connected = Boolean(conn)

  return NextResponse.json({
    fitbit: {
      configured: true,
      connected,
      lastSyncAt: (conn as { last_sync_at?: string } | null)?.last_sync_at ?? null,
      setup: {
        oauthCallbackUrl: getFitbitCallbackUrl(),
        serverHasClientId: true,
        serverHasClientSecret: true,
      },
      // Only surface cached metrics while linked; after disconnect avoid showing stale HR/SpO₂.
      latest:
        connected && latestRow
          ? {
              restingHeartRate: latestRow.resting_heart_rate ?? null,
              heartRateDate: latestRow.metric_date ?? null,
              spo2AvgPct: latestRow.spo2_avg_pct != null ? Number(latestRow.spo2_avg_pct) : null,
              spo2Date: latestRow.metric_date ?? null,
            }
          : null,
    },
  })
}
