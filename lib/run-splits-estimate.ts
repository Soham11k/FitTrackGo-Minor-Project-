import type { RunFinishLap } from "@/components/run-finish-recap"
import type { RunRecord } from "@/lib/store"

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const [lat1, lon1] = a
  const [lat2, lon2] = b
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}

function paceFromDistTime(dKm: number, tSec: number): string {
  if (dKm <= 0 || tSec <= 0) return "—"
  const paceMin = tSec / 60 / dKm
  const m = Math.floor(paceMin)
  const sec = Math.floor((paceMin - m) * 60)
  return `${m}:${String(sec).padStart(2, "0")}`
}

function uniformKmSplits(fullLaps: number, totalSec: number): RunFinishLap[] {
  const per = totalSec / fullLaps
  return Array.from({ length: fullLaps }, (_, i) => {
    const lap = i + 1
    const lt = Math.max(1, Math.round(per))
    return {
      lap,
      distance: lap,
      time: lt,
      pace: paceFromDistTime(1, lt),
    }
  })
}

/**
 * Estimate km splits for saved runs where per-lap data wasn't persisted.
 * Distributes total duration across GPS segments (by length), then reads off each km crossing.
 */
export function estimateKmSplitsFromRecord(run: RunRecord): RunFinishLap[] {
  const totalKm = Math.max(0, Number(run.distance) || 0)
  const totalSec = Math.max(0, Math.floor(run.duration))
  const fullLaps = Math.floor(totalKm)
  if (fullLaps < 1 || totalSec <= 0) return []

  const path = run.path
  if (!path || path.length < 2) {
    return uniformKmSplits(fullLaps, totalSec)
  }

  const segKm: number[] = []
  for (let i = 1; i < path.length; i++) {
    segKm.push(haversineKm(path[i - 1]!, path[i]!))
  }
  const poly = segKm.reduce((a, b) => a + b, 0)
  if (poly < 1e-4) return uniformKmSplits(fullLaps, totalSec)

  const scale = totalKm / poly
  const w = segKm.map((d) => d * scale)

  /** Distance at vertex 0 .. n */
  const cumD: number[] = [0]
  for (const d of w) cumD.push(cumD[cumD.length - 1]! + d)

  /** Time accrued by end of segment (segment i joins vertex i→i+1) */
  const segT = w.map((len) => totalSec * (len / Math.max(totalKm, 1e-6)))

  /** Cumulative time at each vertex */
  const cumT: number[] = [0]
  for (const dt of segT) cumT.push(cumT[cumT.length - 1]! + dt)

  function timeAtDistance(dTarget: number): number {
    if (dTarget <= 0) return 0
    if (dTarget >= totalKm) return totalSec
    let i = cumD.findIndex((d) => d >= dTarget) - 1
    if (i < 0) i = 0
    const d0 = cumD[i]!
    const d1 = cumD[i + 1]!
    if (d1 - d0 < 1e-9) return cumT[i]!
    const frac = (dTarget - d0) / (d1 - d0)
    return cumT[i]! + frac * (cumT[i + 1]! - cumT[i]!)
  }

  const splits: RunFinishLap[] = []
  let prevT = 0
  for (let lap = 1; lap <= fullLaps; lap++) {
    const tEnd = timeAtDistance(lap)
    const lapTime = Math.max(1, Math.round(tEnd - prevT))
    splits.push({
      lap,
      distance: lap,
      time: lapTime,
      pace: paceFromDistTime(1, lapTime),
    })
    prevT = tEnd
  }

  return splits
}
