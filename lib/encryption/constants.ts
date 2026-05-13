/** Prepended to encrypted coach clip blobs (before 12-byte AES-GCM IV + ciphertext+tag). */
export const COACH_CLIP_MAGIC = new TextEncoder().encode("FTCLIPv1")

export const COACH_CLIP_IV_LENGTH = 12

export function isCoachClipEncryptedPrefix(view: Uint8Array): boolean {
  if (view.byteLength < COACH_CLIP_MAGIC.byteLength) return false
  for (let i = 0; i < COACH_CLIP_MAGIC.byteLength; i++) {
    if (view[i] !== COACH_CLIP_MAGIC[i]!) return false
  }
  return true
}

export async function isEncryptedCoachClipBlob(blob: Blob): Promise<boolean> {
  const need = COACH_CLIP_MAGIC.byteLength + COACH_CLIP_IV_LENGTH + 16
  const head = new Uint8Array(await blob.slice(0, Math.min(need, blob.size)).arrayBuffer())
  return isCoachClipEncryptedPrefix(head)
}
