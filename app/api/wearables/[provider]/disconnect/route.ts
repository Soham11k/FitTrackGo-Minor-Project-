import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getAdapter } from "@/lib/wearables/providers"
import type { ProviderId } from "@/lib/wearables/providers"

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params
  if (!getAdapter(provider as ProviderId)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const admin = createServiceRoleClient()
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  const { error } = await admin
    .from("wearable_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
