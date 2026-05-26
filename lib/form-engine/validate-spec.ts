/**
 * Server/client validation for FormSpec JSON (built-in or AI-generated).
 */

import type { Landmark } from "../form-analysis"
import { analyzeSpec } from "./engine"
import type { Condition, FormSpec, LoadType, RuleDef } from "./types"
import { hasSpec as hasBuiltinSpec } from "./registry"

const METRIC_IDS: Set<string> = new Set([
  "knee_angle_avg",
  "knee_angle_left",
  "knee_angle_right",
  "knee_angle_min",
  "knee_angle_max",
  "elbow_angle_avg",
  "elbow_angle_left",
  "elbow_angle_right",
  "back_angle_avg",
  "hip_hinge_avg",
  "shoulder_angle_avg",
  "shoulder_y_avg",
  "hip_y_avg",
  "knee_y_avg",
  "wrist_y_avg",
  "ankle_y_avg",
  "nose_y",
  "depth_ratio",
  "hip_sag_y",
  "body_line_deviation",
  "knee_tracking_x",
  "shoulder_width_x",
  "elbow_flare_ratio",
  "knee_symmetry_diff",
  "elbow_symmetry_diff",
  "wrist_spread_x",
  "ankle_spread_x",
  "total_spread_x",
  "bar_drift_x",
  "shoulder_hip_y_delta",
  "load_ratio",
])

const PHASE_NAMES: Set<string> = new Set(["idle", "eccentric", "bottom", "concentric", "top"])
const LOAD_TYPES: Set<string> = new Set(["none", "bodyweight", "external"])
const REP_PATTERNS: Set<string> = new Set(["top_bottom_top", "bottom_top_bottom", "hold"])

export type ValidateSpecResult =
  | { ok: true; spec: FormSpec }
  | { ok: false; errors: string[] }

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

function validateCondition(c: unknown, path: string, errors: string[]): void {
  if (!isObject(c)) {
    errors.push(`${path}: must be an object`)
    return
  }
  if ("all" in c && Array.isArray(c.all)) {
    c.all.forEach((child, i) => validateCondition(child, `${path}.all[${i}]`, errors))
    return
  }
  if ("any" in c && Array.isArray(c.any)) {
    c.any.forEach((child, i) => validateCondition(child, `${path}.any[${i}]`, errors))
    return
  }
  if ("not" in c) {
    validateCondition(c.not, `${path}.not`, errors)
    return
  }
  const metric = c.metric
  const op = c.op
  if (typeof metric !== "string" || !METRIC_IDS.has(metric)) {
    errors.push(`${path}: invalid metric ${String(metric)}`)
  }
  if (typeof op !== "string" || !["<", "<=", ">", ">=", "between"].includes(op)) {
    errors.push(`${path}: invalid op ${String(op)}`)
  }
  if (typeof c.value !== "number" || !Number.isFinite(c.value)) {
    errors.push(`${path}: value must be a finite number`)
  }
}

function validateRule(r: unknown, i: number, errors: string[]): void {
  const path = `rules[${i}]`
  if (!isObject(r)) {
    errors.push(`${path}: must be an object`)
    return
  }
  if (typeof r.id !== "string" || !r.id.trim()) errors.push(`${path}.id required`)
  if (typeof r.feedback !== "string" || !r.feedback.trim()) errors.push(`${path}.feedback required`)
  const penalty = r.penalty
  if (typeof penalty !== "number" || penalty < 1 || penalty > 20) {
    errors.push(`${path}.penalty must be 1–20`)
  }
  validateCondition(r.when, `${path}.when`, errors)
}

/** Neutral standing pose for dry-run analyzeSpec. */
export function neutralLandmarks(): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))
  const pts: Record<number, { x: number; y: number }> = {
    0: { x: 0.5, y: 0.12 },
    11: { x: 0.42, y: 0.28 },
    12: { x: 0.58, y: 0.28 },
    13: { x: 0.38, y: 0.42 },
    14: { x: 0.62, y: 0.42 },
    15: { x: 0.36, y: 0.55 },
    16: { x: 0.64, y: 0.55 },
    23: { x: 0.44, y: 0.52 },
    24: { x: 0.56, y: 0.52 },
    25: { x: 0.44, y: 0.68 },
    26: { x: 0.56, y: 0.68 },
    27: { x: 0.44, y: 0.85 },
    28: { x: 0.56, y: 0.85 },
  }
  for (const [idx, p] of Object.entries(pts)) {
    const i = Number(idx)
    lm[i] = { ...lm[i], ...p, visibility: 1 }
  }
  return lm
}

export function slugifySpecId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
  return base || "movement"
}

