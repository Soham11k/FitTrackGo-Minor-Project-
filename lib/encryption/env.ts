/** When unset or truthy-ish, clip encryption uploads are enabled. Set NEXT_PUBLIC_ENABLE_CLIP_ENCRYPTION=0 to disable for debugging. */
export function isClipEncryptionEnabledEnv(): boolean {
  const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ENABLE_CLIP_ENCRYPTION ?? "" : ""
  return raw.trim() !== "0"
}
