import { legacyJwtProjectRef } from '@/lib/supabase/jwt-project-ref'

/**
 * Dashboard “Project URL” is `https://<ref>.supabase.co` with no path. Copy/paste mistakes often
 * include `/rest/v1/`; the JS client must use the origin only — auth lives under `/auth/v1/`.
 */
export function canonicalSupabasePublicUrl(raw: string): string {
  const s = raw.trim().replace(/\/$/, '')
  if (!s) return ''
  try {
    const u = new URL(s)
    if (/\.supabase\.co$/i.test(u.hostname)) {
      const p = u.pathname.replace(/\/$/, '') || '/'
      if (p === '/rest/v1' || p.startsWith('/rest/v1/')) {
        return u.origin
      }
    }
    return s
  } catch {
    return raw.trim()
  }
}

/**
 * HTTPS Supabase API origin from env (no dev-proxy rewriting).
 * In development, if legacy anon JWT `ref` ≠ hostname ref from NEXT_PUBLIC_SUPABASE_URL,
 * use the JWT ref host — that is the only project the anon key works with.
 */
export function resolveCanonicalSupabaseOriginFromEnv(): string {
  let canonical = canonicalSupabasePublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''

  if (
    process.env.NODE_ENV === "development" &&
    canonical.startsWith("https://") &&
    canonical.includes(".supabase.co")
  ) {
    const jwtRef = legacyJwtProjectRef(key)
    if (jwtRef) {
      try {
        const host = new URL(canonical).hostname.toLowerCase()
        const m = host.match(/^([a-z0-9]+)\.supabase\.co$/)
        const urlRef = m?.[1] ?? null
        if (urlRef && urlRef !== jwtRef) {
          console.warn(
            `[supabase] Dev only: NEXT_PUBLIC_SUPABASE_URL uses ref ${urlRef} but anon JWT is for ${jwtRef}; using https://${jwtRef}.supabase.co for requests.`
          )
          canonical = `https://${jwtRef}.supabase.co`
        }
      } catch {
        /* noop */
      }
    }
  }

  return canonical
}

/**
 * Supabase HTTP URL used by createBrowserClient / createServerClient.
 * In local dev, optional same-origin proxy avoids DNS/ad-block issues with *.supabase.co
 * (Cursor embedded browser, Pi-hole, etc.). See next.config.mjs rewrites and .env.local.example.
 */
export function getSupabaseUrlForRuntime(): string {
  const canonical = resolveCanonicalSupabaseOriginFromEnv()

  const useDevProxy =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_SUPABASE_USE_DEV_PROXY === "1" &&
    canonical.startsWith("https://") &&
    canonical.includes(".supabase.co")

  if (useDevProxy) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/__supabase-dev-proxy`
    }
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000"
    return `${base}/__supabase-dev-proxy`
  }

  return canonical
}
