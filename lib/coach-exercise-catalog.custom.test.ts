import { describe, it, expect } from "vitest"
import { customExercisesToFamily, findCustomVariantBySpecId, MY_EXERCISES_FAMILY_ID } from "./coach-exercise-catalog"

describe("customExercisesToFamily", () => {
  it("returns null for empty list", () => {
    expect(customExercisesToFamily([])).toBeNull()
  })

  it("builds my exercises family with variants", () => {
    const family = customExercisesToFamily([
      {
        specId: "custom_band_pull_abc123",
        displayName: "Band pull-apart",
        description: "Pull band to chest",
      },
    ])
    expect(family?.id).toBe(MY_EXERCISES_FAMILY_ID)
    expect(family?.variants).toHaveLength(1)
    expect(family?.variants[0]?.specId).toBe("custom_band_pull_abc123")
  })

  it("findCustomVariantBySpecId resolves variant", () => {
    const items = [
      {
        specId: "custom_test_move_xyz",
        displayName: "Test",
        description: "Desc",
      },
    ]
    const found = findCustomVariantBySpecId("custom_test_move_xyz", items)
    expect(found?.variant.name).toBe("Test")
    expect(found?.family.id).toBe(MY_EXERCISES_FAMILY_ID)
  })
})
