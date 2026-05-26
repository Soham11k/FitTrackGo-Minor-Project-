import { canonicalSupabasePublicUrl, resolveCanonicalSupabaseOriginFromEnv } from '@/lib/supabase/runtime-url'
import { legacyJwtProjectRef, normalizeSupabaseProjectRef } from '@/lib/supabase/jwt-project-ref'

type SupabaseValidationResult = {
  isConfigured: boolean
  url?: string
  key?: string
  reason?: string
}

/** Trim, strip BOM, strip wrapping quotes (common .env paste mistakes). */
export function normalizePublicEnvScalar(value: string | undefined): string {
  if (!value) return ''
  let s = value.trim().replace(/^\ufeff/, '')
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim()
  }
  return s
}

function isPlaceholderValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    normalized.includes("your-project-url") ||
    normalized.includes("your-anon-key") ||
    normalized.includes("your-project-url-here") ||
    normalized.includes("your-anon-key-here") ||
    normalized.includes("your_project_ref") ||
    normalized === "your_anon_key_here" ||
    normalized.includes("your_anon_key")
  )
}

/** Project ref from Supabase URL host (`xxxx.supabase.co`). With no args, uses env resolved the same way as API clients (dev JWT/URL reconciliation). */
export function getSupabaseProjectRefFromPublicUrl(explicitUrl?: string): string | null {
  const trimmed =
    explicitUrl !== undefined && explicitUrl.trim().length > 0
      ? normalizePublicEnvScalar(explicitUrl)
      : resolveCanonicalSupabaseOriginFromEnv()
  if (!trimmed) return null
  const canon = canonicalSupabasePublicUrl(trimmed)
  try {
    const host = new URL(canon).hostname.toLowerCase()
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/)
    return normalizeSupabaseProjectRef(m?.[1] ?? null)
  } catch {
    return null
  }
}

export function getSupabaseSqlEditorUrl(): string {
  const ref = getSupabaseProjectRefFromPublicUrl()
  return ref
    ? `https://app.supabase.com/project/${ref}/sql/new`
    : "https://app.supabase.com"
}

export function collectNetworkErrnoCodes(error: unknown): string[] {
  const codes: string[] = []
  let current: unknown = error
  for (let d = 0; d < 6 && current != null; d++) {
    if (typeof current === "object" && current !== null) {
      const code = (current as { code?: unknown }).code
      if (typeof code === "string" && code.length > 0 && code.length <= 64 && !/\s/.test(code)) {
        codes.push(code)
      }
    }
    if (current instanceof Error && current.cause != null) {
      current = current.cause
    } else {
      break
    }
  }
  return [...new Set(codes)]
}

export function validateSupabaseEnv(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
): SupabaseValidationResult {
  const urlNorm = normalizePublicEnvScalar(url)
  const keyNorm = normalizePublicEnvScalar(key)

  if (!urlNorm || !keyNorm) {
    return {
      isConfigured: false,
      reason:
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Use a file named .env.local at the project root (not .env.local.example), then restart npm run dev.",
    }
  }

  if (isPlaceholderValue(urlNorm) || isPlaceholderValue(keyNorm)) {
    return {
      isConfigured: false,
      reason: "Supabase env values are placeholders and must be replaced.",
    }
  }

  const urlCanon = canonicalSupabasePublicUrl(urlNorm)

  try {
    const parsedUrl = new URL(urlCanon)
    if (parsedUrl.protocol !== "https:") {
      return {
        isConfigured: false,
        reason: "NEXT_PUBLIC_SUPABASE_URL must start with https://",
      }
    }
    const host = parsedUrl.hostname.toLowerCase()
    if (!/^([a-z0-9]+)\.supabase\.co$/.test(host)) {
      return {
        isConfigured: false,
        reason:
          "NEXT_PUBLIC_SUPABASE_URL must be https://<project-ref>.supabase.co (copy Project URL from Supabase → Settings → API; no other hostname).",
      }
    }
  } catch {
    return {
      isConfigured: false,
      reason: "NEXT_PUBLIC_SUPABASE_URL is not a valid URL.",
    }
  }

  if (!(keyNorm.startsWith("eyJ") || keyNorm.startsWith("sb_publishable_"))) {
    return {
      isConfigured: false,
      reason: "NEXT_PUBLIC_SUPABASE_ANON_KEY format looks invalid.",
    }
  }

  let jwtRef: string | null = null
  if (keyNorm.startsWith("eyJ")) {
    jwtRef = legacyJwtProjectRef(keyNorm)
    if (!jwtRef) {
      return {
        isConfigured: false,
        reason:
          "NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a JWT but its project ref could not be read. Paste the anon key again from Supabase → Settings → API.",
      }
    }
  }

  const urlRef = getSupabaseProjectRefFromPublicUrl(urlCanon)
  if (jwtRef && urlRef && jwtRef !== urlRef) {
    if (process.env.NODE_ENV === "development") {
      const corrected = `https://${jwtRef}.supabase.co`
      return {
        isConfigured: true,
        url: corrected,
        key: keyNorm,
      }
    }
    return {
      isConfigured: false,
      reason:
        `Supabase URL host (${urlRef}) and anon JWT ref (${jwtRef}) differ — they always come in pairs from one project. ` +
        `Fix one side: set NEXT_PUBLIC_SUPABASE_URL=https://${jwtRef}.supabase.co to match your current anon key, OR keep your URL and replace NEXT_PUBLIC_SUPABASE_ANON_KEY (and usually SUPABASE_SERVICE_ROLE_KEY) from Supabase → Settings → API for that URL’s project. Restart npm run dev.`,
    }
  }

  return {
    isConfigured: true,
    url: urlCanon,
    key: keyNorm,
  }
}

