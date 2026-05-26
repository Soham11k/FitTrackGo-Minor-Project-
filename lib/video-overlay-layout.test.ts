import { describe, it, expect } from "vitest"
import { getObjectFitContentRect } from "./video-overlay-layout"

describe("getObjectFitContentRect", () => {
  it("letterboxes wide video in a tall container (contain)", () => {
    const r = getObjectFitContentRect(400, 300, 1600, 900, "contain")
    expect(r.w).toBe(400)
    expect(r.h).toBe(225)
    expect(r.x).toBe(0)
    expect(r.y).toBeCloseTo(37.5, 1)
  })

  it("crops sides for cover when video is wider than container", () => {
    const r = getObjectFitContentRect(400, 300, 1600, 900, "cover")
    expect(r.h).toBe(300)
    expect(r.w).toBeCloseTo(533.33, 1)
    expect(r.x).toBeLessThan(0)
  })
})
