import { VIS_FORM_ANALYSIS, VIS_EXERCISE_GATE } from "../pose-config"
import type { Landmark } from "../form-analysis"
import { evalCondition } from "./dsl"
import { computeMetrics } from "./metrics"
import type { AnalyzeContext, AnalyzeResult, FormSpec, LandmarkBag, MetricId, PhaseName, RuleDef } from "./types"

function applyTrackingScale(rawScore: number, trackingQuality: number | undefined): { score: number; trackingReliability: number } {
  if (trackingQuality === undefined || Number.isNaN(trackingQuality)) {
    return { score: rawScore, trackingReliability: 1 }
  }
  const t = Math.max(0, Math.min(1, trackingQuality))
  const reliability = 0.32 + 0.68 * t
  return { score: Math.round(rawScore * reliability), trackingReliability: reliability }
}

function hasEnoughVisibility(lm: Landmark[], spec: FormSpec): boolean {
  if (!lm?.length) return false
  let sum = 0
  let n = 0
  for (const i of spec.requiredLandmarks) {
    sum += lm[i]?.visibility ?? 0
    n += 1
  }
  return n > 0 && sum / n >= VIS_FORM_ANALYSIS
}

export function hasEnoughVisibilityForSpec(lm: Landmark[], spec: FormSpec): boolean {
  if (!lm?.length) return false
  const indices = spec.requiredLandmarks
  let visible = 0
  for (const i of indices) {
    if ((lm[i]?.visibility ?? 0) > VIS_EXERCISE_GATE) visible += 1
  }
  const required = Math.max(1, Math.ceil(indices.length * (spec.visibleFraction ?? 0.7)))
  return visible >= required
}

function formatValue(metric: MetricId | undefined, metrics: Partial<Record<MetricId, number>>, format: "angle" | "text" | "boolean", okLabel?: string, failLabel?: string, ok?: boolean): string {
  if (format === "angle" && metric !== undefined) {
    const v = metrics[metric]
    if (v === undefined) return "—"
    return `${Math.round(v)}\u00B0`
  }
  if (format === "boolean" || format === "text") {
    return ok ? okLabel ?? "Good" : failLabel ?? "Adjust"
  }
  return "—"
}

export interface AnalyzeOptions extends AnalyzeContext {
  /** MediaPipe world landmarks (for 3D angles when available). */
  world?: Landmark[]
  /** Tracking quality 0–1 (down-weights the final score). */
  trackingQuality?: number
}

/**
 * Analyze a frame against a FormSpec. Returns a score, feedback list,
 * breakdown rows, and triggered rule ids. Compatible with `FormResult`.
 */
export function analyzeSpec(spec: FormSpec, lm: Landmark[], opts: AnalyzeOptions = {}): AnalyzeResult {
  if (!hasEnoughVisibility(lm, spec)) {
    return {
      feedback: ["Position yourself in frame"],
      isGoodForm: false,
      score: 0,
      breakdown: [],
      trackingReliability: 0,
      triggeredRules: [],
    }
  }

  const bag: LandmarkBag = { image: lm, world: opts.world }
  const loadRatio = computeLoadRatio(opts)
  const metrics = computeMetrics(bag, loadRatio)

  let score = 100
  const feedback: string[] = []
  const triggered: string[] = []
  const breakdownRows: AnalyzeResult["breakdown"] = []

  for (const rule of spec.rules) {
    const fired = evalCondition(rule.when, metrics, loadRatio, rule.loadRelax)
    if (fired) {
      triggered.push(rule.id)
      score -= rule.penalty
      if (rule.feedback) feedback.push(rule.feedback)
    }
    pushBreakdown(rule, fired, metrics, breakdownRows)
  }

  // Optional "load.degraded" meta rule: emitted when recent reps fall sharply under load.
  let loadDegraded = false
  if (opts.recentRepScores && opts.recentRepScores.length >= 6 && (loadRatio ?? 0) >= 0.6) {
    const n = opts.recentRepScores.length
    const first3 = opts.recentRepScores.slice(0, 3)
    const last3 = opts.recentRepScores.slice(n - 3, n)
    const meanFirst = first3.reduce((a, b) => a + b, 0) / first3.length
    const meanLast = last3.reduce((a, b) => a + b, 0) / last3.length
    if (meanFirst - meanLast >= 20) {
      loadDegraded = true
      feedback.push("Form is breaking down under load — drop the weight a notch")
      score -= 8
      triggered.push("load.degraded")
    }
  }

  if (feedback.length === 0 && spec.positiveLine) feedback.push(spec.positiveLine)

  score = Math.max(0, Math.min(100, score))
  const { score: finalScore, trackingReliability } = applyTrackingScale(score, opts.trackingQuality)
  if (opts.trackingQuality !== undefined && opts.trackingQuality < 0.42) {
    feedback.unshift("Track quality is low — stay centered and add light for a truer score.")
  }

  return {
    feedback,
    isGoodForm: finalScore >= 80,
    score: finalScore,
    breakdown: breakdownRows,
    trackingReliability,
    triggeredRules: triggered,
    loadDegraded,
  }
}

