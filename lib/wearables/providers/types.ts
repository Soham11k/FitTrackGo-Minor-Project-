/**
 * Unified wearable-provider interface. Every provider adapter exposes:
 *   - authorizeUrl(state): OAuth init
 *   - exchangeCode(code): redeem code for tokens
 *   - refreshTokens(refreshToken): refresh
 *   - fetchDailySummary(accessToken, date, opts?): normalized metrics
 *   - fetchLive(accessToken): optional current-state snapshot
 *
 * The unified storage schema is `wearable_daily_metrics(user_id, date,
 * provider, steps, resting_hr, avg_hr, sleep_min, spo2*, ...)`.
 */

export type ProviderId = "fitbit" | "google_fit" | "apple_health" | "garmin"

/** Keep in sync with `ProviderId`; used for static export of `/api/wearables/[provider]/*`. */
export const ALL_PROVIDER_IDS: ProviderId[] = [
  "fitbit",
  "google_fit",
  "apple_health",
  "garmin",
]

export interface ProviderDailyMetrics {
  date: string
  steps: number | null
  restingHeartRate: number | null
  averageHeartRate: number | null
  sleepMinutes: number | null
  spo2AvgPct: number | null
  spo2MinPct: number | null
  spo2MaxPct: number | null
  extra?: Record<string, unknown>
}

export interface ProviderTokens {
  accessToken: string
  refreshToken: string
  expiresAt: string
  scopes: string
  externalUserId?: string | null
}

export interface LiveSnapshot {
  heartBpm: number | null
  heartAsOf: string | null
  heartSource: string | null
  spo2AvgPct: number | null
  spo2Date: string | null
  spo2Source: string | null
  note: string | null
}

export interface WearableProviderAdapter {
  id: ProviderId
  /** Human label for the integrations UI. */
  label: string
  /** Lowercased OAuth scopes the adapter needs. */
  scopes: string[]
  /** `true` when env configured (client id + secret), `false` otherwise. */
  isConfigured: () => boolean
  authorizeUrl: (state: string, redirectUri: string) => string
  exchangeCode: (code: string, redirectUri: string) => Promise<ProviderTokens>
  refreshTokens: (refreshToken: string) => Promise<ProviderTokens>
  fetchDailySummary: (
    accessToken: string,
    date: string,
    opts?: { startMs: number; endMs: number }
  ) => Promise<ProviderDailyMetrics | null>
  fetchLive?: (accessToken: string, date: string) => Promise<LiveSnapshot | null>
}
