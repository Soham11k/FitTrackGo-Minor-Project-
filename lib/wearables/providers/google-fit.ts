/**
 * Google Fit provider adapter — OAuth + REST calls.
 * Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; ask for the Fitness
 * scope set corresponding to the metrics we normalize into
 * `wearable_daily_metrics`.
 */
import type {
  ProviderDailyMetrics,
  ProviderTokens,
  WearableProviderAdapter,
} from "./types"

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const AGG_URL = "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate"

const SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
  "https://www.googleapis.com/auth/fitness.oxygen_saturation.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
]

export const googleFitAdapter: WearableProviderAdapter = {
  id: "google_fit",
  label: "Google Fit",
  scopes: SCOPES,

  isConfigured: () =>
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,

  authorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES.join(" "),
      state,
    })
    return `${AUTH_URL}?${params.toString()}`
  },

  async exchangeCode(code, redirectUri) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })
    if (!res.ok) throw new Error(`Google Fit token exchange failed: ${res.status}`)
    return toTokens(await res.json())
  },

  async refreshTokens(refreshToken) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
      }),
    })
    if (!res.ok) throw new Error(`Google Fit refresh failed: ${res.status}`)
    const json = await res.json()
    return {
      accessToken: json.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
      scopes: (json.scope as string) ?? "",
    }
  },

  async fetchDailySummary(accessToken, date, bounds?: { startMs: number; endMs: number }): Promise<ProviderDailyMetrics | null> {
    const startMs =
      bounds != null ? bounds.startMs : Date.parse(`${date}T00:00:00.000Z`)
    const endMs = bounds != null ? bounds.endMs : startMs + 24 * 60 * 60 * 1000
    const res = await fetch(AGG_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: "com.google.step_count.delta" },
          { dataTypeName: "com.google.heart_rate.bpm" },
          { dataTypeName: "com.google.oxygen_saturation" },
        ],
        bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    })
    if (!res.ok) {
      console.warn("[google-fit] aggregate failed", res.status)
      return null
    }
    type Bucket = {
      dataset?: Array<{
        dataSourceId?: string
        point?: Array<{
          value?: Array<{ intVal?: number; fpVal?: number }>
        }>
      }>
    }
    const json = (await res.json()) as { bucket?: Bucket[] }
    const bucket = json.bucket?.[0]
    let steps: number | null = null
    let hrSum = 0
    let hrN = 0
    let hrMin = Infinity
    let hrMax = -Infinity
    let spo2Sum = 0
    let spo2N = 0
    let spo2Min = Infinity
    let spo2Max = -Infinity

    for (const ds of bucket?.dataset ?? []) {
      for (const pt of ds.point ?? []) {
        const v = pt.value ?? []
        if (ds.dataSourceId?.includes("step_count")) {
          steps = (steps ?? 0) + (v[0]?.intVal ?? 0)
        } else if (ds.dataSourceId?.includes("heart_rate")) {
          const bpm = v[0]?.fpVal ?? 0
          if (bpm > 0) {
            hrSum += bpm
            hrN += 1
            hrMin = Math.min(hrMin, bpm)
            hrMax = Math.max(hrMax, bpm)
          }
        } else if (ds.dataSourceId?.includes("oxygen_saturation")) {
          const pct = v[0]?.fpVal ?? 0
          if (pct > 0) {
            spo2Sum += pct
            spo2N += 1
            spo2Min = Math.min(spo2Min, pct)
            spo2Max = Math.max(spo2Max, pct)
          }
        }
      }
    }

    return {
      date,
      steps,
      restingHeartRate: hrN ? Math.round(hrMin) : null,
      averageHeartRate: hrN ? Math.round(hrSum / hrN) : null,
      sleepMinutes: null,
      spo2AvgPct: spo2N ? spo2Sum / spo2N : null,
      spo2MinPct: spo2N && Number.isFinite(spo2Min) ? spo2Min : null,
      spo2MaxPct: spo2N && Number.isFinite(spo2Max) ? spo2Max : null,
    }
  },
}

function toTokens(json: {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
}): ProviderTokens {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? "",
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scopes: json.scope ?? "",
  }
}
