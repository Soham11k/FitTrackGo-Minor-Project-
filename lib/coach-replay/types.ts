import type { LandmarkPoint } from "@/lib/pose-detection"

/** Single pose sample for offline replay / overlay sync. */
export interface LandmarkSnapshot {
  tMs: number
  lm: Array<{ x: number; y: number; z?: number; visibility?: number }>
}

export interface CoachReplayMeta {
  clipId: string
  /** Set after Supabase save — used to open replay from history */
  sessionId: string | null
  exerciseId: string
  exerciseLabel: string
  durationMs: number
  createdAt: number
  repMarkersMs: number[]
  landmarkFrames: LandmarkSnapshot[]
  /** File name inside OPFS (no path) */
  opfsFileName: string
}

export function snapshotFromLandmarks(lm: LandmarkPoint[], tMs: number): LandmarkSnapshot {
  const slice = lm.slice(0, 33)
  const out: LandmarkSnapshot["lm"] = []
  for (let i = 0; i < 33; i++) {
    const p = slice[i]
    if (p) {
      out.push({
        x: p.x,
        y: p.y,
        z: p.z,
        visibility: p.visibility,
      })
    } else {
      out.push({ x: 0.5, y: 0.5, visibility: 0 })
    }
  }
  return { tMs, lm: out }
}
