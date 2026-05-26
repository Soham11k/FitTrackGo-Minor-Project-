/** Serialize any error to a readable string (Supabase errors often log as "{}" otherwise). */
export function formatErr(e: unknown): string {
  if (e == null) return "Unknown error"
  if (typeof e === "string") return e
  const o = e as Record<string, unknown>
  const msg = o.message ?? o.msg
  const code = o.code
  const details = o.details
  if (typeof msg === "string" && msg) return code != null ? `${code}: ${msg}` : msg
  if (code != null) return String(code)
  if (typeof details === "string" && details) return details
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}
