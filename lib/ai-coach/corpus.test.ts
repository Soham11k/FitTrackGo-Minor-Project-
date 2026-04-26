import { describe, it, expect } from "vitest"
import { buildCoachCorpus } from "./corpus"

describe("buildCoachCorpus", () => {
  it("includes exercise tips and general policy chunks", () => {
    const c = buildCoachCorpus()
    expect(c.length).toBeGreaterThan(10)
    expect(c.some((x) => x.exerciseId === "general" && x.text.includes("MediaPipe"))).toBe(true)
    expect(c.some((x) => x.exerciseId === "squat")).toBe(true)
  })
})
