import { describe, it, expect } from "vitest"
import { buildLocalRepFeedback, mergeFaultsFromTrace } from "./rep-feedback-local"
import type { RepTracePair } from "@/lib/rep-trace"

describe("mergeFaultsFromTrace", () => {
  it("dedupes bottom and top faults", () => {
    const pair: RepTracePair = {
      rep: 1,
      bottom: { phase: "bottom", anglesDeg: {}, faults: ["Knees in", ""] },
      top: { phase: "top", anglesDeg: {}, faults: ["Knees in", "Rush lockout"] },
    }
    expect(mergeFaultsFromTrace(pair)).toEqual(["Knees in", "Rush lockout"])
  })
})

describe("buildLocalRepFeedback", () => {
  it("maps faults to improve and adds good when clean", () => {
    const traces: RepTracePair[] = [
      {
        rep: 1,
        bottom: { phase: "bottom", anglesDeg: {}, faults: ["Depth short"] },
        top: { phase: "top", anglesDeg: {}, faults: [] },
      },
      {
        rep: 2,
        bottom: { phase: "bottom", anglesDeg: {}, faults: [] },
        top: { phase: "top", anglesDeg: {}, faults: [] },
      },
    ]
    const out = buildLocalRepFeedback(2, traces, [70, 85], "squat")
    expect(out[0].improve).toEqual(["Depth short"])
    expect(out[0].good.length).toBeGreaterThan(0)
    expect(out[1].improve).toEqual([])
    expect(out[1].good.length).toBeGreaterThan(0)
  })
})
