import type { CoachRecord } from "@/lib/store"

export type AngleDeltaBucket = Record<string, number>

/** Differences keyed by angle key (`knee.l`, `elbow.r`, …) at chosen rep phase snapshots. */
export function jointAngleDeltaMap(
  a: Record<string, number> | undefined | null,
  b: Record<string, number> | undefined | null,
  keysHint?: Iterable<string>,
): AngleDeltaBucket {
  const keys = new Set<string>()
  if (a) Object.keys(a).forEach((k) => keys.add(k))
  if (b) Object.keys(b).forEach((k) => keys.add(k))
  if (keysHint) for (const k of keysHint) keys.add(k)

  const out: AngleDeltaBucket = {}
  for (const key of keys) {
    const av = a?.[key]
    const bv = b?.[key]
    if (typeof av !== "number" || typeof bv !== "number" || !Number.isFinite(av) || !Number.isFinite(bv)) continue
    out[key] = Math.round((av - bv) * 10) / 10
  }
  return out
}

function lastRepBottomAngles(session: CoachRecord): Record<string, number> | null {
  const pairs = session.repTraces
  const last = pairs?.[pairs.length - 1]?.bottom?.anglesDeg
  return last && Object.keys(last).length ? last : null
}

function lastRepTopAngles(session: CoachRecord): Record<string, number> | null {
  const pairs = session.repTraces
  const last = pairs?.[pairs.length - 1]?.top?.anglesDeg
  return last && Object.keys(last).length ? last : null
}

/** Client-only compare payload for stacked coach sessions of the **same exercise**. */
export function compareCoachSessions(current: CoachRecord, baseline: CoachRecord) {
  if (current.exercise.trim().toLowerCase() !== baseline.exercise.trim().toLowerCase()) {
    throw new Error("compareCoachSessions expects the same exercise on both sessions")
  }
  const avg = (scores: number[]) =>
    scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null

  const avgCurr = avg(current.repScores ?? [])
  const avgBase = avg(baseline.repScores ?? [])

  return {
    exercise: current.exercise,
    scoreDelta: (current.score ?? 0) - (baseline.score ?? 0),
    avgRepDelta: avgCurr !== null && avgBase !== null ? avgCurr - avgBase : null,
    bottomAnglesDelta: jointAngleDeltaMap(lastRepBottomAngles(current), lastRepBottomAngles(baseline)),
    topAnglesDelta: jointAngleDeltaMap(lastRepTopAngles(current), lastRepTopAngles(baseline)),
  }
}

export function formatDeltaChip(delta: number, suffix = "pts"): string {
  const sign = delta > 0 ? "+" : ""
  return `${sign}${Math.round(delta)} ${suffix}`
}
