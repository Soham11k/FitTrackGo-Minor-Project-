/**
 * Local calendar day windows as UTC millis boundaries (browser/device local TZ).
 * Used for Google Fitness aggregate queries so metric_date aligns with Home "today".
 */
export type WearableDayWindow = { metricDate: string; startMs: number; endMs: number }

export function rollingLocalDayWindows(days: number): WearableDayWindow[] {
  const n = Number.isFinite(days) ? Math.min(Math.max(1, Math.floor(days)), 31) : 14
  const out: WearableDayWindow[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const y = d.getFullYear()
    const mo = d.getMonth()
    const da = d.getDate()
    const startMs = new Date(y, mo, da, 0, 0, 0, 0).getTime()
    const endMs = new Date(y, mo, da + 1, 0, 0, 0, 0).getTime()
    const metricDate = `${y}-${String(mo + 1).padStart(2, "0")}-${String(da).padStart(2, "0")}`
    out.push({ metricDate, startMs, endMs })
  }
  return out
}

/** Fallback when the client timezone is unavailable (OAuth callback server-side). */
export function rollingUtcDayWindows(days: number): WearableDayWindow[] {
  const n = Number.isFinite(days) ? Math.min(Math.max(1, Math.floor(days)), 31) : 14
  const out: WearableDayWindow[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() - i)
    const metricDate = d.toISOString().slice(0, 10)
    const startMs = d.getTime()
    const endMs = startMs + 24 * 60 * 60 * 1000
    out.push({ metricDate, startMs, endMs })
  }
  return out
}
