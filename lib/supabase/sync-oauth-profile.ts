import type { SupabaseClient, User } from "@supabase/supabase-js"

function isLikelyRpcNotDeployed(error: unknown): boolean {
  const o = error as { code?: string; message?: string }
  const code = String(o?.code ?? "")
  const msg = String(o?.message ?? "").toLowerCase()
  return (
    code === "PGRST202" ||
    (/\bcould not find the function\b/.test(msg) && /\bschema cache\b/.test(msg))
  )
}

/**
 * After OAuth/email confirmation, persist display name from IdP metadata into `profiles`.
 * Safe to no-op when name is missing; logs non-fatal errors.
 */
export async function syncOAuthProfileToRow(
  supabase: Pick<SupabaseClient, "from" | "rpc">,
  user: Pick<User, "id" | "email" | "user_metadata">
): Promise<void> {
  const oauthName =
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    user.email?.split("@")[0] ||
    null

  if (!oauthName) return

  const { error: rpcError } = await supabase.rpc("sync_own_profile_name", {
    p_name: oauthName,
  })

  if (!rpcError) return

  if (isLikelyRpcNotDeployed(rpcError)) {
    const { error: up } = await supabase
      .from("profiles")
      .upsert({ id: user.id, name: oauthName }, { onConflict: "id" })
    if (up) console.error("Profile sync error (fallback upsert):", up)
    return
  }

  console.error("Profile sync error:", rpcError)
}
