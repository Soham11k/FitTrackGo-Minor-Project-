import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import { getFitbitCallbackUrl, isFitbitConfigured } from "@/lib/wearables/fitbit"
import { googleFitAdapter } from "@/lib/wearables/providers/google-fit"
import { getAdapter } from "@/lib/wearables/providers"
import { ALL_PROVIDER_IDS, type ProviderId } from "@/lib/wearables/providers/types"
import { wearableOAuthCallbackUrl } from "@/lib/wearables/app-origin"

export const runtime = "edge"

function googleConfigured(): boolean {
  return googleFitAdapter.isConfigured()
}

async function latestMetricForProvider(
  admin: NonNullable<Awaited<ReturnType<typeof createServiceRoleClient>>>,
  userId: string,
  provider: ProviderId
) {
  const { data: latestRow } = await admin
    .from("wearable_daily_metrics")
    .select("metric_date, resting_heart_rate, spo2_avg_pct, steps, avg_hr")
    .eq("user_id", userId)
    .eq("provider", provider)
    .order("metric_date", { ascending: false })
    .limit(1)
    .maybeSingle()
  return latestRow
}

export async function GET() {
  const hasClientId = Boolean(process.env.FITBIT_CLIENT_ID?.trim())
  const hasClientSecret = Boolean(process.env.FITBIT_CLIENT_SECRET?.trim())
  const fitbitCfg = isFitbitConfigured()
  const googleCfg = googleConfigured()

  const providersSkeleton: Record<string, Record<string, unknown>> = {}
  for (const id of ALL_PROVIDER_IDS) {
    const adapter = getAdapter(id)!
    let configured = false
    if (id === "fitbit") configured = fitbitCfg
    else if (id === "google_fit") configured = googleCfg
    else if (id === "apple_health") configured = true
    else if (id === "garmin") configured = adapter.isConfigured()

    const oauthSupported = id === "fitbit" || id === "google_fit"
    const importSupported = id === "apple_health"

    providersSkeleton[id] = {
      label: adapter.label,
      configured,
      oauthSupported,
      importSupported,
      garminOAuthReady: false,
      connected: false,
      lastSyncAt: null,
      setup:
        id === "fitbit"
          ? {
              oauthCallbackUrl: getFitbitCallbackUrl(),
              reason: fitbitCfg ? undefined : "missing_keys",
              serverHasClientId: hasClientId,
              serverHasClientSecret: hasClientSecret,
            }
          : id === "google_fit"
            ? {
                oauthCallbackUrl: wearableOAuthCallbackUrl("google_fit"),
                reason: googleCfg ? undefined : "missing_google_oauth",
                serverHasClientId: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
                serverHasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()),
              }
            : id === "garmin"
              ? {
                  oauthCallbackUrl: wearableOAuthCallbackUrl("garmin"),
                  reason: "garmin_oauth_not_implemented",
                }
              : id === "apple_health"
                ? {
                    note: "HealthKit has no web OAuth. Use the iOS app / Capacitor Health plugin to import, or export from Apple Health.",
                  }
                : {},
      latest: null,
    }
  }

  if (!fitbitCfg && !googleCfg) {
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
      providers: providersSkeleton,
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
    const fb = {
      configured: fitbitCfg,
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
    }
    return NextResponse.json({
      fitbit: fitbitCfg ? fb : { ...fb, configured: false },
      providers: providersSkeleton,
    })
  }

  const providers: Record<string, Record<string, unknown>> = {}

  for (const id of ALL_PROVIDER_IDS) {
    const adapter = getAdapter(id)!
    let configured = false
    if (id === "fitbit") configured = fitbitCfg
    else if (id === "google_fit") configured = googleCfg
    else if (id === "apple_health") configured = true
    else if (id === "garmin") configured = adapter.isConfigured()

    const oauthSupported = id === "fitbit" || id === "google_fit"
    const importSupported = id === "apple_health"

    const { data: conn } = await admin
      .from("wearable_connections")
      .select("last_sync_at")
      .eq("user_id", user.id)
      .eq("provider", id)
      .maybeSingle()

    let connected = Boolean(conn)

    if (id === "apple_health" && !connected) {
      const { data: applePeek } = await admin
        .from("wearable_daily_metrics")
        .select("id")
        .eq("user_id", user.id)
        .eq("provider", "apple_health")
        .limit(1)
        .maybeSingle()
      connected = Boolean(applePeek)
    }

    const latestRow = connected ? await latestMetricForProvider(admin, user.id, id) : null

    providers[id] = {
      label: adapter.label,
      configured,
      oauthSupported,
      importSupported,
      garminOAuthReady: false,
      connected,
      lastSyncAt: (conn as { last_sync_at?: string } | null)?.last_sync_at ?? null,
      setup:
        id === "fitbit"
          ? {
              oauthCallbackUrl: getFitbitCallbackUrl(),
              serverHasClientId: true,
              serverHasClientSecret: true,
            }
          : id === "google_fit"
            ? {
                oauthCallbackUrl: wearableOAuthCallbackUrl("google_fit"),
                serverHasClientId: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
                serverHasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()),
              }
            : id === "garmin"
              ? {
                  oauthCallbackUrl: wearableOAuthCallbackUrl("garmin"),
                  reason: "garmin_oauth_not_implemented",
                }
              : id === "apple_health"
                ? {
                    note: "Import HealthKit data from the native app or an Apple Health export.",
                  }
                : {},
      latest:
        connected && latestRow
          ? {
              restingHeartRate: latestRow.resting_heart_rate ?? null,
              heartRateDate: latestRow.metric_date ?? null,
              spo2AvgPct: latestRow.spo2_avg_pct != null ? Number(latestRow.spo2_avg_pct) : null,
              spo2Date: latestRow.metric_date ?? null,
              steps: latestRow.steps ?? null,
              avgHr: latestRow.avg_hr ?? null,
            }
          : null,
    }
  }

  const fitbit = providers.fitbit!

  return NextResponse.json({
    fitbit: {
      configured: Boolean(fitbit.configured),
      connected: Boolean(fitbit.connected),
      lastSyncAt: (fitbit.lastSyncAt as string | null) ?? null,
      setupError: undefined,
      setup: fitbit.setup as Record<string, unknown>,
      latest: fitbit.latest,
    },
    providers,
  })
}
