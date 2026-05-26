/** True when an auth health probe got a real Supabase response (not a proxy/Next 5xx page). */
export function supabaseHealthProbeOk(status: number): boolean {
  return (status >= 200 && status < 500) || status === 401
}