export function isSupabaseFetchError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase()
  const codes = collectNetworkErrnoCodes(error).map((c) => c.toLowerCase())
  const causeCode = codes[0] ?? ""

  if (
    codes.some((c) =>
      ["enotfound", "econnrefused", "etimedout", "econnreset", "cert_has_expired"].includes(c)
    )
  ) {
    return true
  }

  if (!(error instanceof Error)) {
    return (
      msg.includes("failed to fetch") ||
      msg.includes("fetch failed") ||
      msg.includes("networkerror") ||
      msg.includes("load failed")
    )
  }

  const message = error.message.toLowerCase()
  const name = error.name.toLowerCase()
  if (name.includes("authapierror") || name.includes("authweakpassworderror")) {
    return false
  }
  if (
    message.includes("invalid login credentials") ||
    message.includes("email not confirmed") ||
    message.includes("user already registered")
  ) {
    return false
  }
  return (
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    name.includes("authretryablefetcherror") ||
    causeCode === "enotfound" ||
    causeCode === "econnrefused" ||
    causeCode === "etimedout" ||
    causeCode === "econnreset"
  )
}

function isSupabaseEmailRateLimitError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase()
  if (msg.includes("email rate limit") || msg.includes("over_email_send_rate_limit")) {
    return true
  }
  const o = error as { code?: string }
  if (o.code === "over_email_send_rate_limit") {
    return true
  }
  return false
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (isSupabaseFetchError(error)) {
    const codes = collectNetworkErrnoCodes(error)
    let safeHost = ""
    try {
      safeHost = new URL(resolveCanonicalSupabaseOriginFromEnv()).hostname
    } catch {
      safeHost = ""
    }
    const codeHint = codes.length ? ` (${codes.join(" · ")})` : ""
    const hostHint = safeHost ? `Host: ${safeHost}. ` : ""
    const isReset = codes.some((c) => c.toLowerCase() === "econnreset")
    const pausedHint = isReset
      ? "TLS to your project host is being reset (ECONNRESET) — often a paused project: app.supabase.com → your project → Restore. "
      : ""
    return (
      `Cannot reach Supabase${codeHint}. ${hostHint}` +
      pausedHint +
      "If the project is active, try another network, turn off VPN/ad-block, or run `npm run check:supabase-host`. " +
      "In dev, open /api/diag/supabase-proxy for a full connectivity report. Restart `npm run dev` after changing .env.local."
    )
  }

  if (isSupabaseEmailRateLimitError(error)) {
    return "Supabase email limit reached. Retry in a while, or under Authentication → Providers → Email turn off “Confirm email” for testing (stops a mail on every sign-up)."
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}
