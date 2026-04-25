/**
 * Fitbit provider adapter. This is a thin shim over the existing
 * `lib/wearables/fitbit*.ts` modules. When we migrate the live/sync routes
 * to use the adapter interface, we can delete the raw callers.
 */
import type {
  ProviderDailyMetrics,
  ProviderTokens,
  WearableProviderAdapter,
} from "./types"
import { isFitbitConfigured } from "../fitbit"

const AUTH_URL = "https://www.fitbit.com/oauth2/authorize"
const TOKEN_URL = "https://api.fitbit.com/oauth2/token"
const API_BASE = "https://api.fitbit.com/1/user/-"

const DEFAULT_SCOPES = ["activity", "heartrate", "oxygen_saturation", "profile", "sleep"]

export const fitbitAdapter: WearableProviderAdapter = {
  id: "fitbit",
  label: "Fitbit",
  scopes: DEFAULT_SCOPES,

  isConfigured: () => isFitbitConfigured(),

  authorizeUrl(state, redirectUri) {
    const clientId = process.env.FITBIT_CLIENT_ID ?? ""
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: DEFAULT_SCOPES.join(" "),
      redirect_uri: redirectUri,
      state,
    })
    return `${AUTH_URL}?${params.toString()}`
  },

  async exchangeCode(code, redirectUri) {
    return tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    })
  },

  async refreshTokens(refreshToken) {
    return tokenRequest({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  },

  async fetchDailySummary(accessToken, date): Promise<ProviderDailyMetrics | null> {
    const headers = { Authorization: `Bearer ${accessToken}` }
    const [activityRes, hrRes, sleepRes, spo2Res] = await Promise.all([
      fetch(`${API_BASE}/activities/date/${date}.json`, { headers }),
      fetch(`${API_BASE}/activities/heart/date/${date}/1d.json`, { headers }),
      fetch(`${API_BASE}/sleep/date/${date}.json`, { headers }),
      fetch(`${API_BASE}/spo2/date/${date}.json`, { headers }),
    ])

    type ActivityResp = { summary?: { steps?: number } }
    type HeartResp = {
      "activities-heart"?: Array<{ value?: { restingHeartRate?: number; heartRateZones?: Array<{ caloriesOut?: number }> } }>
    }
    type SleepResp = { summary?: { totalMinutesAsleep?: number } }
    type Spo2Resp = {
      value?: { avg?: number; min?: number; max?: number }
    }

    const activity = activityRes.ok ? ((await activityRes.json()) as ActivityResp) : null
    const hr = hrRes.ok ? ((await hrRes.json()) as HeartResp) : null
    const sleep = sleepRes.ok ? ((await sleepRes.json()) as SleepResp) : null
    const spo2 = spo2Res.ok ? ((await spo2Res.json()) as Spo2Resp) : null

    return {
      date,
      steps: activity?.summary?.steps ?? null,
      restingHeartRate: hr?.["activities-heart"]?.[0]?.value?.restingHeartRate ?? null,
      averageHeartRate: null,
      sleepMinutes: sleep?.summary?.totalMinutesAsleep ?? null,
      spo2AvgPct: spo2?.value?.avg ?? null,
      spo2MinPct: spo2?.value?.min ?? null,
      spo2MaxPct: spo2?.value?.max ?? null,
      extra: {},
    }
  },
}

async function tokenRequest(form: Record<string, string>): Promise<ProviderTokens> {
  const clientId = process.env.FITBIT_CLIENT_ID ?? ""
  const clientSecret = process.env.FITBIT_CLIENT_SECRET ?? ""
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const body = new URLSearchParams(form)
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`Fitbit token request failed: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    scope: string
    user_id?: string
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scopes: json.scope ?? "",
    externalUserId: json.user_id ?? null,
  }
}
