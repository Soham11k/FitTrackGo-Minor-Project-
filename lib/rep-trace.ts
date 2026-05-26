/**
 * Per-rep pose snapshots at bottom/top for form reports and session comparison.
 */
import type { Landmark, AnalyzeFormOptions, CoachExerciseId } from "@/lib/form-analysis"
import { analyzeForm } from "@/lib/form-analysis"
import { computeJointAngles } from "@/lib/coach-vision/hud-metrics"

export type RepTracePhase = "top" | "bottom"

export interface RepTrace {
  phase: RepTracePhase
  anglesDeg: Record<string, number>
  faults: string[]
}

/** One counted rep — bottom phase snapshot + completion (top) snapshot. */
export interface RepTracePair {
  rep: number
  bottom: RepTrace
  top: RepTrace
}

/** Supabase JSON column `rep_traces` — array of pairs. */
export type RepTracesJson = RepTracePair[]

/** Build a snapshot for the current landmarks (angles + textual faults from analyzeForm feedback). */
export function captureRepTrace(
  lm: Landmark[],
  exercise: CoachExerciseId,
  phase: RepTracePhase,
  opts: AnalyzeFormOptions = {},
): RepTrace {
  const anglesDeg: Record<string, number> = {}
  for (const j of computeJointAngles(lm, exercise)) {
    anglesDeg[j.key] = Math.round(j.degrees * 10) / 10
  }
  const form = analyzeForm(lm, exercise, opts)
  const faults = form.feedback.filter(Boolean)
  return { phase, anglesDeg, faults }
}

/** Count fault strings across all traces; return most common. */
export function aggregateTopFaults(traces: RepTracePair[] | undefined | null, limit = 3): string[] {
  if (!traces?.length) return []
  const tally = new Map<string, number>()
  for (const pair of traces) {
    const seen = new Set<string>()
    for (const txt of [...pair.bottom.faults, ...pair.top.faults]) {
      const t = txt.trim()
      if (!t || seen.has(t)) continue
      seen.add(t)
      tally.set(t, (tally.get(t) ?? 0) + 1)
    }
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([k]) => k)
}

/** Coerce loosely-typed JSON from Supabase into RepTracePair[]. */
export function parseRepTracesJson(raw: unknown): RepTracePair[] {
  if (!Array.isArray(raw)) return []
  const out: RepTracePair[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const rep = typeof (item as { rep?: unknown }).rep === "number" ? (item as { rep: number }).rep : 0
    const bottom = coerceTrace((item as { bottom?: unknown }).bottom, "bottom")
    const top = coerceTrace((item as { top?: unknown }).top, "top")
    if (bottom && top && rep > 0) out.push({ rep, bottom, top })
  }
  return out
}

function coerceTrace(x: unknown, phase: RepTracePhase): RepTrace | null {
  if (!x || typeof x !== "object") return null
  const o = x as { anglesDeg?: unknown; faults?: unknown; phase?: unknown }
  if (typeof o.anglesDeg !== "object" || o.anglesDeg === null) return null
  const anglesDeg: Record<string, number> = {}
  for (const [k, v] of Object.entries(o.anglesDeg)) {
    if (typeof v === "number" && Number.isFinite(v)) anglesDeg[k] = v
  }
  let faults: string[] = []
  if (Array.isArray(o.faults)) faults = o.faults.filter((t): t is string => typeof t === "string" && !!t.trim())
  return {
    phase: o.phase === "top" || o.phase === "bottom" ? o.phase : phase,
    anglesDeg,
    faults,
  }
}
