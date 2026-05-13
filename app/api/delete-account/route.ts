import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for")
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip") || "unknown"
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  if (!origin || !host) return false
  try {
    const originHost = new URL(origin).host
    return originHost === host
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  }

  const ip = getClientIp(request)
  const rate = await checkRateLimit({
    key: `delete-account:${ip}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  })
  if (!rate.allowed) {
    const retryAfterSec = Math.max(Math.ceil((rate.resetAt - Date.now()) / 1000), 1)
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": String(rate.remaining),
          "X-RateLimit-Reset": String(Math.floor(rate.resetAt / 1000)),
          "X-RateLimit-Source": rate.source,
        },
      }
    )
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is missing or placeholder; cannot delete user")
    return NextResponse.json(
      { error: "Account deletion is not configured. Please set SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    )
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    logger.error("Delete user error", { userId: user.id, error: deleteError.message })
    return NextResponse.json(
      { error: deleteError.message || "Failed to delete account" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
