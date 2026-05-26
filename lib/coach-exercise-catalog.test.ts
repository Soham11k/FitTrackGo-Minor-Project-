import { describe, it, expect } from "vitest"
import { assertCoachCatalogSpecsRegistered, COACH_EXERCISE_FAMILIES } from "./coach-exercise-catalog"
import { loadSpec } from "./form-engine/registry"

describe("coach-exercise-catalog", () => {
  it("every variant specId is registered with a displayName", () => {
    const { ok, missing } = assertCoachCatalogSpecsRegistered()
    expect(ok, `missing specs: ${missing.join(", ")}`).toBe(true)
    for (const fam of COACH_EXERCISE_FAMILIES) {
      for (const v of fam.variants) {
        const spec = loadSpec(v.specId)
        expect(spec?.displayName?.trim().length).toBeGreaterThan(0)
      }
    }
  })
})
