/**
 * Apple Health provider adapter (import-only).
 *
 * HealthKit has no public REST API. On iOS we ingest data through the
 * Capacitor HealthKit plugin that posts a JSON payload to
 * `/api/wearables/apple_health/import`; the payload is then shaped into the
 * normalized `ProviderDailyMetrics` by the adapter below. On web we accept
 * Apple Health XML/JSON exports uploaded by the user.
 */
import type { ProviderDailyMetrics, WearableProviderAdapter } from "./types"

export interface AppleHealthImport {
  date: string
  steps?: number
  restingHeartRate?: number
  averageHeartRate?: number
  sleepMinutes?: number
  spo2AvgPct?: number
  spo2MinPct?: number
  spo2MaxPct?: number
}

export function normalizeAppleHealthImport(p: AppleHealthImport): ProviderDailyMetrics {
  return {
    date: p.date,
    steps: p.steps ?? null,
    restingHeartRate: p.restingHeartRate ?? null,
    averageHeartRate: p.averageHeartRate ?? null,
    sleepMinutes: p.sleepMinutes ?? null,
    spo2AvgPct: p.spo2AvgPct ?? null,
    spo2MinPct: p.spo2MinPct ?? null,
    spo2MaxPct: p.spo2MaxPct ?? null,
    extra: { source: "apple_health" },
  }
}

export const appleHealthAdapter: WearableProviderAdapter = {
  id: "apple_health",
  label: "Apple Health",
  scopes: [],
  isConfigured: () => true,
  authorizeUrl: () => "",
  async exchangeCode() {
    throw new Error("Apple Health has no OAuth; tokens are device-local.")
  },
  async refreshTokens() {
    throw new Error("Apple Health does not have refresh tokens.")
  },
  async fetchDailySummary(_accessToken: string, _date: string, _opts?: { startMs: number; endMs: number }) {
    // Pull is driven by the device; nothing to do server-side until an import
    // lands for this date.
    return null
  },
}
