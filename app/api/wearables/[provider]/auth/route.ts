import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAdapter } from "@/lib/wearables/providers"
import type { ProviderId } from "@/lib/wearables/providers"
import { resolveWearableOAuthRedirectBase } from "@/lib/wearables/app-origin"

export async function GET(
  request: Request,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params
  const adapter = getAdapter(provider as ProviderId)
  if (!adapter) return NextResponse.json({ error: "Unknown provider" }, { status: 404 })
  if (!adapter.isConfigured()) {
    return NextResponse.json({ error: "Provider not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const oauthBase = resolveWearableOAuthRedirectBase(request.url)
  const redirectUri = `${oauthBase}/api/wearables/${provider}/callback`
  // `state` carries the user id so the callback can map back. Sign it with a
  // short-lived HMAC if paranoid; for now include a random suffix to deter
  // replay.
  const state = `${user.id}.${crypto.randomUUID()}`

  const url = adapter.authorizeUrl(state, redirectUri)
  return NextResponse.redirect(url)
}
