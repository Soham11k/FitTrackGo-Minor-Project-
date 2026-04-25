import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendPush, type PushPayload } from "@/lib/push/server"

/**
 * Admin/cron-only route that fans out a push to every subscription of a user,
 * pruning dead endpoints (HTTP 410).
 *
 * Auth: expects `X-Cron-Secret` header matching `PUSH_ADMIN_TOKEN`. The
 * reminder engine (Vercel cron) calls this directly; the browser never does.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret")
  if (!secret || secret !== process.env.PUSH_ADMIN_TOKEN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: {
    userId?: string
    title?: string
    body?: string
    url?: string
    tag?: string
    icon?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.userId || !body.title) {
    return NextResponse.json({ error: "userId and title are required" }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", body.userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!subs?.length) return NextResponse.json({ ok: true, delivered: 0 })

  const payload: PushPayload = {
    title: body.title,
    body: body.body ?? "",
    url: body.url,
    tag: body.tag,
    icon: body.icon,
  }

  let delivered = 0
  const toDelete: string[] = []
  for (const sub of subs) {
    const r = await sendPush(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    )
    if (r.ok) delivered++
    else if (r.status === 404 || r.status === 410) toDelete.push(sub.endpoint)
  }

  if (toDelete.length) {
    await admin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", body.userId)
      .in("endpoint", toDelete)
  }

  return NextResponse.json({ ok: true, delivered, pruned: toDelete.length })
}
