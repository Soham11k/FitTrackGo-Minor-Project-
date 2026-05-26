import { describe, it, expect } from "vitest"
import squat from "@/data/form-specs/squat.json"
import { buildCustomSpecId, neutralLandmarks, validateFormSpec } from "./validate-spec"
import { analyzeSpec } from "./engine"
import type { FormSpec } from "./types"

describe("validateFormSpec", () => {
  it("accepts built-in squat when id matches", () => {
    const result = validateFormSpec(squat, "squat")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.spec.id).toBe("squat")
      analyzeSpec(result.spec, neutralLandmarks(), { trackingQuality: 1 })
    }
  })

  it("rejects invalid metric ids", () => {
    const bad = {
      ...(squat as FormSpec),
      id: "custom_bad_metric_abc123",
      rules: [
        {
          id: "x",
          region: "legs",
          penalty: 10,
          when: { metric: "not_a_metric", op: "<", value: 5 },
          feedback: "Fix it",
        },
      ],
    }
    const result = validateFormSpec(bad, "custom_bad_metric_abc123")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => /metric/i.test(e))).toBe(true)
    }
  })

  it("rejects penalty sum over 80", () => {
    const heavy = {
      ...(squat as FormSpec),
      id: "custom_heavy_penalty_abc123",
      rules: Array.from({ length: 6 }, (_, i) => ({
        id: `r${i}`,
        region: "legs" as const,
        penalty: 15,
        when: { metric: "knee_angle_avg" as const, op: "<" as const, value: 50 },
        feedback: "Cue",
      })),
    }
    const result = validateFormSpec(heavy, "custom_heavy_penalty_abc123")
    expect(result.ok).toBe(false)
  })

  it("buildCustomSpecId uses custom_ prefix", () => {
    const id = buildCustomSpecId("Band Pull Apart")
    expect(id).toMatch(/^custom_band_pull_apart_[a-z0-9]+$/)
  })
})
