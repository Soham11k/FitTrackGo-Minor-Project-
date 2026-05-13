import { createClient } from "@/lib/supabase/client"
import {
  coachClipsCloudFeatureFlag,
  isCoachClipCloudSyncEnabled,
} from "@/lib/coach-replay/prefs"
import { encryptBlob, decryptBlob } from "@/lib/encryption/aes-gcm"
import { isClipEncryptionEnabledEnv } from "@/lib/encryption/env"
import { isEncryptedCoachClipBlob } from "@/lib/encryption/constants"
import { ClipKeyMissingError, getLocalClipContentKeyIfExists, getOrCreateLocalContentKey } from "@/lib/encryption/content-key"

function shouldEncryptClipsUpload(): boolean {
  return coachClipsCloudFeatureFlag() && isClipEncryptionEnabledEnv()
}

/** Client-side upload of a local coach clip (private bucket, owner RLS). */
export async function uploadCoachClipIfEnabled(opts: {
  sessionId: string
  blob: Blob
  durationMs: number
}): Promise<boolean> {
  if (!coachClipsCloudFeatureFlag() || !isCoachClipCloudSyncEnabled()) return false
  const supabase = createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  const user = auth?.user
  if (authErr || !user) return false

  const encrypt = shouldEncryptClipsUpload()
  const path = `${user.id}/${opts.sessionId}.webm`
  let body: Blob = opts.blob
  let uploadContentType = "video/webm"
  let storageMetadata: Record<string, string> | undefined

  if (encrypt) {
    const key = await getOrCreateLocalContentKey()
    body = await encryptBlob(opts.blob, key)
    uploadContentType = "application/octet-stream"
    storageMetadata = { encrypted: "v1", original_mime: "video/webm" }
  }

  const { error: upErr } = await supabase.storage.from("coach-clips").upload(path, body, {
    upsert: true,
    contentType: uploadContentType,
    ...(storageMetadata ? { metadata: storageMetadata } : {}),
  })
  if (upErr) {
    console.warn("[coach-clips]", upErr.message)
    return false
  }

  const { error: rowErr } = await supabase.from("coach_clips").insert({
    session_id: opts.sessionId,
    user_id: user.id,
    storage_path: path,
    duration_ms: Math.round(opts.durationMs),
    encrypted: encrypt ? "v1" : null,
  })
  if (rowErr) {
    console.warn("[coach-clips] row insert", rowErr.message)
    return false
  }
  return true
}

/**
 * Return a short-lived signed URL for the per-session WebM clip stored in
 * `coach-clips`. Used by post-set tooling (AI clip review) when the clip
 * needs to be re-downloaded after the local IndexedDB cache was cleared.
 */
export async function getClipSignedUrl(sessionId: string, expiresInSec = 600): Promise<string | null> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return null
  const path = `${user.id}/${sessionId}.webm`
  const { data, error } = await supabase.storage.from("coach-clips").createSignedUrl(path, expiresInSec)
  if (error) {
    console.warn("[coach-clips] signed url", error.message)
    return null
  }
  return data?.signedUrl ?? null
}

export async function fetchAndDecryptCoachClip(
  signedUrl: string,
  originalMimeType = "video/webm",
): Promise<{ blob: Blob; wasEncrypted: boolean }> {
  const res = await fetch(signedUrl)
  if (!res.ok) throw new Error("coach_clip_fetch_failed")
  const incoming = await res.blob()
  const looksEncrypted = await isEncryptedCoachClipBlob(incoming)
  if (!looksEncrypted) {
    return {
      blob: incoming.type ? incoming : new Blob([incoming], { type: originalMimeType }),
      wasEncrypted: false,
    }
  }
  const key = await getLocalClipContentKeyIfExists()
  if (!key) throw new ClipKeyMissingError()
  const decrypted = await decryptBlob(incoming, key, originalMimeType)
  return { blob: decrypted, wasEncrypted: true }
}
