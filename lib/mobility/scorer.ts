/** Hold scorer: accumulate seconds only while sampled angles stay inside drill bands. */

export function anglesInBands(
  sample: Record<string, number>,
  bands: Partial<Record<string, [number, number]>>,
): boolean {
  const keys = Object.keys(bands) as string[]
  if (!keys.length) return false
  for (const k of keys) {
    const range = bands[k]
    const v = sample[k]
    if (!range || typeof v !== "number" || !Number.isFinite(v)) return false
    if (v < range[0] || v > range[1]) return false
  }
  return true
}

export function sampleAnglesFromHud(list: { key: string; degrees: number }[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const row of list) m[row.key] = row.degrees
  return m
}

/** Integrates in-band time toward `holdSec` target (pauses drift automatically). */
export class HoldScorer {
  private accumulated = 0
  private holdSec: number

  constructor(holdSec: number) {
    this.holdSec = Math.max(1, holdSec)
  }

  /** @param dtSec frame delta in seconds */
  tick(inBand: boolean, dtSec: number) {
    if (!inBand || dtSec <= 0) return
    this.accumulated += dtSec
  }

  progress01(): number {
    return Math.min(1, this.accumulated / this.holdSec)
  }

  scorePct(): number {
    return Math.round(Math.min(1, this.accumulated / this.holdSec) * 100)
  }

  secondsHeld(): number {
    return this.accumulated
  }
}
