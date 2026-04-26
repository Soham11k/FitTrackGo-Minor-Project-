import { describe, it, expect, vi, beforeEach } from "vitest"
import { retrieveRelevantChunks } from "./retrieve"

vi.mock("./openai-fetch", () => ({ isOpenAIConfigured: () => true }))

describe("retrieveRelevantChunks (lexical)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns exercise-tilted chunks for squat + knee", async () => {
    const r = await retrieveRelevantChunks({
      userQuery: "How deep should my knee bend for squat",
      exerciseId: "squat",
      topK: 4,
    })
    expect(r.length).toBeGreaterThan(0)
    expect(r.some((c) => c.exerciseId === "squat")).toBe(true)
  })
})
