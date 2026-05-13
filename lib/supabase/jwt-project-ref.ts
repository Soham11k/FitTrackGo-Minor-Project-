/** Supabase project refs are alphanumeric; normalize paste/hidden-char drift. */
export function normalizeSupabaseProjectRef(ref: string | null | undefined): string | null {
  if (ref == null) return null
  const s = String(ref)
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
  return s.length > 0 ? s : null
}

function decodeJwtPayloadUtf8(segment: string): string | null {
  try {
    if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
      try {
        return Buffer.from(segment, "base64url").toString("utf8")
      } catch {
        /* some browser Buffer shims lack base64url — fall through */
      }
    }
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/")
    const pad = (4 - (b64.length % 4)) % 4
    return globalThis.atob(b64 + "=".repeat(pad))
  } catch {
    return null
  }
}

/** JWT payload `ref` from legacy anon/service_role keys (`eyJ…`). */
export function legacyJwtProjectRef(anonKey: string | undefined): string | null {
  const k = (anonKey ?? "").trim()
  if (!k.startsWith("eyJ")) return null
  try {
    const segment = k.split(".")[1]
    if (!segment) return null
    const utf8 = decodeJwtPayloadUtf8(segment)
    if (!utf8) return null
    const payload = JSON.parse(utf8) as { ref?: unknown; iss?: unknown }
    let raw = typeof payload.ref === "string" ? payload.ref : null
    if (!raw && typeof payload.iss === "string") {
      const m = payload.iss.match(/^https:\/\/([a-z0-9]+)\.supabase\.co(?:\/|$)/i)
      raw = m?.[1] ?? null
    }
    return normalizeSupabaseProjectRef(raw)
  } catch {
    return null
  }
}
