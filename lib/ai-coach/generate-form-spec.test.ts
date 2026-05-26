import { describe, it, expect, vi, beforeEach } from "vitest"
import squat from "@/data/form-specs/squat.json"
import type { FormSpec } from "@/lib/form-engine/types"

vi.mock("./openai-fetch", () => ({
  isOpenAIConfigured: () => true,
  openaiChatJson: vi.fn(),
}))

vi.mock("./clip-review", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./clip-review")>()
  return {
    ...orig,
    parseVisionModelJsonPayload: (raw: string) => JSON.parse(raw),
  }
})

import { openaiChatJson } from "./openai-fetch"
import { generateFormSpecFromDescription } from "./generate-form-spec"

const mockChat = vi.mocked(openaiChatJson)

function minimalCustomSpec(): FormSpec {
  const base = squat as FormSpec
  return {
    ...base,
    id: "placeholder",
    displayName: "Band pull-apart",
    category: "upper",
    loadType: "none",
    repPattern: "top_bottom_top",
  }
}

describe("generateFormSpecFromDescription", () => {
  beforeEach(() => {
    mockChat.mockReset()
  })

  it("returns validated spec and preview on success", async () => {
    mockChat.mockResolvedValueOnce(JSON.stringify(minimalCustomSpec()))

    const result = await generateFormSpecFromDescription({
      name: "Band pull-apart",
      description: "Stand tall, pull band apart to squeeze shoulder blades, control return.",
    })

    expect(result.spec.displayName).toBe("Band pull-apart")
    expect(result.specId).toMatch(/^custom_/)
    expect(result.preview.rulesSummary.length).toBeGreaterThan(0)
    expect(result.preview.phasesSummary.length).toBeGreaterThan(0)
  })

  it("retries once when first JSON fails validation", async () => {
    const invalid = { foo: "bar" }
    mockChat
      .mockResolvedValueOnce(JSON.stringify(invalid))
      .mockResolvedValueOnce(JSON.stringify(minimalCustomSpec()))

    const result = await generateFormSpecFromDescription({
      name: "Band pull-apart",
      description: "Arms straight, squeeze shoulder blades at end of each rep.",
    })

    expect(mockChat).toHaveBeenCalledTimes(2)
    expect(result.spec.id).toMatch(/^custom_/)
  })

  it("throws when validation fails twice", async () => {
    mockChat.mockResolvedValue(JSON.stringify({ invalid: true }))

    await expect(
      generateFormSpecFromDescription({
        name: "Test",
        description: "A movement that will never validate as json.",
      }),
    ).rejects.toThrow(/validation_failed/)
  })
})
