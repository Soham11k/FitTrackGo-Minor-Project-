import { describe, it, expect } from "vitest"
import { evalCondition } from "./dsl"
import type { Condition } from "./types"

describe("form-engine DSL", () => {
  it("evaluates a simple compare condition", () => {
    const c: Condition = { metric: "knee_angle_avg", op: ">", value: 90 }
    expect(evalCondition(c, { knee_angle_avg: 100 }, undefined, undefined)).toBe(true)
    expect(evalCondition(c, { knee_angle_avg: 80 }, undefined, undefined)).toBe(false)
  })

  it("returns false when metric is missing", () => {
    const c: Condition = { metric: "knee_angle_avg", op: ">", value: 90 }
    expect(evalCondition(c, {}, undefined, undefined)).toBe(false)
  })

  it("evaluates all/any/not", () => {
    const allC: Condition = {
      all: [
        { metric: "knee_angle_avg", op: ">", value: 80 },
        { metric: "knee_angle_avg", op: "<", value: 100 },
      ],
    }
    expect(evalCondition(allC, { knee_angle_avg: 90 }, undefined, undefined)).toBe(true)
    expect(evalCondition(allC, { knee_angle_avg: 70 }, undefined, undefined)).toBe(false)

    const anyC: Condition = {
      any: [
        { metric: "knee_angle_avg", op: "<", value: 70 },
        { metric: "knee_angle_avg", op: ">", value: 130 },
      ],
    }
    expect(evalCondition(anyC, { knee_angle_avg: 50 }, undefined, undefined)).toBe(true)
    expect(evalCondition(anyC, { knee_angle_avg: 100 }, undefined, undefined)).toBe(false)

    const notC: Condition = { not: { metric: "knee_angle_avg", op: ">", value: 100 } }
    expect(evalCondition(notC, { knee_angle_avg: 90 }, undefined, undefined)).toBe(true)
  })

  it("evaluates between op", () => {
    const c: Condition = { metric: "knee_angle_avg", op: "between", value: 70, hi: 110 }
    expect(evalCondition(c, { knee_angle_avg: 90 }, undefined, undefined)).toBe(true)
    expect(evalCondition(c, { knee_angle_avg: 60 }, undefined, undefined)).toBe(false)
    expect(evalCondition(c, { knee_angle_avg: 120 }, undefined, undefined)).toBe(false)
  })

  it("applies load relaxation to thresholds", () => {
    const c: Condition = { metric: "depth_ratio", op: "<=", value: 0.1 }
    expect(evalCondition(c, { depth_ratio: 0.11 }, 1.2, { perXBodyweight: 1.0, addThresholdDeg: 0.05 })).toBe(true)
    expect(evalCondition(c, { depth_ratio: 0.11 }, 0.0, { perXBodyweight: 1.0, addThresholdDeg: 0.05 })).toBe(false)
  })
})
