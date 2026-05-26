/** Client-side encryption for profile/run fields. Set NEXT_PUBLIC_ENABLE_USER_DATA_ENCRYPTION=0 to disable. */
export function isUserDataFieldEncryptionEnabled(): boolean {
  const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ENABLE_USER_DATA_ENCRYPTION ?? "" : ""
  return raw.trim() !== "0"
}
