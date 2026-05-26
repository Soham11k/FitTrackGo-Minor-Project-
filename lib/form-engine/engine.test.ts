import { describe, it, expect } from "vitest"
import type { Landmark } from "../form-analysis"
import { analyzeSpec, getSpecRepPhase, resetSpecPhase } from "./engine"
import { listSpecIds, loadSpec } from "./registry"

function makeLandmarks(overrides: Partial<Record<number, Pick<Landmark, "x" | "y"> & Partial<Pick<Landmark, "z" | "visibility">>>> = {}): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))
  for (const [idx, v] of Object.entries(overrides)) {
    const i = Number(idx)
    if (i >= 0 && i < 33) lm[i] = { ...lm[i], ...v }
  }
  return lm
}

describe("form-engine registry", () => {
  it("loads every shipped spec", () => {
    const ids = listSpecIds()
    expect(ids.length).toBeGreaterThanOrEqual(40)
    for (const id of ids) {
      const spec = loadSpec(id)
      expect(spec).toBeDefined()
      expect(spec!.id).toBe(id)
      expect(Array.isArray(spec!.phases)).toBe(true)
      expect(spec!.phases.length).toBeGreaterThan(0)
    }
  })

  it("each spec has reasonable total possible penalty", () => {
    for (const id of listSpecIds()) {
      const spec = loadSpec(id)!
      const total = spec.rules.reduce((a, r) => a + r.penalty, 0)
      expect(total).toBeLessThanOrEqual(100)
    }
  })
})

describe("form-engine analyzeSpec", () => {
  it("returns a complete AnalyzeResult shape", () => {
    const spec = loadSpec("squat")!
    const lm = makeLandmarks()
    const r = analyzeSpec(spec, lm)
    expect(r).toHaveProperty("score")
    expect(r).toHaveProperty("feedback")
    expect(r).toHaveProperty("breakdown")
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(Array.isArray(r.feedback)).toBe(true)
    expect(Array.isArray(r.breakdown)).toBe(true)
    expect(Array.isArray(r.triggeredRules)).toBe(true)
  })

  it("applies tracking quality scale", () => {
    const spec = loadSpec("plank")!
    const lm = makeLandmarks()
    const full = analyzeSpec(spec, lm, { trackingQuality: 1 })
    const low = analyzeSpec(spec, lm, { trackingQuality: 0.1 })
    expect(low.score).toBeLessThanOrEqual(full.score)
  })

  it("returns score 0 when visibility is low", () => {
    const spec = loadSpec("squat")!
    const lm = makeLandmarks()
    for (let i = 0; i < lm.length; i++) lm[i].visibility = 0
    const r = analyzeSpec(spec, lm)
    expect(r.score).toBe(0)
    expect(r.isGoodForm).toBe(false)
  })

  it("squat: load relaxation widens depth tolerance under heavy load", () => {
    const spec = loadSpec("squat")!
    // Construct a frame that just barely fails the legacy depth rule.
    const lm = makeLandmarks({
      23: { x: 0.5, y: 0.55 },
      24: { x: 0.52, y: 0.55 },
      25: { x: 0.5, y: 0.57 },
      26: { x: 0.52, y: 0.57 },
      27: { x: 0.5, y: 0.78 },
      28: { x: 0.52, y: 0.78 },
      11: { x: 0.45, y: 0.4 },
      12: { x: 0.55, y: 0.4 },
    })
    const unloaded = analyzeSpec(spec, lm, { loadRatio: 0 })
    const heavy = analyzeSpec(spec, lm, { loadRatio: 1.2 })
    expect(heavy.score).toBeGreaterThanOrEqual(unloaded.score)
  })

  it("load.degraded meta-rule fires when scores collapse late in set", () => {
    const spec = loadSpec("squat")!
    const lm = makeLandmarks()
    const r = analyzeSpec(spec, lm, {
      bodyWeightKg: 80,
      loadKg: 80,
      recentRepScores: [95, 92, 90, 60, 55, 50],
    })
    expect(r.loadDegraded).toBe(true)
  })

  it("does not fire load.degraded when load ratio is low", () => {
    const spec = loadSpec("squat")!
    const lm = makeLandmarks()
    const r = analyzeSpec(spec, lm, {
      bodyWeightKg: 80,
      loadKg: 5,
      recentRepScores: [95, 92, 90, 60, 55, 50],
    })
    expect(r.loadDegraded).toBeFalsy()
  })

  it("loads and runs shallow analyze for new push-up variant specs", () => {
    for (const id of ["pushup_wide", "pushup_diamond", "pushup_knee", "pushup_incline"] as const) {
      const spec = loadSpec(id)!
      const lm = makeLandmarks()
      const r = analyzeSpec(spec, lm)
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(100)
      expect(Array.isArray(r.feedback)).toBe(true)
    }
  })
})

describe("form-engine getSpecRepPhase", () => {
  it("returns idle on reset", () => {
    const spec = loadSpec("squat")!
    expect(getSpecRepPhase(spec, makeLandmarks(), true)).toBe("idle")
  })

  it("plank always returns top (hold pattern)", () => {
    const spec = loadSpec("plank")!
    resetSpecPhase(spec)
    const lm = makeLandmarks()
    const phase = getSpecRepPhase(spec, lm, false)
    expect(phase).toBe("top")
  })

  it("squat: bottom phase fires when knees are deeply flexed", () => {
    const spec = loadSpec("squat")!
    resetSpecPhase(spec)
    // Side-view-ish geometry: hip behind knee, knee forward, ankle under hip.
    const deep = makeLandmarks({
      23: { x: 0.5, y: 0.5 },
      24: { x: 0.52, y: 0.5 },
      25: { x: 0.32, y: 0.55 },
      26: { x: 0.34, y: 0.55 },
      27: { x: 0.5, y: 0.6 },
      28: { x: 0.52, y: 0.6 },
    })
    // Stabilizer requires several consistent frames.
    let phase = ""
    for (let i = 0; i < 6; i++) phase = getSpecRepPhase(spec, deep, false)
    expect(phase).toBe("bottom")
  })
})
