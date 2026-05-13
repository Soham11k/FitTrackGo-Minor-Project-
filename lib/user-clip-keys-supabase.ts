import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/database.types"

export type UserClipKeyRowRemote = {
  wrapped_key: Uint8Array | null
  salt: Uint8Array | null
  iterations: number
  algo: string
}

function decodePgBytea(raw: unknown): Uint8Array | null {
  if (raw == null) return null
  if (raw instanceof Uint8Array) return raw
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  if (!ArrayBuffer.isView(raw)) {
    if (typeof raw === "string") {
      if (raw.startsWith("\\x")) {
        const hex = raw.slice(2)
        const out = new Uint8Array(hex.length / 2)
        for (let i = 0; i < out.length; i++) {
          out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
        }
        return out
      }
      try {
        const bin = typeof atob !== "undefined" ? atob(raw) : ""
        if (!bin.length) return null
        const out = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
        return out
      } catch {
        return null
      }
    }
    return null
  }
  const view = raw as ArrayBufferView
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
}

export async function fetchUserClipKeyRow(): Promise<UserClipKeyRowRemote | null> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return null
  const { data, error } = await supabase
    .from("user_clip_keys")
    .select("wrapped_key,salt,iterations,algo")
    .eq("user_id", auth.user.id)
    .maybeSingle()
  if (error || !data) return null
  const row = data as Database["public"]["Tables"]["user_clip_keys"]["Row"]
  const wrapped = decodePgBytea(row.wrapped_key as unknown)
  const salt = decodePgBytea(row.salt as unknown)
  if (!wrapped || !salt) return null
  return {
    wrapped_key: wrapped,
    salt,
    iterations: row.iterations,
    algo: row.algo,
  }
}

export async function upsertUserClipKeyBackup(opts: {
  wrapped: Uint8Array
  salt: Uint8Array
  iterations: number
}): Promise<boolean> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return false
  const { error } = await supabase.from("user_clip_keys").upsert(
    {
      user_id: user.id,
      wrapped_key: opts.wrapped,
      salt: opts.salt,
      iterations: opts.iterations,
      algo: "pbkdf2-sha256-aes-gcm-256",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )
  if (error) {
    console.warn("[user-clip-keys]", error.message)
    return false
  }
  return true
}
