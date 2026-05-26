import { describe, it, expect, afterEach } from "vitest"
import type { FormSpec } from "./types"
import squat from "@/data/form-specs/squat.json"
import {
  clearUserSpecs,
  hasSpec,
  loadSpec,
  registerUserSpec,
  unregisterUserSpec,
  isUserSpec,
} from "./registry"

describe("registry user spec merge", () => {
  afterEach(() => {
    unregisterUserSpec("custom_test_squat_clone")
    clearUserSpecs()
  })

  it("registers and loads user spec; built-in wins on id collision", () => {
    const custom: FormSpec = {
      ...(squat as FormSpec),
      id: "custom_test_squat_clone",
      displayName: "My squat variant",
    }
    registerUserSpec(custom)
    expect(hasSpec("custom_test_squat_clone")).toBe(true)
    expect(isUserSpec("custom_test_squat_clone")).toBe(true)
    expect(loadSpec("custom_test_squat_clone")?.displayName).toBe("My squat variant")
    expect(loadSpec("squat")?.id).toBe("squat")
  })
})
