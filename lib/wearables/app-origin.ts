import type { ProviderId } from "@/lib/wearables/providers/types"

/**
 * Google / Fitbit (and peers) reject `redirect_uri` hosts like `0.0.0.0`,
 * which is what `request.url.origin` becomes when Next binds `next dev -H 0.0.0.0`.
 * Rewrite to localhost for OAuth signing + token exchange consistency.
 */
export function normalizeWearableOAuthOrigin(origin: string): string {
  try {
    let input = origin.trim().replace(/\/$/, "")
    if (!input.includes("://")) input = `http://${input}`
    const u = new URL(input)
    if (u.hostname === "0.0.0.0") u.hostname = "localhost"
    if (u.hostname === "[::]" || u.hostname === "::") u.hostname = "localhost"
    return u.origin
  } catch {
    return origin
  }
}

/**
 * Canonical base origin for wearable OAuth flows. Prefer NEXT_PUBLIC_APP_URL when set,
 * otherwise the incoming request URL (normalized), then Vercel, then localhost.
 */
export function resolveWearableOAuthRedirectBase(requestUrl?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  if (fromEnv) {
    const withScheme = fromEnv.includes("://") ? fromEnv : `http://${fromEnv}`
    return normalizeWearableOAuthOrigin(withScheme)
  }
  if (requestUrl) {
    try {
      return normalizeWearableOAuthOrigin(new URL(requestUrl).origin)
    } catch {
      /* fall through */
    }
  }
  if (process.env.VERCEL_URL) return normalizeWearableOAuthOrigin(`https://${process.env.VERCEL_URL}`)
  return "http://localhost:3000"
}

export function getPublicAppOrigin(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (base) return base
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export function wearableOAuthCallbackUrl(provider: ProviderId): string {
  return `${resolveWearableOAuthRedirectBase()}/api/wearables/${provider}/callback`
}
