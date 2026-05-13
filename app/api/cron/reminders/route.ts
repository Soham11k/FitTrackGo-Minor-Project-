import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendPush } from "@/lib/push/server"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

/**
 * Nightly reminder engine. Triggered by Vercel Cron (see `vercel.json`) at
 * 19:00 UTC-ish; the job iterates users and, based on their notification
 * preferences + last activity, dispatches relevant reminders.
 *
 * Auth:
 *   - Vercel Cron: `Authorization: Bearer ${CRON_SECRET}`
 *   - Local: `X-Cron-Secret: ${CRON_SECRET}`
 */
export async function GET(request: Request) {
  const token = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization") ?? ""
  const xSecret = request.headers.get("x-cron-secret") ?? ""
  const ok =
    token &&
    (authHeader === `Bearer ${token}` || xSecret === token)
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = createServiceRoleClient()
  if (!admin) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  const now = new Date()
  const todayIso = now.toISOString().slice(0, 10)

  // Pull the union of: everyone who has a push subscription AND opted-in prefs.
  const { data: candidates, error } = await admin
    .from("push_subscriptions")
    .select("user_id")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const uniqueUsers = Array.from(new Set((candidates ?? []).map((c) => c.user_id)))

  let sent = 0
  let skipped = 0
  let pushFailures = 0

  for (const userId of uniqueUsers) {
    const prefsRes = await admin
      .from("notification_preferences")
      .select("streak_reminder, weekly_goal, onboarding_nudge, quiet_hours_start, quiet_hours_end, timezone")
      .eq("user_id", userId)
      .maybeSingle()

    const prefs = prefsRes.data ?? {
      streak_reminder: true,
      weekly_goal: true,
      onboarding_nudge: true,
      quiet_hours_start: null,
      quiet_hours_end: null,
      timezone: null,
    }

    if (withinQuietHours(now, prefs)) {
      skipped++
      continue
    }

    const profileRes = await admin
      .from("profiles")
      .select("onboarded, last_active_date, streak")
      .eq("id", userId)
      .maybeSingle()
    const profile = profileRes.data

    let title: string | null = null
    let body: string | null = null
    let url = "/"

    if (prefs.onboarding_nudge && profile && !profile.onboarded) {
      title = "Finish setting up FitTrackGo"
      body = "Pick your goals and your coach gets a lot smarter."
      url = "/?onboard=1"
    } else if (
      prefs.streak_reminder &&
      profile?.last_active_date &&
      profile.last_active_date !== todayIso &&
      (profile.streak ?? 0) > 0
    ) {
      title = `Keep your ${profile.streak}-day streak alive`
      body = "A quick 5-minute session still counts."
      url = "/?tab=coach"
    } else if (prefs.weekly_goal) {
      // Lightweight "how's your week?" nudge on Sundays.
      if (now.getUTCDay() === 0) {
        title = "One more workout to close your week"
        body = "A short run or mobility flow is enough."
        url = "/"
      }
    }

    if (!title) {
      skipped++
      continue
    }

    const subsRes = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId)
    const subs = subsRes.data ?? []

    for (const s of subs) {
      try {
        const r = await sendPush(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          { title, body: body ?? "", url, tag: "ftg-reminder", icon: "/icon.svg" }
        )
        if (r.ok) {
          sent++
        } else {
          pushFailures++
          logger.warn("reminder_push_failed", { userId, status: r.status ?? null, error: "error" in r ? r.error : undefined })
        }
      } catch (e) {
        pushFailures++
        logger.error("reminder_push_error", {
          userId,
          message: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, pushFailures, candidates: uniqueUsers.length })
}

function withinQuietHours(
  now: Date,
  prefs: { quiet_hours_start?: number | null; quiet_hours_end?: number | null; timezone?: string | null }
): boolean {
  const start = prefs.quiet_hours_start
  const end = prefs.quiet_hours_end
  if (start == null || end == null) return false
  // Evaluate in the user's timezone when known.
  let hour: number
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: prefs.timezone ?? "UTC",
        hour: "numeric",
        hour12: false,
      }).format(now)
    )
  } catch {
    hour = now.getUTCHours()
  }
  if (start === end) return false
  if (start < end) return hour >= start && hour < end
  // Overnight range (e.g. 22..7).
  return hour >= start || hour < end
}
