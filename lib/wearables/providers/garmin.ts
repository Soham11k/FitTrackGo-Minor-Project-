/**
 * Garmin provider adapter — OAuth 1.0a (Garmin still uses it). This adapter
 * stops at building the authorize URL + storing tokens because a full OAuth 1
 * request-token dance is substantial. A follow-up PR will implement
 * `fetchDailySummary`.
 */
import type {
  ProviderDailyMetrics,
  ProviderTokens,
  WearableProviderAdapter,
} from "./types"

const AUTH_URL = "https://connect.garmin.com/oauth2Confirm"

export const garminAdapter: WearableProviderAdapter = {
  id: "garmin",
  label: "Garmin",
  scopes: [],

  isConfigured: () =>
    !!process.env.GARMIN_CONSUMER_KEY && !!process.env.GARMIN_CONSUMER_SECRET,

  authorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: process.env.GARMIN_CONSUMER_KEY ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    })
    return `${AUTH_URL}?${params.toString()}`
  },

  async exchangeCode(): Promise<ProviderTokens> {
    throw new Error(
      "Garmin adapter: token exchange is not yet implemented. Track in docs/GLOBAL-READINESS-ROADMAP.md."
    )
  },

  async refreshTokens(): Promise<ProviderTokens> {
    throw new Error("Garmin adapter: refresh not yet implemented.")
  },

  async fetchDailySummary(): Promise<ProviderDailyMetrics | null> {
    return null
  },
}
