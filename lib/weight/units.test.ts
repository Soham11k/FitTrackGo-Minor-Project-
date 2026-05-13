import { describe, it, expect } from "vitest"
import { kgToLb, lbToKg, formatLoad, snapLoad } from "./units"

describe("weight/units", () => {
  it("kg ↔ lb round trip", () => {
    expect(kgToLb(lbToKg(100))).toBeCloseTo(100, 5)
    expect(lbToKg(kgToLb(60))).toBeCloseTo(60, 5)
  })

  it("formatLoad respects unit and precision", () => {
    expect(formatLoad(20, "kg")).toBe("20 kg")
    expect(formatLoad(20, "lb")).toMatch(/lb$/)
    expect(formatLoad(undefined)).toBe("—")
    expect(formatLoad(20.456, "kg", { precision: 0 })).toBe("20 kg")
  })

  it("snapLoad snaps to .5 kg or 1 lb", () => {
    expect(snapLoad(20.3, "kg")).toBe(20.5)
    expect(snapLoad(20.1, "kg")).toBe(20)
    expect(snapLoad(lbToKg(45.4), "lb")).toBeCloseTo(lbToKg(45), 5)
  })
})
