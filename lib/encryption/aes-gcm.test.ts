import { describe, it, expect } from "vitest"
import { encryptBlob, decryptBlob, decryptBlobIfEncrypted } from "@/lib/encryption/aes-gcm"

describe("aes-gcm clips", () => {
  it("encrypt/decrypt round-trip preserves payload and mime", async () => {
    const key = (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ])) as CryptoKey
    const plain = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: "video/webm" })
    const enc = await encryptBlob(plain, key)
    expect(enc.type).toBe("application/octet-stream")
    const out = await decryptBlob(enc, key, "video/webm")
    expect(out.type).toBe("video/webm")
    expect(new Uint8Array(await out.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
  })

  it("decryptBlobIfEncrypted passes through legacy blobs without magic prefix", async () => {
    const key = (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ])) as CryptoKey
    const legacy = new Blob(["plaintext-webm-bytes"], { type: "video/webm" })
    const out = await decryptBlobIfEncrypted(legacy, key, "video/webm")
    expect(await out.text()).toBe("plaintext-webm-bytes")
  })

  it("throws on corrupt ciphertext", async () => {
    const key = (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ])) as CryptoKey
    const enc = await encryptBlob(new Blob(["x"]), key)
    const buf = new Uint8Array(await enc.arrayBuffer())
    buf[buf.length - 1] ^= 0xff
    const bad = new Blob([buf], { type: "application/octet-stream" })
    await expect(decryptBlob(bad, key, "video/webm")).rejects.toThrow()
  })
})
