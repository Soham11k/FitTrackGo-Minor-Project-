/**
 * AES-GCM 256 for coach clip payloads. Format on wire:
 * COACH_CLIP_MAGIC (8B) || IV (12B) || ciphertext (includes GCM tag per Web Crypto).
 */
import { COACH_CLIP_IV_LENGTH, COACH_CLIP_MAGIC, isCoachClipEncryptedPrefix } from "@/lib/encryption/constants"

export async function encryptBlob(blob: Blob, key: CryptoKey): Promise<Blob> {
  const iv = crypto.getRandomValues(new Uint8Array(COACH_CLIP_IV_LENGTH))
  const plain = await blob.arrayBuffer()
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain)
  const cipher = new Uint8Array(cipherBuf)
  const out = new Uint8Array(COACH_CLIP_MAGIC.byteLength + iv.byteLength + cipher.byteLength)
  out.set(COACH_CLIP_MAGIC, 0)
  out.set(iv, COACH_CLIP_MAGIC.byteLength)
  out.set(cipher, COACH_CLIP_MAGIC.byteLength + iv.byteLength)
  return new Blob([out.buffer], { type: "application/octet-stream" })
}

export async function decryptBlob(cipherBlob: Blob, key: CryptoKey, outMimeType: string): Promise<Blob> {
  const all = await cipherBlob.arrayBuffer()
  const u = new Uint8Array(all)
  const header = COACH_CLIP_MAGIC.byteLength + COACH_CLIP_IV_LENGTH
  if (u.byteLength < header) throw new Error("coach_clip_decrypt_too_short")
  if (!isCoachClipEncryptedPrefix(u.slice(0, COACH_CLIP_MAGIC.byteLength))) {
    throw new Error("coach_clip_decrypt_bad_magic")
  }
  const iv = u.slice(COACH_CLIP_MAGIC.byteLength, header)
  const ciphertext = u.slice(header)
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)
  return new Blob([plain], { type: outMimeType })
}

/** If blob does not start with magic prefix, assume legacy plaintext clip and return unchanged. */
export async function decryptBlobIfEncrypted(cipherBlob: Blob, key: CryptoKey, outMimeType: string): Promise<Blob> {
  const headLen = COACH_CLIP_MAGIC.byteLength + COACH_CLIP_IV_LENGTH + 16
  const head = new Uint8Array(await cipherBlob.slice(0, Math.min(headLen, cipherBlob.size)).arrayBuffer())
  if (!isCoachClipEncryptedPrefix(head)) {
    return cipherBlob.type ? cipherBlob : new Blob([cipherBlob], { type: outMimeType })
  }
  return decryptBlob(cipherBlob, key, outMimeType)
}
