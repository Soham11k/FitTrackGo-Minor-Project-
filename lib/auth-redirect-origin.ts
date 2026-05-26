/**
 * Canonical origin for Supabase OAuth / magic-link `redirectTo` / `emailRedirectTo`.
 *
 * Dev servers often bind `0.0.0.0`, but browsers treat `http://0.0.0.0:3000` as a **different origin**
 * from `http://localhost:3000`. Mixing them breaks PKCE (code verifier cookie) vs linked callback host.
 */

export function normalizeAuthRedirectOrigin(input: string): string {
  try {
    const u = new URL(input)
    const h = u.hostname.toLowerCase()
    if (h === "0.0.0.0" || h === "[::]" || h === "::") {
      u.hostname = "localhost"
    }
    return u.origin
  } catch {
    return "http://localhost:3000"
  }
}

/** Use on the client for `redirectTo` / `emailRedirectTo` payloads. */
export function getBrowserAuthRedirectOrigin(): string {
  if (typeof window === "undefined") return "http://localhost:3000"
  return normalizeAuthRedirectOrigin(window.location.origin)
}
