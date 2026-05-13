import type { RunRecord } from "@/lib/store"

function paceToSec(p?: string): number {
  if (!p) return Infinity
  const m = /^(\d+):(\d{1,2})$/.exec(String(p).trim())
  if (!m) return Infinity
  const s = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  return s > 0 ? s : Infinity
}

export type PbResult = null | { variant: "pb-distance" | "pb-pace" }

/** Compare the run just saved against historical runs already in profile (excluding this session). */
export function detectRunPersonalBest(
  prevRuns: Pick<RunRecord, "distance" | "pace">[],
  snapshot: { distanceKm: number; pace: string },
): PbResult {
  const bestDist = prevRuns.reduce((m, r) => Math.max(m, Number(r.distance) || 0), 0)
  let fastestPaceSec = Infinity
  for (const r of prevRuns) {
    if ((Number(r.distance) || 0) < 0.5) continue
    fastestPaceSec = Math.min(fastestPaceSec, paceToSec(r.pace))
  }

  const isDistPb = snapshot.distanceKm > 1e-6 && snapshot.distanceKm > bestDist + 1e-9
  if (isDistPb) return { variant: "pb-distance" }

  if (snapshot.distanceKm >= 0.5 - 1e-9) {
    const s = paceToSec(snapshot.pace)
    if (s !== Infinity && (fastestPaceSec === Infinity || s + 0.25 < fastestPaceSec)) {
      return { variant: "pb-pace" }
    }
  }

  return null
}
