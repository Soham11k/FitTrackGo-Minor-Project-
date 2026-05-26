import type { RunRecord } from "@/lib/store"

function weekStartMonday(d = new Date()): Date {
  const dt = new Date(d)
  dt.setHours(0, 0, 0, 0)
  const day = (dt.getDay() + 6) % 7
  dt.setDate(dt.getDate() - day)
  return dt
}

/**
 * Rolling calendar weeks (Mon→Sun): this week KM total vs last week,
 * optionally including newRun distance in “this week.”
 */
export function computeWeeklyRunKmImpact(
  priorRuns: Pick<RunRecord, "completedAt" | "distance">[],
  newRunKm?: number,
  /** Anchor “today” for week boundaries (tests); defaults to now. */
  asOf: Date = new Date(),
): { thisWeekKm: number; lastWeekKm: number; deltaPctVsLastWeek: number } {
  const now = asOf.getTime()
  const thisMonday = weekStartMonday(asOf).getTime()
  const lastMonday = thisMonday - 7 * 86400000
  const lastEnd = thisMonday

  let thisWeekKm = 0
  let lastWeekKm = 0

  for (const r of priorRuns) {
    if (!r.completedAt) continue
    const t = new Date(r.completedAt).getTime()
    const km = Number(r.distance) || 0
    if (t >= thisMonday && t <= now) thisWeekKm += km
    else if (t >= lastMonday && t < lastEnd) lastWeekKm += km
  }

  if (newRunKm != null && newRunKm > 0) thisWeekKm += newRunKm

  const deltaPctVsLastWeek =
    lastWeekKm > 1e-6 ? Math.round(((thisWeekKm - lastWeekKm) / lastWeekKm) * 100) : thisWeekKm > 0 ? 100 : 0

  return { thisWeekKm, lastWeekKm, deltaPctVsLastWeek }
}

export function weeklyImpactSentence(input: ReturnType<typeof computeWeeklyRunKmImpact>): string {
  const rounded = `${input.thisWeekKm.toFixed(1)} km`
  if (input.lastWeekKm < 1e-6 && input.thisWeekKm > 0)
    return `This run brings weekly volume to ${rounded} — first full week tracked.`
  const dir = input.deltaPctVsLastWeek >= 0 ? "↑" : "↓"
  return `This week's total: ${rounded} (${dir} ${Math.abs(input.deltaPctVsLastWeek)}% vs last week).`
}
