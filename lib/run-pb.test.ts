import { describe, it, expect } from "vitest"
import { detectRunPersonalBest } from "./run-pb"

describe("detectRunPersonalBest", () => {
  it("flags distance PB", () => {
    expect(detectRunPersonalBest([{ distance: 5, pace: "6:30" }], { distanceKm: 6.1, pace: "6:10" })).toEqual({
      variant: "pb-distance",
    })
  })

  it("flags pace PB when distance qualifies", () => {
    expect(detectRunPersonalBest([{ distance: 5, pace: "6:10" }], { distanceKm: 5, pace: "5:40" })).toEqual({
      variant: "pb-pace",
    })
  })
})
