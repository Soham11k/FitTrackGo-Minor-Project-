import { describe, it, expect } from "vitest"
import { analyzeForm, getRepPhase, type Landmark, type ExerciseId } from "./form-analysis"

/** Build a minimal landmark array (33 MediaPipe indices). */
function makeLandmarks(overrides: Partial<Record<number, Pick<Landmark, "x" | "y"> & Partial<Pick<Landmark, "z" | "visibility">>>> = {}): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }))
  for (const [idx, v] of Object.entries(overrides)) {
    const i = Number(idx)
    if (i >= 0 && i < 33) lm[i] = { ...lm[i], ...v }
  }
  return lm
}

describe("form-analysis", () => {
  describe("analyzeForm", () => {
    it("returns FormResult with feedback, isGoodForm, score, breakdown", () => {
      const lm = makeLandmarks()
      const result = analyzeForm(lm, "squat")
      expect(result).toHaveProperty("feedback")
      expect(result).toHaveProperty("isGoodForm")
      expect(result).toHaveProperty("score")
      expect(result).toHaveProperty("breakdown")
      expect(Array.isArray(result.feedback)).toBe(true)
      expect(Array.isArray(result.breakdown)).toBe(true)
      expect(typeof result.score).toBe("number")
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it("supports all exercise ids", () => {
      const ids: ExerciseId[] = [
        "squat", "pushup", "plank", "lunge", "bicep_curl",
        "shoulder_press", "jumping_jacks", "high_knees", "crunch",
      ]
      const lm = makeLandmarks()
      for (const id of ids) {
        const result = analyzeForm(lm, id)
        expect(result.feedback).toBeDefined()
        expect(result.breakdown).toBeDefined()
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(100)
      }
    })

    it("squat: good depth and knee angle can produce positive feedback", () => {
      // Hip below knee, knee ~80°
      const lm = makeLandmarks({
        23: { x: 0.5, y: 0.55 },
        24: { x: 0.52, y: 0.55 },
        25: { x: 0.48, y: 0.62 },
        26: { x: 0.54, y: 0.62 },
        27: { x: 0.46, y: 0.78 },
        28: { x: 0.56, y: 0.78 },
        11: { x: 0.45, y: 0.4 },
        12: { x: 0.55, y: 0.4 },
      })
      const result = analyzeForm(lm, "squat")
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.breakdown.length).toBeGreaterThan(0)
    })

    it("applies trackingQuality scale to the final score", () => {
      const lm = makeLandmarks()
      const full = analyzeForm(lm, "plank", { trackingQuality: 1 })
      const low = analyzeForm(lm, "plank", { trackingQuality: 0.1 })
      expect(full.trackingReliability).toBe(1)
      expect(low.trackingReliability).toBeLessThan(1)
      expect(low.score).toBeLessThanOrEqual(full.score)
    })

    it("world landmarks can change squat score vs image-only (3D path)", () => {
      const lm = makeLandmarks({
        23: { x: 0.5, y: 0.55, visibility: 1 },
        24: { x: 0.52, y: 0.55, visibility: 1 },
        25: { x: 0.48, y: 0.65, visibility: 1 },
        26: { x: 0.54, y: 0.65, visibility: 1 },
        27: { x: 0.46, y: 0.8, visibility: 1 },
        28: { x: 0.56, y: 0.8, visibility: 1 },
        11: { x: 0.45, y: 0.4, visibility: 1 },
        12: { x: 0.55, y: 0.4, visibility: 1 },
      })
      const world: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }))
      world[23] = { x: -0.1, y: 0, z: 0, visibility: 1 }
      world[24] = { x: 0.1, y: 0, z: 0, visibility: 1 }
      world[25] = { x: -0.1, y: -0.4, z: 0.1, visibility: 1 }
      world[26] = { x: 0.1, y: -0.4, z: 0.1, visibility: 1 }
      world[27] = { x: -0.1, y: -0.85, z: 0, visibility: 1 }
      world[28] = { x: 0.1, y: -0.85, z: 0, visibility: 1 }
      world[11] = { x: -0.1, y: 0.45, z: 0, visibility: 1 }
      world[12] = { x: 0.1, y: 0.45, z: 0, visibility: 1 }
      const a = analyzeForm(lm, "squat", { world: undefined })
      const b = analyzeForm(lm, "squat", { world })
      expect(a.score).toBeDefined()
      expect(b.score).toBeDefined()
      expect(b.breakdown[0].value).toMatch(/°/)
    })
  })

  describe("getRepPhase", () => {
    it("returns a phase for each exercise with reset true", () => {
      const phases = ["idle", "eccentric", "bottom", "concentric", "top"] as const
      const lm = makeLandmarks()
      const ids: ExerciseId[] = ["squat", "pushup", "plank", "lunge", "bicep_curl", "shoulder_press", "jumping_jacks", "high_knees", "crunch"]
      for (const id of ids) {
        const phase = getRepPhase(lm, id, true)
        expect(phases).toContain(phase)
      }
    })

    it("plank returns top or idle (hold exercise)", () => {
      const lm = makeLandmarks()
      const phase = getRepPhase(lm, "plank", true)
      expect(["top", "idle"]).toContain(phase)
    })
  })
})
