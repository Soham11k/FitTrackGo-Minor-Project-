import { describe, it, expect } from "vitest"
import { anglesInBands, HoldScorer } from "./scorer"

describe("mobility scorer", () => {
  it("anglesInBands checks every configured key", () => {
    expect(anglesInBands({ "knee.l": 90, "knee.r": 92 }, { "knee.l": [80, 100], "knee.r": [80, 100] })).toBe(true)
    expect(anglesInBands({ "knee.l": 40, "knee.r": 92 }, { "knee.l": [80, 100], "knee.r": [80, 100] })).toBe(false)
  })

  it("HoldScorer accumulates only in-band", () => {
    const h = new HoldScorer(10)
    h.tick(true, 2)
    h.tick(false, 5)
    h.tick(true, 3)
    expect(h.secondsHeld()).toBe(5)
    expect(h.scorePct()).toBe(50)
  })
})
