"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Bell, BellOff, Flame, Target, Sparkles, type LucideIcon } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  ensurePermission,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/client"
import { createClient } from "@/lib/supabase/client"
import { track } from "@/lib/analytics"

interface Prefs {
  streak_reminder: boolean
  weekly_goal: boolean
  onboarding_nudge: boolean
  quiet_hours_start: number | null
  quiet_hours_end: number | null
  timezone: string | null
}

const DEFAULT_PREFS: Prefs = {
  streak_reminder: true,
  weekly_goal: true,
  onboarding_nudge: true,
  quiet_hours_start: 22,
  quiet_hours_end: 7,
  timezone: null,
}

export function NotificationPreferencesPanel() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ok = await isPushSupported()
      if (cancelled) return
      setSupported(ok)

      if (ok) {
        try {
          const reg = await navigator.serviceWorker.ready
          const sub = await reg.pushManager.getSubscription()
          if (!cancelled) setSubscribed(!!sub)
        } catch {
          /* noop */
        }
      }

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }

      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
      if (cancelled) return
      if (data) {
        setPrefs({
          streak_reminder: data.streak_reminder ?? true,
          weekly_goal: data.weekly_goal ?? true,
          onboarding_nudge: data.onboarding_nudge ?? true,
          quiet_hours_start: data.quiet_hours_start ?? 22,
          quiet_hours_end: data.quiet_hours_end ?? 7,
          timezone: data.timezone ?? null,
        })
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const save = async (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const tz =
      next.timezone ??
      (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null)
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...next, timezone: tz })
    if (error) toast.error("Couldn't save preferences")
  }

  const handleToggleSubscribe = async () => {
    setBusy(true)
    try {
      if (subscribed) {
        const ok = await unsubscribeFromPush()
        if (ok) {
          setSubscribed(false)
          toast.success("Notifications turned off")
        }
      } else {
        const perm = await ensurePermission()
        if (perm !== "granted") {
          toast.error("Enable notifications in browser settings first")
          return
        }
        const ok = await subscribeToPush()
        if (ok) {
          setSubscribed(true)
          track("push_subscribed")
          toast.success("You'll get helpful reminders")
        } else {
          toast.error("Couldn't subscribe — try again")
        }
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Card className="space-y-5 p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="flex flex-1 items-start gap-3">
                <div className="h-8 w-8 animate-pulse rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-44 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="h-5 w-9 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card className="space-y-5 p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            {subscribed ? <Bell className="h-4 w-4 text-metric-move" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            Notifications
          </h3>
          <p className="text-xs text-muted-foreground">
            {supported
              ? "Short, helpful reminders. Never spam."
              : "Push isn't supported on this device/browser."}
          </p>
        </div>
        <Button
          variant={subscribed ? "outline" : "default"}
          size="sm"
          disabled={!supported || busy}
          onClick={handleToggleSubscribe}
        >
          {subscribed ? "Turn off" : "Turn on"}
        </Button>
      </div>

      {subscribed && (
        <div className="space-y-3">
          <PrefRow
            icon={Flame}
            iconBg="bg-metric-streak/15"
            iconFg="text-metric-streak"
            label="Streak-at-risk reminder"
            caption="If you haven't moved by evening."
            checked={prefs.streak_reminder}
            onChange={(v) => save({ streak_reminder: v })}
          />
          <PrefRow
            icon={Target}
            iconBg="bg-metric-move/15"
            iconFg="text-metric-move"
            label="Weekly goal"
            caption="A Sunday nudge if you're one session short."
            checked={prefs.weekly_goal}
            onChange={(v) => save({ weekly_goal: v })}
          />
          <PrefRow
            icon={Sparkles}
            iconBg="bg-metric-coach/15"
            iconFg="text-metric-coach"
            label="Onboarding help"
            caption="Only while you're still setting up."
            checked={prefs.onboarding_nudge}
            onChange={(v) => save({ onboarding_nudge: v })}
          />

          <div className="pt-2 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Quiet hours
            </div>
            <div className="flex items-center gap-2">
              <TimeStepper
                label="Start"
                value={prefs.quiet_hours_start ?? 22}
                onChange={(v) => save({ quiet_hours_start: v })}
              />
              <span className="text-muted-foreground">–</span>
              <TimeStepper
                label="End"
                value={prefs.quiet_hours_end ?? 7}
                onChange={(v) => save({ quiet_hours_end: v })}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

function PrefRow({
  icon: Icon,
  iconBg,
  iconFg,
  label,
  caption,
  checked,
  onChange,
}: {
  icon: LucideIcon
  iconBg: string
  iconFg: string
  label: string
  caption: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-1 items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconFg}`} />
        </div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{caption}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function TimeStepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const bump = (d: number) => onChange(((value + d) % 24 + 24) % 24)
  return (
    <div className="flex flex-1 items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
      <button
        type="button"
        onClick={() => bump(-1)}
        className="text-muted-foreground hover:text-foreground active:scale-90 transition-all text-lg font-semibold w-6 text-center"
        aria-label={`${label} hour earlier`}
      >
        −
      </button>
      <div className="text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-bold tabular-nums">{formatHour(value)}</div>
      </div>
      <button
        type="button"
        onClick={() => bump(1)}
        className="text-muted-foreground hover:text-foreground active:scale-90 transition-all text-lg font-semibold w-6 text-center"
        aria-label={`${label} hour later`}
      >
        +
      </button>
    </div>
  )
}

function formatHour(h: number | null) {
  if (h == null) return "—"
  return `${String(h).padStart(2, "0")}:00`
}
