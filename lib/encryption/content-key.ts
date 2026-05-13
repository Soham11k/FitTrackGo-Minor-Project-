import { unwrapRawContentKey, wrapRawContentKey } from "@/lib/encryption/kdf"

export class ClipKeyMissingError extends Error {
  readonly code = "CLIP_KEY_MISSING" as const
  constructor(message = "No local clip decryption key — unlock with your backup passphrase.") {
    super(message)
    this.name = "ClipKeyMissingError"
  }
}

const DB_NAME = "fittrack_clip_crypto_v1"
const DB_VER = 1
const STORE = "keys"
/** Single row storing 32-byte raw AES-GCM material (never synced to servers). */
const ROW_ID = "content_v1"

type RawClipKeyRow = { id: typeof ROW_ID; raw: ArrayBuffer }

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onerror = () => reject(req.error)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

async function loadRawClipKeyMaterial(): Promise<ArrayBuffer | null> {
  try {
    const db = await idbOpen()
    const row = await new Promise<RawClipKeyRow | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly")
      const rq = tx.objectStore(STORE).get(ROW_ID)
      rq.onsuccess = () => resolve(rq.result as RawClipKeyRow | undefined)
      rq.onerror = () => reject(rq.error)
    })
    db.close()
    const raw = row?.raw
    if (!raw || raw.byteLength !== 32) return null
    return raw
  } catch {
    return null
  }
}

async function saveRawClipKeyMaterial(raw: ArrayBuffer): Promise<void> {
  if (raw.byteLength !== 32) throw new Error("clip_key_bad_length")
  const db = await idbOpen()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.objectStore(STORE).put({ id: ROW_ID, raw } satisfies RawClipKeyRow)
  })
  db.close()
}

async function generateNewRawClipKeyMaterial(): Promise<ArrayBuffer> {
  const b = crypto.getRandomValues(new Uint8Array(32))
  await saveRawClipKeyMaterial(b.buffer)
  return b.buffer
}

/** True if IndexedDB holds a usable 256-bit raw AES key for clip encryption/decryption. */
export async function hasLocalClipRawKey(): Promise<boolean> {
  const raw = await loadRawClipKeyMaterial()
  return raw != null
}

export async function getOrCreateClipRawKey(): Promise<ArrayBuffer> {
  let raw = await loadRawClipKeyMaterial()
  if (raw) return raw
  raw = await generateNewRawClipKeyMaterial()
  return raw
}

export async function importRawClipKey(aesRaw: ArrayBuffer): Promise<void> {
  await saveRawClipKeyMaterial(aesRaw)
}

async function rawToCryptoKey(raw: ArrayBuffer, extractable = false): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, extractable, [
    "encrypt",
    "decrypt",
  ])
}

export async function getLocalClipContentKeyIfExists(): Promise<CryptoKey | null> {
  const raw = await loadRawClipKeyMaterial()
  if (!raw) return null
  return rawToCryptoKey(raw, false)
}

export async function getOrCreateLocalContentKey(): Promise<CryptoKey> {
  const raw = await getOrCreateClipRawKey()
  return rawToCryptoKey(raw, false)
}

/** Restores decrypt capability on a new browser after passphrase unlock. */
export async function restoreClipRawKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  wrappedIvAndCipher: Uint8Array,
  iterations?: number,
): Promise<void> {
  const raw = await unwrapRawContentKey(passphrase, salt, wrappedIvAndCipher, iterations)
  if (raw.byteLength !== 32) throw new Error("clip_key_unwrap_bad_length")
  await saveRawClipKeyMaterial(raw)
}

/** Wraps the local 256-bit clip key for cloud backup (passphrase-gated). */
export async function exportWrappedClipKey(passphrase: string): Promise<{
  salt: Uint8Array
  wrapped: Uint8Array
  iterations: number
}> {
  const raw = await getOrCreateClipRawKey()
  return wrapRawContentKey(passphrase, raw)
}
