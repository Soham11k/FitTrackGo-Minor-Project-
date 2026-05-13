import { describe, it, expect } from "vitest"
import { normalize, type ClipReviewResult } from "./clip-review"

describe("clip-review normalize", () => {
  it("clamps repIndex and score to valid ranges", () => {
    const out = normalize(
      {
        summary: "ok",
        perRepFaults: [
          { repIndex: -2, score: 250, faults: ["a", "b"] },
          { repIndex: 99, score: -10, faults: ["c"] },
        ],
        topThreeFixes: ["x", "y", "z", "extra"],
        highlightRepIndex: 99,
      },
      3
    )
    expect(out.perRepFaults[0]).toEqual({ repIndex: 0, score: 100, faults: ["a", "b"] })
    expect(out.perRepFaults[1]).toEqual({ repIndex: 2, score: 0, faults: ["c"] })
    expect(out.topThreeFixes).toEqual(["x", "y", "z"])
    expect(out.highlightRepIndex).toBe(2)
  })

  it("handles missing fields", () => {
    const out: ClipReviewResult = normalize({}, 5)
    expect(out.summary).toBe("")
    expect(out.perRepFaults).toEqual([])
    expect(out.topThreeFixes).toEqual([])
    expect(out.highlightRepIndex).toBe(0)
  })

  it("filters non-string faults and fixes", () => {
    const out = normalize(
      {
        summary: "x",
        perRepFaults: [{ repIndex: 0, score: 50, faults: ["a", 1, null, "b"] }],
        topThreeFixes: [1, "b", null, "c"],
      },
      2
    )
    expect(out.perRepFaults[0].faults).toEqual(["a", "b"])
    expect(out.topThreeFixes).toEqual(["b", "c"])
  })
})
