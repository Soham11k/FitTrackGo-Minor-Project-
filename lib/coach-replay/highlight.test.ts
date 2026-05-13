import { describe, it, expect } from "vitest"
import { buildHighlightSegment } from "./highlight"

describe("buildHighlightSegment", () => {
  it("centers the window on the chosen rep marker", () => {
    const seg = buildHighlightSegment([1_000, 5_000, 12_000], 1, 20_000, 6_000)
    expect(seg).toEqual({ repIndex: 1, startMs: 2_000, endMs: 8_000 })
  })

  it("clamps at the start", () => {
    const seg = buildHighlightSegment([200, 1_000, 4_000], 0, 20_000, 6_000)
    expect(seg!.startMs).toBe(0)
    expect(seg!.endMs - seg!.startMs).toBeLessThanOrEqual(6_000)
  })

  it("clamps at the end", () => {
    const seg = buildHighlightSegment([10_000, 14_500, 19_500], 2, 20_000, 6_000)
    expect(seg!.endMs).toBe(20_000)
  })

  it("returns null with no markers", () => {
    expect(buildHighlightSegment([], 0, 10_000)).toBeNull()
  })
})
