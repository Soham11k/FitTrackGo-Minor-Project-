import { describe, it, expect, beforeEach, vi } from "vitest"
import { wrapRawContentKey, unwrapRawContentKey } from "@/lib/encryption/kdf"

describe("kdf wrap", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_TEST_PBKDF2_ITERATIONS", "5000")
  })

  it("wraps and unwraps 32-byte raw material", async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32)).buffer
    const { salt, wrapped, iterations } = await wrapRawContentKey("my-passphrase-10", raw)
    const out = await unwrapRawContentKey("my-passphrase-10", salt, wrapped, iterations)
    expect(new Uint8Array(out)).toEqual(new Uint8Array(raw))
  })

  it("rejects wrong passphrase", async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32)).buffer
    const { salt, wrapped, iterations } = await wrapRawContentKey("correct-pass-xx", raw)
    await expect(unwrapRawContentKey("wrong-passphrase", salt, wrapped, iterations)).rejects.toThrow()
  })

  it("requires matching iterations for unwrap", async () => {
    const raw = crypto.getRandomValues(new Uint8Array(32)).buffer
    const { salt, wrapped, iterations } = await wrapRawContentKey("iter-test-pass-", raw)
    const wrongIter = iterations + 3777
    await expect(unwrapRawContentKey("iter-test-pass-", salt, wrapped, wrongIter)).rejects.toThrow()
  })
})
