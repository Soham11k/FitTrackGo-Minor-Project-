import { createClient } from "@/lib/supabase/client"
import {
  decryptUserDataStringPlain,
  encryptUserDataStringPlain,
  isEncryptedUserDataField,
} from "@/lib/encryption/user-data-cipher"
import { isUserDataFieldEncryptionEnabled } from "@/lib/encryption/user-data-env"
import {
  getOrCreateUserDataContentKey,
  getUserDataContentKeyIfExists,
} from "@/lib/encryption/content-key"
import { formatErr } from "@/lib/format-err"

function getSupabase() {
  return createClient()
}

export function runPathCipherColumnUnsupported(error: unknown): boolean {
  const code = String((error as { code?: string })?.code ?? "")
  const msg = String((error as { message?: string })?.message ?? "")
  if (code === "PGRST204" && /\bpath_cipher\b/i.test(msg)) return true
  if (/schema cache/i.test(msg) && /\bpath_cipher\b/i.test(msg)) return true
  return false
}

export async function maybeDecryptProfileName(stored: string | null | undefined): Promise<string> {
  const s = stored ?? ""
  if (!s || !isUserDataFieldEncryptionEnabled() || !isEncryptedUserDataField(s)) return s
  const k = await getUserDataContentKeyIfExists()
  if (!k) return s
  try {
    return await decryptUserDataStringPlain(s, k)
  } catch {
    return s
  }
}

export async function maybeEncryptProfileNameForWrite(plain: string): Promise<string> {
  if (!isUserDataFieldEncryptionEnabled()) return plain
  if (!plain) return plain
  const k = await getOrCreateUserDataContentKey()
  if (!k) return plain
  try {
    return await encryptUserDataStringPlain(plain, k)
  } catch {
    return plain
  }
}

/** Best-effort: migrate OAuth/bootstrap plaintext names to ciphertext once a local key exists. */
export function scheduleEncryptPlainProfileNameIfNeeded(
  userId: string,
  rawNameFromDb: string | null | undefined,
): void {
  if (!isUserDataFieldEncryptionEnabled() || !rawNameFromDb) return
  if (isEncryptedUserDataField(rawNameFromDb)) return
  void (async () => {
    try {
      const enc = await maybeEncryptProfileNameForWrite(rawNameFromDb)
      if (!enc || enc === rawNameFromDb) return
      await getSupabase().from("profiles").update({ name: enc }).eq("id", userId)
    } catch (e) {
      console.warn("[profiles] background encrypt name failed", formatErr(e))
    }
  })()
}

export async function decryptRunPath(row: {
  path?: [number, number][] | null
  path_cipher?: string | null
}): Promise<[number, number][]> {
  const pc = row.path_cipher
  if (
    pc &&
    isEncryptedUserDataField(pc) &&
    isUserDataFieldEncryptionEnabled()
  ) {
    const k = await getUserDataContentKeyIfExists()
    if (k) {
      try {
        const s = await decryptUserDataStringPlain(pc, k)
        const parsed = JSON.parse(s) as unknown
        if (Array.isArray(parsed))
          return parsed as [number, number][]
      } catch {
        /* fall through */
      }
    }
    return []
  }
  const p = row.path
  return Array.isArray(p) ? p : []
}
