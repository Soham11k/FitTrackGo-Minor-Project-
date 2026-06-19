import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function displayNameFromUser(user: {
  email?: string | null
  user_metadata?: Record<string, unknown>
}): string {
  const meta = user.user_metadata ?? {}
  const fromMeta =
    (meta.name as string | undefined) ||
    (meta.full_name as string | undefined) ||
    (meta.display_name as string | undefined)
  return fromMeta || user.email?.split("@")[0] || "Athlete"
}

/**
 * Server-side profile bootstrap when client inserts hit RLS (42501), usually
 * because `ensure_own_profile_bootstrap` migration was not applied yet.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const joinDate = new Date().toISOString().split("T")[0]
  const name = displayNameFromUser(user)

  const { error: rpcError } = await supabase.rpc("ensure_own_profile_bootstrap", {
    p_name: name,
    p_level: "beginner",
    p_goals: [] as string[],
    p_join_date: joinDate,
    p_onboarded: false,
  })

  if (!rpcError) {
    return NextResponse.json({ ok: true, via: "rpc" })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      {
        error: "Profile bootstrap unavailable",
        detail: formatRpcHint(rpcError),
      },
      { status: 503 },
    )
  }

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      name,
      level: "beginner",
      goals: [],
      join_date: joinDate,
      onboarded: false,
    },
    { onConflict: "id", ignoreDuplicates: true },
  )

  if (upsertError) {
    return NextResponse.json(
      { error: formatRpcHint(upsertError), rpc: formatRpcHint(rpcError) },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, via: "service_role" })
}

function formatRpcHint(error: unknown): string {
  const o = error as { message?: string; code?: string }
  const msg = o?.message ?? String(error)
  const code = o?.code
  return code ? `${code}: ${msg}` : msg
}
