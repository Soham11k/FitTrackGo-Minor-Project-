import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey || serviceRoleKey === "your-service-role-key") {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set; cannot delete user")
    return NextResponse.json(
      { error: "Account deletion is not configured. Please set SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 })
  }

  const admin = createSupabaseAdmin(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error("Delete user error:", deleteError)
    return NextResponse.json(
      { error: deleteError.message || "Failed to delete account" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
