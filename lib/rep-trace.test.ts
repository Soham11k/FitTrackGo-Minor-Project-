import { describe, it, expect } from "vitest"
import type { Landmark } from "./form-analysis"
import { aggregateTopFaults, parseRepTracesJson, captureRepTrace } from "./rep-trace"

function lm(): Landmark[] {
  const a = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))
  return a
}

describe("rep-trace", () => {
  it("captureRepTrace includes angles and phase", () => {
    const landmarks = lm()
    const t = captureRepTrace(landmarks, "deadlift", "bottom", {})
    expect(t.phase).toBe("bottom")
    expect(Object.keys(t.anglesDeg).length).toBeGreaterThan(0)
    expect(Array.isArray(t.faults)).toBe(true)
  })

  it("aggregateTopFaults ranks by frequency", () => {
    const traces = [
      {
        rep: 1,
        bottom: {
          phase: "bottom" as const,
          anglesDeg: { "knee.l": 120 },
          faults: ["A", "B"],
        },
        top: { phase: "top" as const, anglesDeg: {}, faults: [] },
      },
      {
        rep: 2,
        bottom: {
          phase: "bottom" as const,
          anglesDeg: {} as Record<string, number>,
          faults: ["A", "B"],
        },
        top: { phase: "top" as const, anglesDeg: {}, faults: [] },
      },
    ]
    expect(aggregateTopFaults(traces, 2)).toEqual(["A", "B"])
  })

  it("parseRepTracesJson tolerates partial garbage", () => {
    const parsed = parseRepTracesJson([
      null,
      { rep: 1, bottom: { anglesDeg: { a: 1 }, faults: [] }, top: { anglesDeg: { a: 2 }, faults: ["x"] } },
    ])
    expect(parsed).toHaveLength(1)
    expect(parsed[0].rep).toBe(1)
    expect(parsed[0].top.faults).toEqual(["x"])
  })
})
