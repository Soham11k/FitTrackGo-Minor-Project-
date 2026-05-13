/**
 * PBKDF2-derived AES-GCM key for wrapping the local clip content key with a user passphrase.
 */
const PBKDF2_DEFAULT_ITERATIONS = 600_000
const SALT_BYTES = 16

/** Lower in Vitest via env (set in tests) to keep CI fast. */
export function pbkdf2Iterations(): number {
  const raw = typeof process !== "undefined" ? process.env.ENCRYPTION_TEST_PBKDF2_ITERATIONS : ""
  const n = raw ? Number.parseInt(raw, 10) : NaN
  if (Number.isFinite(n) && n >= 1000 && n <= PBKDF2_DEFAULT_ITERATIONS) return Math.floor(n)
  return PBKDF2_DEFAULT_ITERATIONS
}

export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES))
}

export async function deriveWrapKey(passphrase: string, salt: Uint8Array, iterationsOverride?: number): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(passphrase)
  const baseKey = await crypto.subtle.importKey("raw", enc, "PBKDF2", false, ["deriveBits", "deriveKey"])
  const iterations =
    typeof iterationsOverride === "number" &&
    Number.isFinite(iterationsOverride) &&
    iterationsOverride >= 1000 &&
    iterationsOverride <= PBKDF2_DEFAULT_ITERATIONS
      ? Math.floor(iterationsOverride)
      : pbkdf2Iterations()
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  ) as Promise<CryptoKey>
}

/** Encrypt raw AES key material with passphrase-derived AES-GCM. Returns IV (12B) || ciphertext. */
export async function wrapRawContentKey(passphrase: string, rawContentKey: ArrayBuffer): Promise<{
  salt: Uint8Array
  wrapped: Uint8Array
  iterations: number
}> {
  const iterations = pbkdf2Iterations()
  const salt = randomSalt()
  const wrapKey = await deriveWrapKey(passphrase, salt, iterations)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, rawContentKey)
  const wrapped = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  wrapped.set(iv, 0)
  wrapped.set(new Uint8Array(ciphertext), iv.byteLength)
  return { salt, wrapped, iterations }
}

export async function unwrapRawContentKey(
  passphrase: string,
  salt: Uint8Array,
  wrappedIvAndCipher: Uint8Array,
  iterations?: number,
): Promise<ArrayBuffer> {
  const wrapKey = await deriveWrapKey(passphrase, salt, iterations)
  if (wrappedIvAndCipher.byteLength < 13) throw new Error("wrapped_key_too_short")
  const iv = wrappedIvAndCipher.slice(0, 12)
  const ciphertext = wrappedIvAndCipher.slice(12)
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, wrapKey, ciphertext)
}
