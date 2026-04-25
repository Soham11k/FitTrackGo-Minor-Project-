import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getAdapter } from "@/lib/wearables/providers"
import type { ProviderId } from "@/lib/wearables/providers"

export async function GET(
  request: Request,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params
  const adapter = getAdapter(provider as ProviderId)
  if (!adapter) return NextResponse.json({ error: "Unknown provider" }, { status: 404 })

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state") ?? ""
  const error = url.searchParams.get("error")
  if (error) {
    return NextResponse.redirect(`${url.origin}/?wearable_error=${encodeURIComponent(error)}`)
  }
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 })

  const userId = state.split(".")[0]
  if (!userId) return NextResponse.json({ error: "Invalid state" }, { status: 400 })

  const admin = createServiceRoleClient()
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  try {
    const redirectUri = `${url.origin}/api/wearables/${provider}/callback`
    const tokens = await adapter.exchangeCode(code, redirectUri)

    const { error: upsertError } = await admin.from("wearable_connections").upsert(
      {
        user_id: userId,
        provider,
        external_user_id: tokens.externalUserId ?? null,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        token_expires_at: tokens.expiresAt,
        scopes: tokens.scopes,
      },
      { onConflict: "user_id,provider" }
    )
    if (upsertError) throw upsertError

    return NextResponse.redirect(`${url.origin}/?wearable_connected=${provider}`)
  } catch (err) {
    console.error(`[wearables/${provider}/callback] failed:`, err)
    return NextResponse.redirect(
      `${url.origin}/?wearable_error=${encodeURIComponent(String(err instanceof Error ? err.message : err))}`
    )
  }
}