export function buildCustomSpecId(displayName: string): string {
  const slug = slugifySpecId(displayName)
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 6)
      : Math.random().toString(36).slice(2, 8)
  return `custom_${slug}_${suffix}`
}

export function validateFormSpec(raw: unknown, forcedId?: string): ValidateSpecResult {
  const errors: string[] = []
  if (!isObject(raw)) {
    return { ok: false, errors: ["Root must be a JSON object"] }
  }

  const id = typeof forcedId === "string" ? forcedId : typeof raw.id === "string" ? raw.id : ""
  if (!id.trim()) errors.push("id is required")
  if (id && !/^custom_[a-z0-9_]+$/.test(id) && !hasBuiltinSpec(id)) {
    errors.push("id must be a registered built-in id or custom_<slug>_<suffix>")
  }

  const displayName = raw.displayName
  if (typeof displayName !== "string" || !displayName.trim()) {
    errors.push("displayName is required")
  }

  const category = raw.category
  if (typeof category !== "string" || !category.trim()) errors.push("category is required")

  const loadType = raw.loadType
  if (typeof loadType !== "string" || !LOAD_TYPES.has(loadType)) {
    errors.push("loadType must be none | bodyweight | external")
  }

  if (!Array.isArray(raw.requiredLandmarks) || raw.requiredLandmarks.length < 4) {
    errors.push("requiredLandmarks must be an array of at least 4 indices")
  } else {
    for (const n of raw.requiredLandmarks) {
      if (typeof n !== "number" || n < 0 || n > 32 || !Number.isInteger(n)) {
        errors.push("requiredLandmarks indices must be integers 0–32")
        break
      }
    }
  }

  const visibleFraction = raw.visibleFraction
  if (typeof visibleFraction !== "number" || visibleFraction < 0.2 || visibleFraction > 1) {
    errors.push("visibleFraction must be between 0.2 and 1")
  }

  if (!Array.isArray(raw.rules) || raw.rules.length < 1) {
    errors.push("rules must be a non-empty array")
  } else {
    if (raw.rules.length > 8) errors.push("rules: max 8 rules")
    let penaltySum = 0
    raw.rules.forEach((r, i) => {
      validateRule(r, i, errors)
      if (isObject(r) && typeof r.penalty === "number") penaltySum += r.penalty
    })
    if (penaltySum > 80) errors.push(`total rule penalties (${penaltySum}) must be ≤ 80`)
  }

  if (!Array.isArray(raw.phases) || raw.phases.length < 1) {
    errors.push("phases must be a non-empty array")
  } else {
    for (let i = 0; i < raw.phases.length; i++) {
      const p = raw.phases[i]
      if (!isObject(p)) {
        errors.push(`phases[${i}] must be an object`)
        continue
      }
      if (typeof p.name !== "string" || !PHASE_NAMES.has(p.name)) {
        errors.push(`phases[${i}].name invalid`)
      }
      if (p.enterWhen) validateCondition(p.enterWhen, `phases[${i}].enterWhen`, errors)
      if (p.exitWhen) validateCondition(p.exitWhen, `phases[${i}].exitWhen`, errors)
    }
  }

  if (raw.repPattern != null && (typeof raw.repPattern !== "string" || !REP_PATTERNS.has(raw.repPattern))) {
    errors.push("repPattern invalid")
  }

  if (errors.length) return { ok: false, errors }

  const spec: FormSpec = {
    id: id.trim(),
    displayName: String(displayName).trim(),
    category: String(category).trim(),
    loadType: loadType as LoadType,
    requiredLandmarks: raw.requiredLandmarks as number[],
    visibleFraction: visibleFraction as number,
    rules: raw.rules as RuleDef[],
    phases: raw.phases as FormSpec["phases"],
    positiveLine: typeof raw.positiveLine === "string" ? raw.positiveLine : undefined,
    repPattern: raw.repPattern as FormSpec["repPattern"],
    hudAngles: Array.isArray(raw.hudAngles) ? (raw.hudAngles as FormSpec["hudAngles"]) : undefined,
  }

  try {
    analyzeSpec(spec, neutralLandmarks(), { trackingQuality: 1 })
  } catch (e) {
    errors.push(`engine dry-run failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, spec }
}

export function collectMetricIdsFromCondition(c: Condition, out: Set<string>): void {
  if ("all" in c && c.all) {
    c.all.forEach((child) => collectMetricIdsFromCondition(child, out))
    return
  }
  if ("any" in c && c.any) {
    c.any.forEach((child) => collectMetricIdsFromCondition(child, out))
    return
  }
  if ("not" in c && c.not) {
    collectMetricIdsFromCondition(c.not, out)
    return
  }
  if ("metric" in c) out.add(c.metric)
}
