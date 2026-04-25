"use client"

import { useState, useEffect, useCallback } from "react"
import { formatDistanceToNow, format } from "date-fns"
import {
  ChevronLeft,
  Flame,
  MapPin,
  Target,
  Dumbbell,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Download,
  Timer,
  Gauge,
  Calendar,
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { getWorkouts, getRuns, getCoachSessions } from "@/lib/store-supabase"
import { DURATION, EASE, staggerDelaySec } from "@/lib/motion"
import { getAuthErrorMessage } from "@/lib/supabase/config"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { downloadBlob, runToGpx } from "@/lib/export"
import { siteConfig } from "@/lib/data"
import { toast } from "sonner"
import type { RunRecord } from "@/lib/store"

type HistoryItem = {
  type: "workout" | "run" | "coach"
  id: string
  title: string
  detail: string
  /** Dominant metric shown on the right in bold tabular-nums. */
  primary: string
  primaryLabel: string
  time: string
  icon: typeof Dumbbell
  run?: RunRecord
}

/** Per-type visual identity for history rows. */
const TYPE_STYLE = {
  workout: { tint: "text-metric-move", bg: "bg-metric-move/15" },
  run: { tint: "text-metric-run", bg: "bg-metric-run/15" },
  coach: { tint: "text-metric-coach", bg: "bg-metric-coach/15" },
} as const

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`
  return `${m}:${sec.toString().padStart(2, "0")}`
}

export function WorkoutHistory({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailRun, setDetailRun] = useState<RunRecord | null>(null)
  const reduceMotion = useReducedMotion() ?? false

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [workouts, runs, coach] = await Promise.all([
        getWorkouts(),
        getRuns(),
        getCoachSessions(),
      ])

      const workoutItems: HistoryItem[] = workouts.map((w) => ({
        type: "workout",
        id: w.id,
        title: w.title,
        detail: `${w.exerciseCount} exercises · ${w.calories} cal`,
        primary: `${Math.round(w.duration / 60)}`,
        primaryLabel: "min",
        time: w.completedAt,
        icon: Dumbbell,
      }))
      const runItems: HistoryItem[] = runs.map((r) => ({
        type: "run",
        id: r.id,
        title: "Run",
        detail: `${r.pace}/km · ${Math.round(r.calories)} cal`,
        primary: r.distance.toFixed(2),
        primaryLabel: "km",
        time: r.completedAt,
        icon: MapPin,
        run: r,
      }))
      const coachItems: HistoryItem[] = coach.map((c) => ({
        type: "coach",
        id: c.id,
        title: `AI: ${c.exercise}`,
        detail: `${c.reps} reps`,
        primary: `${c.score}`,
        primaryLabel: "% form",
        time: c.completedAt,
        icon: Target,
      }))
      const all = [...workoutItems, ...runItems, ...coachItems].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      )
      setItems(all)
    } catch (err) {
      setError(getAuthErrorMessage(err, "Could not load activity history."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col pb-28">
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Back to dashboard"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
          Activity History
        </h1>
      </div>
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading activity history">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-4 border border-border">
                <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-48 rounded bg-muted animate-pulse opacity-70" />
                </div>
                <div className="h-3 w-10 rounded bg-muted animate-pulse opacity-70" />
              </div>
            ))}
            <p className="sr-only">
              <Loader2 className="inline h-3 w-3 animate-spin" /> Loading
            </p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center"
          >
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Couldn&apos;t load history</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-8 text-center">
            <Flame className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">Runs, workouts, and Coach Assist sessions will appear here.</p>
          </div>
        ) : (
          items.map((item, i) => {
            const style = TYPE_STYLE[item.type]
            const innerContent = (
              <>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${style.bg}`}>
                  <item.icon className={`h-5 w-5 ${style.tint}`} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{item.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-2xl font-bold tabular-nums leading-none ${style.tint}`}
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {item.primary}
                  </p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    {item.primaryLabel}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/80 whitespace-nowrap">
                    {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                  </p>
                </div>
              </>
            )
            const baseRowClasses =
              "motion-card flex w-full items-center gap-3 rounded-2xl bg-card p-4 border border-border shadow-[var(--shadow-card)]"
            const motionProps = {
              initial: reduceMotion ? false : ({ opacity: 0, y: 8 } as const),
              animate: { opacity: 1, y: 0 },
              transition: {
                duration: DURATION.slow,
                delay: reduceMotion ? 0 : staggerDelaySec(i, 12),
                ease: EASE.out,
              },
            } as const
            if (item.type === "run" && item.run) {
              const runForClick = item.run
              return (
                <motion.button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => setDetailRun(runForClick)}
                  aria-label={`View run on ${format(new Date(item.time), "PPP")}`}
                  className={`${baseRowClasses} text-left motion-card-interactive transition-transform hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metric-run`}
                  {...motionProps}
                >
                  {innerContent}
                </motion.button>
              )
            }
            return (
              <motion.div
                key={`${item.type}-${item.id}`}
                className={baseRowClasses}
                {...motionProps}
              >
                {innerContent}
              </motion.div>
            )
          })
        )}
      </div>

      <Sheet open={detailRun != null} onOpenChange={(o) => !o && setDetailRun(null)}>
        <SheetContent side="bottom" className="max-h-[88vh] rounded-t-3xl border-t border-border">
          {detailRun && (
            <>
              <SheetHeader className="border-b border-border/60 pb-3 text-left">
                <SheetTitle style={{ fontFamily: "var(--font-heading)" }}>Run detail</SheetTitle>
                <SheetDescription className="text-xs">
                  {format(new Date(detailRun.completedAt), "EEEE, MMM d · p")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                    <MapPin className="mx-auto h-4 w-4 text-metric-run" />
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {detailRun.distance.toFixed(2)}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">km</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                    <Timer className="mx-auto h-4 w-4 text-metric-move" />
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {formatDuration(detailRun.duration)}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">time</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                    <Gauge className="mx-auto h-4 w-4 text-metric-streak" />
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {detailRun.pace || "—"}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">/km</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-metric-hr" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Calories</span>
                    </div>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {Math.round(detailRun.calories)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-metric-spo2" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Samples</span>
                    </div>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {detailRun.path?.length ?? 0}
                    </p>
                  </div>
                </div>
                {detailRun.path?.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      downloadBlob(
                        `run-${detailRun.id}.gpx`,
                        runToGpx(detailRun, { appName: siteConfig.appName }),
                        "application/gpx+xml"
                      )
                      toast.success("GPX exported")
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" />
                    Export as GPX
                  </button>
                ) : (
                  <p className="rounded-xl bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                    No GPS samples recorded for this run.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
