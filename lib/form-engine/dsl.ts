import type { Condition, MetricId, LoadRelax } from "./types"

/** Apply load-relaxation to the comparison threshold. */
function relaxedValue(value: number, op: string, relax: LoadRelax | undefined, loadRatio: number | undefined): number {
  if (!relax || loadRatio === undefined || loadRatio < relax.perXBodyweight) return value
  // Relaxation widens the *acceptable* zone.
  // For "<" / "<=" thresholds (e.g. "depth must be deeper than X"), allow a higher value.
  // For ">" / ">=" thresholds, allow a lower value.
  // For "between", grow both ends by half.
  switch (op) {
    case "<":
    case "<=":
      return value + relax.addThresholdDeg
    case ">":
    case ">=":
      return Math.max(0, value - relax.addThresholdDeg)
    case "between":
      return value - relax.addThresholdDeg / 2
    default:
      return value
  }
}

function relaxedHi(value: number, relax: LoadRelax | undefined, loadRatio: number | undefined): number {
  if (!relax || loadRatio === undefined || loadRatio < relax.perXBodyweight) return value
  return value + relax.addThresholdDeg / 2
}

/**
 * Evaluate a condition against a metrics map.
 * Returns false when required metric is missing (rule cannot be evaluated).
 */
export function evalCondition(
  cond: Condition,
  metrics: Partial<Record<MetricId, number>>,
  loadRatio: number | undefined,
  relax: LoadRelax | undefined
): boolean {
  if ("all" in cond) {
    return cond.all.every((c) => evalCondition(c, metrics, loadRatio, relax))
  }
  if ("any" in cond) {
    return cond.any.some((c) => evalCondition(c, metrics, loadRatio, relax))
  }
  if ("not" in cond) {
    return !evalCondition(cond.not, metrics, loadRatio, relax)
  }
  const v = metrics[cond.metric]
  if (v === undefined || Number.isNaN(v)) return false
  const lo = relaxedValue(cond.value, cond.op, relax, loadRatio)
  switch (cond.op) {
    case ">":
      return v > lo
    case ">=":
      return v >= lo
    case "<":
      return v < lo
    case "<=":
      return v <= lo
    case "between": {
      const hi = relaxedHi(cond.hi ?? cond.value, relax, loadRatio)
      return v >= lo && v <= hi
    }
    default:
      return false
  }
}
