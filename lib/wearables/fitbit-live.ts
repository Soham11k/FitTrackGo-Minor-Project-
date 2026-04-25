import { fitbitApiGet } from "@/lib/wearables/fitbit"

/** YYYY-MM-DD for calendar day `d` in the user's local timezone (browser or server locale). */
export function localCalendarYmd(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function previousCalendarDay(ymd: string): string {
  const [y, mo, da] = ymd.split("-").map((n) => Number.parseInt(n, 10))
  if (!y || !mo || !da) return ymd
  const utc = Date.UTC(y, mo - 1, da)
  const prev = new Date(utc - 86400000)
  const yy = prev.getUTCFullYear()
  const mm = String(prev.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(prev.getUTCDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

/**
 * Daily summary: Fitbit documents both
 * - /date/{date}/1d.json (period)
 * - /date/{start}/{end}.json with start === end (range)
 * Intraday: /date/{start}/{end}/1min.json only.
 */
function restingHeartPaths(date: "today" | string): string[] {
  if (date === "today") {
    return [
      "/1/user/-/activities/heart/date/today/today.json",
      "/1/user/-/activities/heart/date/today/1d.json",
    ]
  }
  return [
    `/1/user/-/activities/heart/date/${date}/${date}.json`,
    `/1/user/-/activities/heart/date/${date}/1d.json`,
  ]
}

/** Fitbit: GET .../heart/date/{date}/1d/{1min|1sec|...}.json — not date/date/1min. */
function heartIntradayPaths(date: "today" | string): string[] {
  if (date === "today") {
    return ["/1/user/-/activities/heart/date/today/1d/1min.json"]
  }
  return [`/1/user/-/activities/heart/date/${date}/1d/1min.json`]
}

type IntradayHeart = {
  "activities-heart"?: Array<{ dateTime?: string }>
  "activities-heart-intraday"?: {
    dataset?: Array<{ time: string; value: number }>
  }
}

type DailyHeart = {
  "activities-heart"?: Array<{
    dateTime?: string
    value?: { restingHeartRate?: number }
  }>
}

function heartRateDayKey(data: IntradayHeart, date: "today" | string): string | null {
  const dt = data["activities-heart"]?.[0]?.dateTime
  if (dt && /^\d{4}-\d{2}-\d{2}$/.test(dt)) return dt
  if (typeof date === "string" && date !== "today") return date
  return null
}

function normalizeHrTime(t: string): string {
  const n = t.split(":").length
  if (n === 2) return `${t}:00`
  return t
}

/** SpO2 single-date API returns { dateTime, value: { avg, min, max } }; interval API uses { value: [ ... ] }. */
export function extractSpo2Summary(data: unknown): {
  avg: number
  min: number | null
  max: number | null
  dateTime: string
} | null {
  if (!data || typeof data !== "object") return null
  const o = data as Record<string, unknown>
  const val = o.value

  if (val && typeof val === "object" && !Array.isArray(val)) {
    const v = val as { avg?: number; min?: number; max?: number }
    if (v.avg == null) return null
    const dt = typeof o.dateTime === "string" ? o.dateTime : ""
    if (!dt) return null
    return {
      avg: v.avg,
      min: v.min ?? null,
      max: v.max ?? null,
      dateTime: dt,
    }
  }

  if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === "object") {
    const day = val[0] as Record<string, unknown>
    const inner = day.value as { avg?: number; min?: number; max?: number } | undefined
    const fromInner = inner?.avg
    const minutes = day.minutes as Array<{ value?: { avg?: number; min?: number; max?: number } }> | undefined
    const fromMin = minutes?.find((m) => m.value?.avg != null)?.value
    const avg = fromInner ?? fromMin?.avg
    if (avg == null) return null
    const dt = (typeof day.dateTime === "string" ? day.dateTime : null) ?? ""
    if (!dt) return null
    return {
      avg,
      min: inner?.min ?? fromMin?.min ?? null,
      max: inner?.max ?? fromMin?.max ?? null,
      dateTime: dt,
    }
  }

  return null
}

/** Interval API returns a top-level array of per-day objects; single-date returns one object. */
export function extractSpo2Summaries(data: unknown): Array<{
  avg: number
  min: number | null
  max: number | null
  dateTime: string
}> {
  if (Array.isArray(data)) {
    const out: NonNullable<ReturnType<typeof extractSpo2Summary>>[] = []
    for (const item of data) {
      const s = extractSpo2Summary(item)
      if (s) out.push(s)
    }
    return out
  }
  const one = extractSpo2Summary(data)
  return one ? [one] : []
}

export async function fetchLatestMinuteHeartRate(
  accessToken: string,
  date: "today" | string
): Promise<{
  bpm: number | null
  asOf: string | null
  source: "intraday_1min"
} | null> {
  for (const path of heartIntradayPaths(date)) {
    try {
      const data = await fitbitApiGet<IntradayHeart>(path, accessToken)
      const dayKey = heartRateDayKey(data, date)
      const set = data["activities-heart-intraday"]?.dataset
      if (!set?.length) continue
      for (let i = set.length - 1; i >= 0; i--) {
        const p = set[i]
        if (p?.value != null && p.value > 0) {
          const asOf = dayKey && p.time ? `${dayKey}T${normalizeHrTime(p.time)}` : null
          return { bpm: Math.round(p.value), asOf, source: "intraday_1min" }
        }
      }
    } catch {
      continue
    }
  }
  return { bpm: null, asOf: null, source: "intraday_1min" }
}

export async function fetchRestingHeartForDate(
  accessToken: string,
  date: "today" | string
): Promise<{
  bpm: number | null
  asOf: string | null
  source: "resting_daily"
} | null> {
  for (const path of restingHeartPaths(date)) {
    try {
      const data = await fitbitApiGet<DailyHeart>(path, accessToken)
      const row = data["activities-heart"]?.[0]
      const rhr = row?.value?.restingHeartRate
      if (rhr != null && rhr > 0) {
        return {
          bpm: Math.round(rhr),
          asOf: row?.dateTime ?? (typeof date === "string" && date !== "today" ? date : null),
          source: "resting_daily",
        }
      }
    } catch {
      continue
    }
  }
  const fallback = typeof date === "string" && date !== "today" ? date : null
  return { bpm: null, asOf: fallback, source: "resting_daily" }
}

/** Latest day in 7d/30d series that has resting HR (Fitbit often omits “today” until processed). */
export async function fetchLatestRestingFromRecentSeries(accessToken: string): Promise<{
  bpm: number
  asOf: string | null
  source: "resting_series"
} | null> {
  const paths = [
    "/1/user/-/activities/heart/date/today/7d.json",
    "/1/user/-/activities/heart/date/today/30d.json",
  ]
  for (const path of paths) {
    try {
      const data = await fitbitApiGet<DailyHeart>(path, accessToken)
      const rows = data["activities-heart"] ?? []
      for (let i = rows.length - 1; i >= 0; i--) {
        const rhr = rows[i]?.value?.restingHeartRate
        if (rhr != null && rhr > 0) {
          return {
            bpm: Math.round(rhr),
            asOf: rows[i]?.dateTime ?? null,
            source: "resting_series",
          }
        }
      }
    } catch {
      continue
    }
  }
  return null
}

export async function fetchSpo2ForDate(
  accessToken: string,
  date: string
): Promise<{
  avgPct: number | null
  date: string | null
  source: "live"
} | null> {
  try {
    const path =
      date === "today"
        ? "/1/user/-/spo2/date/today.json"
        : `/1/user/-/spo2/date/${date}.json`
    const data = await fitbitApiGet<unknown>(path, accessToken)
    const s = extractSpo2Summary(data)
    if (!s) return { avgPct: null, date: date === "today" ? null : date, source: "live" }
    return {
      avgPct: Math.round(s.avg * 10) / 10,
      date: s.dateTime,
      source: "live",
    }
  } catch {
    return null
  }
}
