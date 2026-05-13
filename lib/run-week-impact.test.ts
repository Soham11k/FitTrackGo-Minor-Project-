import { describe, it, expect } from "vitest"
import { computeWeeklyRunKmImpact, weeklyImpactSentence } from "./run-week-impact"

describe("computeWeeklyRunKmImpact", () => {
  const mon = new Date(2026, 4, 11, 12) // Monday May 11 2026

  it("sums this week vs last week", () => {
    const prior = [
      { completedAt: mon.toISOString(), distance: 2 },
      { completedAt: new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 2).toISOString(), distance: 3 },
      { completedAt: new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - 3).toISOString(), distance: 10 },
    ]
    const r = computeWeeklyRunKmImpact(prior, 5)
    expect(r.thisWeekKm).toBeCloseTo(10, 5)
    expect(r.lastWeekKm).toBeCloseTo(10, 5)
  })

  it("formats sentence", () => {
    const r = weeklyImpactSentence({ thisWeekKm: 12.3, lastWeekKm: 10, deltaPctVsLastWeek: 23 })
    expect(r).toContain("12.3")
    expect(r).toContain("23%")
  })
})
