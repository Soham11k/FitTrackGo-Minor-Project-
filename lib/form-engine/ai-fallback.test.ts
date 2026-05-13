import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Landmark } from "../form-analysis"
import { _resetAiFallbackThrottleForTests, analyzeFormAi } from "./ai-fallback"

function makeLandmarks(): Landmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))
}

describe("ai-fallback", () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => {
    _resetAiFallbackThrottleForTests()
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.useRealTimers()
  })

  it("posts to /api/ai-coach/score-pose and returns parsed result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ score: 87, isGoodForm: true, feedback: ["Keep core tight"], faultRegions: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const res = await analyzeFormAi(makeLandmarks(), { exerciseName: "cossack squat" })
    expect(res).toEqual({ score: 87, isGoodForm: true, feedback: ["Keep core tight"], faultRegions: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.exerciseName).toBe("cossack squat")
    expect(Array.isArray(body.angles)).toBe(true)
  })

  it("returns null on non-200 responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("ratelimited", { status: 429 })) as unknown as typeof fetch
    const res = await analyzeFormAi(makeLandmarks(), { exerciseName: "cossack squat" })
    expect(res).toBeNull()
  })

  it("throttles back-to-back calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ score: 50, isGoodForm: false, feedback: [], faultRegions: [] }), { status: 200 })
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const first = await analyzeFormAi(makeLandmarks(), { exerciseName: "cossack squat" })
    expect(first).not.toBeNull()
    const second = await analyzeFormAi(makeLandmarks(), { exerciseName: "cossack squat" })
    expect(second).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
