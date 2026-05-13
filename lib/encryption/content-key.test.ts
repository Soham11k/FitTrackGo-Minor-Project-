import { describe, it, expect, beforeEach, vi } from "vitest"
import "fake-indexeddb/auto"
import {
  getOrCreateClipRawKey,
  exportWrappedClipKey,
  restoreClipRawKeyFromPassphrase,
} from "@/lib/encryption/content-key"

function deleteClipDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const d = indexedDB.deleteDatabase("fittrack_clip_crypto_v1")
    d.onsuccess = () => resolve()
    d.onerror = () => reject(d.error)
  })
}

describe("content-key", () => {
  beforeEach(async () => {
    vi.stubEnv("ENCRYPTION_TEST_PBKDF2_ITERATIONS", "5000")
    await deleteClipDb()
  })

  it("reuses the same raw key on subsequent calls", async () => {
    const a = new Uint8Array(await getOrCreateClipRawKey())
    const b = new Uint8Array(await getOrCreateClipRawKey())
    expect(b).toEqual(a)
  })

  it("round-trips backup + restore after wiping local storage", async () => {
    const before = new Uint8Array(await getOrCreateClipRawKey())
    const wrapped = await exportWrappedClipKey("safe-phrase-01")
    await deleteClipDb()
    await restoreClipRawKeyFromPassphrase("safe-phrase-01", wrapped.salt, wrapped.wrapped, wrapped.iterations)
    const after = new Uint8Array(await getOrCreateClipRawKey())
    expect(after).toEqual(before)
  })
})
