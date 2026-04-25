type SupabaseValidationResult = {
  isConfigured: boolean
  url?: string
  key?: string
  reason?: string
}

function isPlaceholderValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    normalized.includes("your-project-url") ||
    normalized.includes("your-anon-key") ||
    normalized.includes("your-project-url-here") ||
    normalized.includes("your-anon-key-here")
  )
}

export function validateSupabaseEnv(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
): SupabaseValidationResult {
  if (!url || !key) {
    return {
      isConfigured: false,
      reason: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    }
  }

  if (isPlaceholderValue(url) || isPlaceholderValue(key)) {
    return {
      isConfigured: false,
      reason: "Supabase env values are placeholders and must be replaced.",
    }
  }

  try {
    const parsedUrl = new URL(url)
    if (parsedUrl.protocol !== "https:") {
      return {
        isConfigured: false,
        reason: "NEXT_PUBLIC_SUPABASE_URL must start with https://",
      }
    }
  } catch {
    return {
      isConfigured: false,
      reason: "NEXT_PUBLIC_SUPABASE_URL is not a valid URL.",
    }
  }

  if (!(key.startsWith("eyJ") || key.startsWith("sb_publishable_"))) {
    return {
      isConfigured: false,
      reason: "NEXT_PUBLIC_SUPABASE_ANON_KEY format looks invalid.",
    }
  }

  return {
    isConfigured: true,
    url,
    key,
  }
}

export function isSupabaseFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  const cause = error.cause
  const causeCode =
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof (cause as { code?: unknown }).code === "string"
      ? ((cause as { code: string }).code || "").toLowerCase()
      : ""

  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    causeCode === "enotfound" ||
    causeCode === "econnrefused" ||
    causeCode === "etimedout"
  )
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (isSupabaseFetchError(error)) {
    return "Cannot reach Supabase right now. Check your internet and NEXT_PUBLIC_SUPABASE_URL in .env.local."
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}
