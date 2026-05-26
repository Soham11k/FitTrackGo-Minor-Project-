import { describe, it, expect } from "vitest"
import {
  decryptUserDataStringPlain,
  encryptUserDataStringPlain,
  isEncryptedUserDataField,
} from "@/lib/encryption/user-data-cipher"

describe("user-data-cipher", () => {
  it("round-trips encrypted profile-style strings", async () => {
    const key = (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ])) as CryptoKey
    const cipher = await encryptUserDataStringPlain("Alex · runner", key)
    expect(isEncryptedUserDataField(cipher)).toBe(true)
    expect(await decryptUserDataStringPlain(cipher, key)).toBe("Alex · runner")
  })
})
