/**
 * Encrypt short UTF-8 strings stored in Postgres text/json columns (names, serialized paths).
 * Wire format matches coach clips (AES-GCM + FTCLIPv1 header) embedded in a prefixed text field.
 */
import { decryptBlob, encryptBlob } from "@/lib/encryption/aes-gcm"

/** Visible DB prefix so we distinguish ciphertext from legacy plaintext. */
export const USER_DATA_FIELD_PREFIX = "FTUSRfld1:"

export function isEncryptedUserDataField(s: string | null | undefined): boolean {
  return typeof s === "string" && s.startsWith(USER_DATA_FIELD_PREFIX)
}

function uint8ToBinaryString(u: Uint8Array): string {
  let s = ""
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]!)
  return s
}

/** Encrypt a string → storable ASCII (base64 payload). */
export async function encryptUserDataStringPlain(plain: string, key: CryptoKey): Promise<string> {
  const blob = await encryptBlob(new Blob([plain], { type: "application/octet-stream" }), key)
  const buf = new Uint8Array(await blob.arrayBuffer())
  return USER_DATA_FIELD_PREFIX + btoa(uint8ToBinaryString(buf))
}

/** Decrypt field produced by {@link encryptUserDataStringPlain}. */
export async function decryptUserDataStringPlain(enc: string, key: CryptoKey): Promise<string> {
  if (!isEncryptedUserDataField(enc)) return enc
  const b64 = enc.slice(USER_DATA_FIELD_PREFIX.length)
  const bin = atob(b64)
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  const blob = new Blob([u.buffer])
  const out = await decryptBlob(blob, key, "application/octet-stream")
  return new TextDecoder().decode(await out.arrayBuffer())
}
