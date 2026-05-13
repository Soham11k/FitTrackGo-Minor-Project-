import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import { isFitbitConfigured } from "@/lib/wearables/fitbit"

export async function POST(request: Request) {
  if (!isFitbitConfigured()) {
    return NextResponse.json({ error: "Fitbit is not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: { provider?: string } = {}
  try {
    body = (await request.json()) as { provider?: string }
  } catch {
    /* default */
  }
  if (body.provider && body.provider !== "fitbit") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 })
  }

  const { error: delErr } = await admin
    .from("wearable_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "fitbit")

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
