/**
 * Motion DNA — a 6-axis radar summary of a workout session, covering
 * Stability, Range, Tempo, Symmetry, Depth, and Consistency.
 *
 * Each axis is a 0..1 score. The radar produces a visible "fingerprint" per
 * session; comparing sessions lets the coach surface "you improved Range
 * +12% since your last Squat session."
 *
 * This module is intentionally standalone (no DOM) so unit tests can cover
 * the math and future features can recompute DNA from stored rep logs.
 */

export interface RepSample {
  /** Form score 0..100 for the rep. */
  formScore: number
  /** Rep ROM 0..1 (deepest travel). */
  rom: number
  /** Rep duration (ms). */
  durationMs: number
  /** Whether rep met the "verified" bar used by leaderboards. */
  verified: boolean
  /**
   * Left/right symmetry for the rep in 0..1. 1 = perfectly symmetric. For
   * bilateral movements this is the absolute diff between sides.
   */
  symmetry: number
}

export interface MotionDna {
  stability: number
  range: number
  tempo: number
  symmetry: number
  depth: number
  consistency: number
}

export function computeMotionDna(reps: RepSample[]): MotionDna {
  if (!reps.length) {
    return zeroDna()
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const std = (xs: number[]) => {
    const m = mean(xs)
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
  }

  const scores = reps.map((r) => r.formScore / 100)
  const roms = reps.map((r) => r.rom)
  const durations = reps.map((r) => r.durationMs)
  const symms = reps.map((r) => r.symmetry)

  // Stability = 1 - std(form score). Good form rep-to-rep ⇒ high stability.
  const stability = clamp01(1 - std(scores) * 2)

  // Range = average ROM.
  const range = clamp01(mean(roms))

  // Tempo = how close rep durations are to an ideal 2-4s band.
  const tempo = clamp01(
    1 -
      mean(
        durations.map((ms) => {
          if (ms < 1_000) return 1 - ms / 1_000 // too fast
          if (ms > 6_000) return Math.min(1, (ms - 6_000) / 6_000) // too slow
          if (ms <= 4_000) return 0
          return (ms - 4_000) / 4_000
        })
      )
  )

  const symmetry = clamp01(mean(symms))

  // Depth = best quartile of ROM. Rewards occasional clean deep reps even if
  // average ROM is mediocre.
  const sortedRom = [...roms].sort((a, b) => b - a)
  const topQ = sortedRom.slice(0, Math.max(1, Math.floor(sortedRom.length / 4)))
  const depth = clamp01(mean(topQ))

  // Consistency = fraction of reps that were "verified" by form+ROM gates.
  const consistency = clamp01(reps.filter((r) => r.verified).length / reps.length)

  return { stability, range, tempo, symmetry, depth, consistency }
}

export function zeroDna(): MotionDna {
  return { stability: 0, range: 0, tempo: 0, symmetry: 0, depth: 0, consistency: 0 }
}

/**
 * Produce an SVG path for a Motion DNA radar on a canonical [-1, 1] box. The
 * caller applies its own center + scale transform.
 */
export function dnaRadarPath(dna: MotionDna): string {
  const axes = [
    dna.stability,
    dna.range,
    dna.tempo,
    dna.symmetry,
    dna.depth,
    dna.consistency,
  ]
  const step = (Math.PI * 2) / axes.length
  const coords = axes.map((v, i) => {
    const theta = -Math.PI / 2 + i * step
    return [Math.cos(theta) * v, Math.sin(theta) * v]
  })
  return coords.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(" ") + " Z"
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}
