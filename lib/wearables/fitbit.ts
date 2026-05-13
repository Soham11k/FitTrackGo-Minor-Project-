const FITBIT_AUTH = "https://www.fitbit.com/oauth2/authorize"
const FITBIT_TOKEN = "https://api.fitbit.com/oauth2/token"

export const FITBIT_SCOPES = [
  "activity",
  "heartrate",
  "profile",
  "oxygen_saturation",
].join(" ")

export type FitbitTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
}

function placeholderKey(v: string | undefined): boolean {
  if (!v?.trim()) return true
  const t = v.trim().toLowerCase()
  return t.startsWith("your-") || t.includes("placeholder")
}

export function isFitbitConfigured(): boolean {
  const id = process.env.FITBIT_CLIENT_ID?.trim()
  const secret = process.env.FITBIT_CLIENT_SECRET?.trim()
  return Boolean(id && secret && !placeholderKey(id) && !placeholderKey(secret))
}

/** Non-secret flags for `/api/wearables/status` (must match `isFitbitConfigured` logic). */
export function fitbitEnvKeyPresenceForUi(): {
  serverHasClientId: boolean
  serverHasClientSecret: boolean
} {
  const id = process.env.FITBIT_CLIENT_ID?.trim()
  const secret = process.env.FITBIT_CLIENT_SECRET?.trim()
  return {
    serverHasClientId: Boolean(id && !placeholderKey(id)),
    serverHasClientSecret: Boolean(secret && !placeholderKey(secret)),
  }
}

export function getFitbitCallbackUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (base) return `${base}/api/wearables/fitbit/callback`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/wearables/fitbit/callback`
  return "http://localhost:3000/api/wearables/fitbit/callback"
}

export function buildFitbitAuthorizeUrl(params: { state: string; redirectUri: string }): string {
  const clientId = process.env.FITBIT_CLIENT_ID!.trim()
  const u = new URL(FITBIT_AUTH)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("client_id", clientId)
  u.searchParams.set("redirect_uri", params.redirectUri)
  u.searchParams.set("scope", FITBIT_SCOPES)
  u.searchParams.set("state", params.state)
  return u.toString()
}

function basicAuthHeader(): string {
  const id = process.env.FITBIT_CLIENT_ID!.trim()
  const secret = process.env.FITBIT_CLIENT_SECRET!.trim()
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`
}

export async function exchangeFitbitCode(
  code: string,
  redirectUri: string
): Promise<FitbitTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  })
  const r = await fetch(FITBIT_TOKEN, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  const j = (await r.json()) as FitbitTokenResponse & { errors?: unknown }
  if (!r.ok) {
    const msg = JSON.stringify(j.errors ?? j)
    throw new Error(`Fitbit token exchange failed: ${msg}`)
  }
  return j
}

export async function refreshFitbitToken(refreshToken: string): Promise<FitbitTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })
  const r = await fetch(FITBIT_TOKEN, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  const j = (await r.json()) as FitbitTokenResponse & { errors?: unknown }
  if (!r.ok) {
    const msg = JSON.stringify(j.errors ?? j)
    throw new Error(`Fitbit refresh failed: ${msg}`)
  }
  return j
}

const FITBIT_DEFAULT_TIMEOUT_MS = 8000

export async function fitbitApiGet<T>(
  path: string,
  accessToken: string,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `https://api.fitbit.com${path.startsWith("/") ? path : `/${path}`}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error("Fitbit request timed out")), opts.timeoutMs ?? FITBIT_DEFAULT_TIMEOUT_MS)
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort(opts.signal.reason)
    else opts.signal.addEventListener("abort", () => controller.abort(opts.signal!.reason), { once: true })
  }
  let r: Response
  try {
    r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  const j = (await r.json()) as T & { errors?: unknown }
  if (!r.ok) {
    const msg = JSON.stringify((j as { errors?: unknown }).errors ?? j)
    throw new Error(`Fitbit API ${r.status}: ${msg}`)
  }
  return j as T
}

export type FitbitProfile = {
  user?: { encodedId?: string; fullName?: string }
}

export async function fetchFitbitExternalUserId(accessToken: string): Promise<string | null> {
  const data = await fitbitApiGet<FitbitProfile>("/1/user/-/profile.json", accessToken)
  return data.user?.encodedId ?? null
}
