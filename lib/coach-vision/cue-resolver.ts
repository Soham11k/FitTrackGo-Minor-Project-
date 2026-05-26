/**
 * Map user-facing coaching text to skeleton highlight specs.
 */

import type { FormBreakdown, FormRegion } from "@/lib/form-analysis"
import type { FormFault } from "./faults"
import { regionToIndices, regionToSegmentPairs } from "./faults"
import { findVariantBySpecId } from "@/lib/coach-exercise-catalog"

export type HighlightKind = "improve" | "good"

export type HighlightSpec = {
  kind: HighlightKind
  label: string
  segmentPairs: [number, number][]
  landmarkIndices: number[]
  /** When resolved to a catalog fault id */
  faultId?: string
  fault?: FormFault
}

/** Stable React key for a cue string. */
export function cueKey(text: string, kind: HighlightKind): string {
  return `${kind}:${text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120)}`
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(norm(a).split(/[^a-z0-9]+/).filter((t) => t.length > 2))
  const tb = new Set(norm(b).split(/[^a-z0-9]+/).filter((t) => t.length > 2))
  if (!ta.size || !tb.size) return 0
  let hit = 0
  for (const t of ta) if (tb.has(t)) hit++
  return hit / Math.max(ta.size, tb.size)
}

/** Common fault phrases for fuzzy matching (subset of detectFaults copy). */
const FAULT_TEMPLATES: Array<{
  id: string
  label: string
  cue: string
  region: FormRegion
  severity: FormFault["severity"]
}> = [
  { id: "squat.shallow_depth", label: "Squat is too shallow", cue: "Go deeper — aim for knees at roughly 90°.", region: "legs", severity: "moderate" },
  { id: "squat.knee_valgus", label: "Knees caving inward", cue: "Push knees out, track over your toes.", region: "legs", severity: "moderate" },
  { id: "squat.torso_lean", label: "Torso is leaning forward", cue: "Chest up — keep your torso tall.", region: "torso", severity: "moderate" },
  { id: "hinge.round_back", label: "Bar drifting from mid-foot", cue: "Pull the bar straight up, close to your legs.", region: "torso", severity: "moderate" },
  { id: "hinge.too_much_knee", label: "Knees bending too much", cue: "It's a hinge — push hips back with only a soft knee bend.", region: "legs", severity: "minor" },
  { id: "plank.hip_sag", label: "Hips are sagging", cue: "Squeeze glutes — keep a straight line.", region: "core", severity: "moderate" },
  { id: "pushup.shallow", label: "Shallow elbow bend", cue: "Lower deeper — aim for chest near the floor.", region: "arms", severity: "moderate" },
  { id: "pushup.hip_pike", label: "Hips too high", cue: "Lower your hips — form a straight line.", region: "core", severity: "minor" },
  { id: "lunge.short_step", label: "Step is too short", cue: "Step forward further — aim for 90° front knee.", region: "legs", severity: "minor" },
  { id: "curl.elbow_drift", label: "Elbows drifting forward", cue: "Keep elbows pinned at your sides.", region: "arms", severity: "minor" },
  { id: "press.arch", label: "Lower back arching", cue: "Brace core — keep ribs down as you press.", region: "torso", severity: "moderate" },
]

const REGION_KEYWORDS: Array<{ region: FormRegion; words: string[] }> = [
  { region: "legs", words: ["knee", "knees", "squat", "lunge", "ankle", "depth", "valgus", "cave"] },
  { region: "arms", words: ["elbow", "elbows", "curl", "press", "wrist", "arm"] },
  { region: "torso", words: ["torso", "chest", "back", "lean", "spine", "bar", "rib"] },
  { region: "core", words: ["hip", "hips", "plank", "core", "glute", "sag", "pike"] },
]

function inferRegionFromText(text: string): FormRegion {
  const n = norm(text)
  let best: FormRegion = "torso"
  let bestScore = 0
  for (const { region, words } of REGION_KEYWORDS) {
    let score = 0
    for (const w of words) if (n.includes(w)) score++
    if (score > bestScore) {
      bestScore = score
      best = region
    }
  }
  return best
}

