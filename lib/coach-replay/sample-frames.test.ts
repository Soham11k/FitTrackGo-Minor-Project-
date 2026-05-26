import { describe, it, expect } from "vitest"

/**
 * sampleFramesPerRep requires HTMLVideoElement (browser). This file documents
 * the contract: when markers are empty, callers fall back to sampleFramesFromBlob.
 * Integration coverage is manual / Playwright.
 */
describe("sampleFramesPerRep contract", () => {
  it("exports sampleFramesPerRep alongside sampleFramesFromBlob", async () => {
    const mod = await import("./sample-frames")
    expect(typeof mod.sampleFramesPerRep).toBe("function")
    expect(typeof mod.sampleFramesFromBlob).toBe("function")
  })
})
