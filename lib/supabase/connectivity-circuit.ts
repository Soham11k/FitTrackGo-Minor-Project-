/** Production-only backoff after confirmed Supabase network failures. */
const COOLDOWN_MS = 120_000

let unreachableUntil = 0

export function shouldSkipSupabaseNetwork(): boolean {
  if (process.env.NODE_ENV === 'development') return false
  return Date.now() < unreachableUntil
}

export function markSupabaseUnreachable(): void {
  if (process.env.NODE_ENV === 'development') return
  unreachableUntil = Date.now() + COOLDOWN_MS
}

export function markSupabaseReachable(): void {
  unreachableUntil = 0
}