function specFromRegion(region: FormRegion, label: string, kind: HighlightKind, faultId?: string): HighlightSpec {
  return {
    kind,
    label,
    segmentPairs: regionToSegmentPairs(region),
    landmarkIndices: regionToIndices(region),
    faultId,
  }
}

function templateToFault(t: (typeof FAULT_TEMPLATES)[number]): FormFault {
  return {
    id: t.id,
    label: t.label,
    cue: t.cue,
    region: t.region,
    severity: t.severity,
    landmarkIndices: regionToIndices(t.region),
    segmentPairs: regionToSegmentPairs(t.region),
  }
}

function matchTemplate(cueText: string): (typeof FAULT_TEMPLATES)[number] | null {
  const n = norm(cueText)
  let best: (typeof FAULT_TEMPLATES)[number] | null = null
  let bestScore = 0.35
  for (const t of FAULT_TEMPLATES) {
    const s = Math.max(tokenOverlap(n, t.label), tokenOverlap(n, t.cue), tokenOverlap(n, t.id))
    if (s > bestScore) {
      bestScore = s
      best = t
    }
  }
  return best
}

function matchBreakdown(
  cueText: string,
  breakdown: FormBreakdown[] | undefined,
  wantOk: boolean,
): FormBreakdown | null {
  if (!breakdown?.length) return null
  const n = norm(cueText)
  let best: FormBreakdown | null = null
  let bestScore = 0.4
  for (const b of breakdown) {
    if (b.ok !== wantOk) continue
    const hay = norm(`${b.label} ${b.value} ${b.detail ?? ""}`)
    const s = tokenOverlap(n, hay)
    if (s > bestScore) {
      bestScore = s
      best = b
    }
  }
  return best
}

export function resolveImproveHighlight(
  cueText: string,
  exerciseId: string,
  breakdown?: FormBreakdown[],
): HighlightSpec | null {
  const trimmed = cueText.trim()
  if (!trimmed) return null

  const template = matchTemplate(trimmed)
  if (template) {
    const fault = templateToFault(template)
    return {
      kind: "improve",
      label: trimmed,
      segmentPairs: fault.segmentPairs ?? regionToSegmentPairs(fault.region),
      landmarkIndices: fault.landmarkIndices,
      faultId: fault.id,
      fault,
    }
  }

  const badRow = matchBreakdown(trimmed, breakdown, false)
  if (badRow?.region) {
    return specFromRegion(badRow.region, badRow.label, "improve", `breakdown.${badRow.region}`)
  }

  const region = inferRegionFromText(trimmed)
  const found = findVariantBySpecId(exerciseId)
  if (found?.variant.tips?.length) {
    for (const tip of found.variant.tips) {
      if (tokenOverlap(trimmed, tip) > 0.35) {
        return specFromRegion(region, trimmed, "improve")
      }
    }
  }

  return specFromRegion(region, trimmed, "improve")
}

export function resolveGoodHighlight(
  cueText: string,
  exerciseId: string,
  breakdown?: FormBreakdown[],
): HighlightSpec | null {
  const trimmed = cueText.trim()
  if (!trimmed) return null

  const goodRow = matchBreakdown(trimmed, breakdown, true)
  if (goodRow?.region) {
    return specFromRegion(goodRow.region, goodRow.label, "good", `good.${goodRow.region}`)
  }

  const region = inferRegionFromText(trimmed)
  const found = findVariantBySpecId(exerciseId)
  if (found?.variant.tips?.length) {
    for (const tip of found.variant.tips) {
      if (tokenOverlap(trimmed, tip) > 0.3) {
        return specFromRegion(region, trimmed, "good")
      }
    }
  }

  return specFromRegion(region, trimmed, "good")
}

export function resolveHighlight(
  cueText: string,
  kind: HighlightKind,
  exerciseId: string,
  breakdown?: FormBreakdown[],
): HighlightSpec | null {
  return kind === "good"
    ? resolveGoodHighlight(cueText, exerciseId, breakdown)
    : resolveImproveHighlight(cueText, exerciseId, breakdown)
}
