import { describe, it, expect } from "vitest"
import { resolveGoodHighlight, resolveImproveHighlight, type HighlightSpec } from "./cue-resolver"
import { regionToSegmentPairs } from "./faults"

describe("cue-resolver: improve highlights", () => {
  it("maps cue text → a template fault id", () => {
    const spec = resolveImproveHighlight("Knees caving inward", "squat")
    expect(spec).not.toBeNull()
    expect(spec!.kind).toBe("improve")
    expect(spec!.faultId).toBe("squat.knee_valgus")
    expect(spec!.segmentPairs.length).toBeGreaterThan(0)
  })

  it("falls back to breakdown region → region segmentPairs", () => {
    const breakdown = [
      {
        label: "Depth short",
        value: "Higher depth",
        ok: false,
        region: "legs",
      },
    ] as const

    const spec = resolveImproveHighlight("Depth short", "squat", breakdown as any) as HighlightSpec | null
    expect(spec).not.toBeNull()
    expect(spec!.faultId).toBe("breakdown.legs")
    expect(spec!.segmentPairs).toEqual(regionToSegmentPairs("legs"))
  })
})

describe("cue-resolver: good vs improve", () => {
  it("good highlight prefers ok=true breakdown row", () => {
    const breakdown = [
      {
        label: "Back",
        value: "Neutral",
        ok: true,
        region: "torso",
      },
    ] as const

    const spec = resolveGoodHighlight("Back Neutral", "squat", breakdown as any)
    expect(spec).not.toBeNull()
    expect(spec!.kind).toBe("good")
    expect(spec!.faultId).toBe("good.torso")
    expect(spec!.segmentPairs).toEqual(regionToSegmentPairs("torso"))
  })
})

