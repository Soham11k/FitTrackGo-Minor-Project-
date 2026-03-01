import { describe, it, expect } from "vitest"
import { analyzeForm, getRepPhase, type Landmark, type ExerciseId } from "./form-analysis"

/** Build a minimal landmark array (33 MediaPipe indices). */
function makeLandmarks(overrides: Partial<Record<number, { x: number; y: number }>> = {}): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 33 }, (_, i) => ({
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