function pushBreakdown(
  rule: RuleDef,
  fired: boolean,
  metrics: Partial<Record<MetricId, number>>,
  out: AnalyzeResult["breakdown"]
) {
  const b = rule.breakdown
  if (!b) return
  const okFromWhen = b.whenOk === undefined ? !fired : true
  const ok = b.whenOk ? !!okFromWhen : !fired
  const region = b.region as string | undefined
  out.push({
    label: b.label,
    value: formatValue(b.metric, metrics, b.format, b.okLabel, b.failLabel, ok),
    ok,
    detail: b.detail,
    region: region === "global" ? undefined : (b.region as Exclude<typeof b.region, "global">),
  })
}

function computeLoadRatio(opts: AnalyzeContext): number | undefined {
  if (opts.loadRatio !== undefined && Number.isFinite(opts.loadRatio)) return opts.loadRatio
  if (opts.loadKg !== undefined && opts.bodyWeightKg && opts.bodyWeightKg > 0) {
    return opts.loadKg / opts.bodyWeightKg
  }
  return undefined
}

/* ---------------------- Phase detection (spec-driven) --------------------- */

type PhaseStore = {
  last: PhaseName
  history: PhaseName[]
}

const PHASE_HISTORY_LEN = 9
const PHASE_CONSISTENCY_REQUIRED = 3

/**
 * Per-spec phase memory keyed by spec id. The legacy form-analysis.ts uses
 * a single module-level store; we maintain a parallel one for spec-driven flow.
 */
const STORE = new Map<string, PhaseStore>()

function stabilizePhase(spec: FormSpec, newPhase: PhaseName): PhaseName {
  const s = STORE.get(spec.id) ?? { last: "idle", history: [] }
  s.history.push(newPhase)
  if (s.history.length > PHASE_HISTORY_LEN) s.history.shift()
  if (s.history.length >= PHASE_CONSISTENCY_REQUIRED) {
    const recent = s.history.slice(-PHASE_CONSISTENCY_REQUIRED)
    const counts: Record<string, number> = {}
    recent.forEach((p) => { counts[p] = (counts[p] ?? 0) + 1 })
    const mostCommon = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? s.last) as PhaseName
    if (mostCommon !== s.last && (counts[mostCommon] ?? 0) >= PHASE_CONSISTENCY_REQUIRED) {
      s.last = mostCommon
    }
  } else {
    s.last = newPhase
  }
  STORE.set(spec.id, s)
  return s.last
}

export function resetSpecPhase(spec: FormSpec): void {
  STORE.set(spec.id, { last: "idle", history: [] })
}

/**
 * Returns the next phase for this spec given the current landmarks.
 *
 * A spec describes phases by `enterWhen`. We pick the first phase whose
 * `enterWhen` evaluates true; if none, the previous phase is held.
 * "Hold" repPattern (e.g. plank) is forced to "top".
 */
export function getSpecRepPhase(spec: FormSpec, lm: Landmark[], reset = false): PhaseName {
  if (reset) {
    resetSpecPhase(spec)
    return "idle"
  }
  if (spec.repPattern === "hold") return stabilizePhase(spec, "top")

  const bag: LandmarkBag = { image: lm }
  const metrics = computeMetrics(bag)
  // Order is significant: list phases bottom -> top so we match the deepest first.
  let next: PhaseName | undefined
  for (const ph of spec.phases) {
    if (ph.always) {
      next = ph.name
      break
    }
    if (ph.enterWhen && evalCondition(ph.enterWhen, metrics, undefined, undefined)) {
      next = ph.name
      break
    }
  }
  if (!next) {
    const prev = STORE.get(spec.id)?.last ?? "idle"
    next = prev === "idle" ? "top" : prev
  }
  return stabilizePhase(spec, next)
}
