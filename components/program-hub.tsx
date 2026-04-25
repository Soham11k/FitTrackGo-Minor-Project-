"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, Trophy, CalendarCheck2 } from "lucide-react"
import {
  enrollInProgram,
  getActiveProgramForUser,
  listPrograms,
  completeToday,
  type PlanState,
  type Program,
} from "@/lib/programs"
import { track } from "@/lib/analytics"

interface ProgramHubProps {
  onStartSession?: (programDayId: string) => void
}

export function ProgramHub({ onStartSession }: ProgramHubProps) {
  const [plan, setPlan] = useState<PlanState | null>(null)
  const [catalog, setCatalog] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [p, c] = await Promise.all([getActiveProgramForUser(), listPrograms()])
      if (cancelled) return
      setPlan(p)
      setCatalog(c)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const progressPct = useMemo(() => {
    if (!plan || plan.daysTotal === 0) return 0
    return Math.round((plan.completedDays / plan.daysTotal) * 100)
  }, [plan])

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="space-y-4 p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        </Card>
      </div>
    )
  }

  const handleEnroll = async (programId: string, slug: string) => {
    setBusy(true)
    try {
      const enrolled = await enrollInProgram(programId)
      if (!enrolled) {
        toast.error("Couldn't enroll. Please try again.")
        return
      }
      track("program_enrolled", { program_slug: slug })
      toast.success("Program started — see you in Day 1.")
      const fresh = await getActiveProgramForUser()
      setPlan(fresh)
    } finally {
      setBusy(false)
    }
  }

  const handleComplete = async () => {
    if (!plan?.enrollment || !plan.today || !plan.program) return
    setBusy(true)
    try {
      const ok = await completeToday({
        enrollmentId: plan.enrollment.id,
        programDayId: plan.today.id,
      })
      if (!ok) {
        toast.error("Couldn't record adherence")
        return
      }
      track("program_day_completed", {
        program_slug: plan.program.slug,
        day_index: plan.today.day_index,
      })
      toast.success("Nice — Day marked complete")
      const fresh = await getActiveProgramForUser()
      setPlan(fresh)
    } finally {
      setBusy(false)
    }
  }

  if (plan?.enrollment && plan.program) {
    return (
      <div className="space-y-4">
        <Card className="space-y-4 p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Your plan</div>
              <h2 className="mt-0.5 text-xl font-semibold">{plan.program.title}</h2>
            </div>
            <Badge variant="secondary" className="bg-metric-streak/15 text-metric-streak">
              Day {plan.enrollment.current_day} of {plan.daysTotal || plan.program.weeks * 3}
            </Badge>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <span>Adherence</span>
              <span className="tabular-nums text-foreground">{progressPct}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-to-r from-metric-move to-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {plan.today ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-primary/5 p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  Day {plan.enrollment.current_day}
                  {plan.blocks.length > 0 ? ` · ${plan.blocks.length} ${plan.blocks.length === 1 ? "block" : "blocks"}` : ""}
                </div>
                <h3 className="mt-0.5 text-base font-semibold">{plan.today.title}</h3>
                {plan.today.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">{plan.today.notes}</p>
                ) : null}
              </div>

              {plan.blocks.length > 0 ? (
                <ul className="space-y-2">
                  {plan.blocks.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 p-3 text-sm transition-all active:scale-[0.99]"
                    >
                      <div className="min-w-0">
                        <div className="text-base font-bold tabular-nums text-foreground">
                          {b.sets} × {b.reps ?? `${b.duration_sec}s`}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Rest {b.rest_sec}s · Exercise #{b.exercise_id}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Follow the session notes above.</p>
              )}

              <div className="flex gap-2">
                {onStartSession && plan.today ? (
                  <Button onClick={() => onStartSession(plan.today!.id)} className="flex-1">
                    Start session
                  </Button>
                ) : null}
                <Button variant="outline" onClick={handleComplete} disabled={busy}>
                  <CalendarCheck2 className="mr-2 h-4 w-4" /> Mark complete
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <Trophy className="mx-auto mb-2 h-6 w-6" />
              Program complete. Pick another below to keep the momentum.
            </div>
          )}
        </Card>

        <SwitchableCatalog catalog={catalog} onEnroll={handleEnroll} busy={busy} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Training programs</h2>
        <p className="text-sm text-muted-foreground">
          Pick a plan and we&apos;ll show you exactly what to do each day.
        </p>
      </div>
      <SwitchableCatalog catalog={catalog} onEnroll={handleEnroll} busy={busy} />
    </div>
  )
}

function SwitchableCatalog({
  catalog,
  onEnroll,
  busy,
}: {
  catalog: Program[]
  onEnroll: (programId: string, slug: string) => void
  busy: boolean
}) {
  if (!catalog.length) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        No programs available yet. Check back soon.
      </Card>
    )
  }
  return (
    <div className="grid gap-3">
      {catalog.map((p) => (
        <Card key={p.id} className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{p.title}</h3>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs capitalize">
              {p.level}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{p.weeks} weeks</span>
            <Button size="sm" disabled={busy} onClick={() => onEnroll(p.id, p.slug)}>
              Start
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
