import { describe, it, expect } from "vitest"
import { compareCoachSessions, jointAngleDeltaMap } from "./compare-sessions"
import type { CoachRecord } from "./store"

function coach(partial: Partial<CoachRecord> & Pick<CoachRecord, "id" | "exercise">): CoachRecord {
  return {
    id: partial.id,
    exercise: partial.exercise,
    reps: partial.reps ?? 3,
    score: partial.score ?? 80,
    repScores: partial.repScores ?? [70, 80, 90],
    completedAt: partial.completedAt ?? new Date().toISOString(),
    repTraces: partial.repTraces,
  }
}

describe("compare-sessions", () => {
  it("jointAngleDeltaMap subtracts baseline from current", () => {
    const d = jointAngleDeltaMap({ "knee.l": 110 }, { "knee.l": 100 })
    expect(d["knee.l"]).toBe(10)
  })

  it("compareCoachSessions aligns rep score and joint deltas when traces exist", () => {
    const a = coach({
      id: "a",
      exercise: "Squat",
      score: 88,
      repScores: [80, 90],
      repTraces: [
        {
          rep: 2,
          bottom: {
            phase: "bottom",
            anglesDeg: { "knee.l": 105, "hip.l": 60 },
            faults: [],
          },
          top: { phase: "top", anglesDeg: { "knee.l": 170 }, faults: [] },
        },
      ],
    })
    const b = coach({
      id: "b",
      exercise: "Squat",
      score: 74,
      repScores: [70, 74],
      repTraces: [
        {
          rep: 2,
          bottom: {
            phase: "bottom",
            anglesDeg: { "knee.l": 100, "hip.l": 55 },
            faults: [],
          },
          top: { phase: "top", anglesDeg: { "knee.l": 168 }, faults: [] },
        },
      ],
    })
    const r = compareCoachSessions(a, b)
    expect(r.scoreDelta).toBe(14)
    expect(r.avgRepDelta).toBe(13)
    expect(r.bottomAnglesDelta["knee.l"]).toBe(5)
    expect(r.bottomAnglesDelta["hip.l"]).toBe(5)
    expect(r.topAnglesDelta["knee.l"]).toBe(2)
  })

  it("throws when exercise labels differ", () => {
    expect(() =>
      compareCoachSessions(
        coach({ id: "x", exercise: "A" }),
        coach({ id: "y", exercise: "B" }),
      ),
    ).toThrow()
  })
})
