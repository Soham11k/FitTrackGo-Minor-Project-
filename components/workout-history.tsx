"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { formatDistanceToNow, format } from "date-fns"
import {
  ChevronLeft,
  Flame,
  MapPin,
  Target,
  Dumbbell,
  RefreshCw,
  AlertTriangle,
  Download,
  Timer,
  Gauge,
  Calendar,
  Share2,
  MoreVertical,
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { getWorkouts, getRuns, getCoachSessions } from "@/lib/store-supabase"
import { DURATION, EASE, staggerDelaySec } from "@/lib/motion"
import { getAuthErrorMessage } from "@/lib/supabase/config"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { downloadBlob, runToGpx } from "@/lib/export"
import { siteConfig } from "@/lib/data"
import { toast } from "sonner"
import { pathToSvgD } from "@/lib/run-path-svg"
import { estimateKmSplitsFromRecord } from "@/lib/run-splits-estimate"
import { composeShareCard } from "@/lib/share-card"
import { RunSplitBars } from "@/components/run-finish-recap"
import type { RunRecord, CoachRecord, WorkoutRecord } from "@/lib/store"
import { CoachRepTimeline } from "@/components/coach-rep-timeline"
import type { TabId } from "@/components/bottom-nav"
import { ActivityDetailSheet, type ActivityDetailPayload } from "@/components/activity-detail"
import { CompareSessionsPanel, RunVersusShareCard } from "@/components/compare-sessions-sheet"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLocale } from "@/components/locale-provider"
import { EditorialEmpty } from "@/components/brand/editorial-empty"
import { InlineScreenSkeleton } from "@/components/brand/inline-screen-skeleton"

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
  coach?: CoachRecord
  workout?: WorkoutRecord
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

export function WorkoutHistory({
  onBack,
  onNavigate,
}: {
  onBack: () => void
  /** Optional tab switch after returning from this deep link (closes history view). */
  onNavigate?: (tab: TabId) => void
}) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailRun, setDetailRun] = useState<RunRecord | null>(null)
  const [detailCoach, setDetailCoach] = useState<CoachRecord | null>(null)
  const [detailCompare, setDetailCompare] = useState<CoachRecord | null>(null)
  const [coachRepPick, setCoachRepPick] = useState<number | null>(null)
  const [compareRepPick, setCompareRepPick] = useState<number | null>(null)
  const [coachRows, setCoachRows] = useState<CoachRecord[]>([])
  const [detailActivity, setDetailActivity] = useState<ActivityDetailPayload | null>(null)
  const { locale, t } = useLocale()
  const reduceMotion = useReducedMotion() ?? false

  const historyRunSplits = useMemo(() => (detailRun ? estimateKmSplitsFromRecord(detailRun) : []), [detailRun])
  const runCandidates = useMemo(
    () => items.flatMap((i) => (i.type === "run" && i.run ? [i.run] : [])),
    [items],
  )
  const historyRunSvg = useMemo(() => {
    if (!detailRun?.path?.length || detailRun.path.length < 2) return ""
    return pathToSvgD(detailRun.path)
  }, [detailRun])

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
        workout: w,
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
        coach: c,
      }))
      const all = [...workoutItems, ...runItems, ...coachItems].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      )
      setItems(all)
      setCoachRows(coach)
    } catch (err) {
      setError(getAuthErrorMessage(err, "Could not load activity history."))
    } finally {
      setLoading(false)
    }
  }, [])

  async function shareHistoryRun(run: RunRecord) {
    const dateLabel = format(new Date(run.completedAt), "EEE, MMM d")
    const text = `${run.distance.toFixed(2)} km · ${formatDuration(run.duration)} · ${run.pace}/km · FitTrack Go`
    try {
      const png = await composeShareCard({
        kind: "run",
        payload: {
          distanceKm: run.distance,
          durationSec: run.duration,
          pacePerKm: run.pace,
          dateLabel,
          path: run.path ?? [],
        },
        locale,
      })
      if (png && navigator.share && navigator.canShare?.({ files: [png] })) {
        await navigator.share({ title: t("run.share.nativeTitle"), text, files: [png] })
        return
      }
      if (png && navigator.share) {
        await navigator.share({ title: t("run.share.nativeTitle"), text })
        return
      }
    } catch {
      /* dismissed */
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t("run.share.copied"))
    } catch {
      toast.error(t("run.share.failed"))
    }
  }

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
          <InlineScreenSkeleton
            label="Loading history…"
            hint="Gathering your runs, workouts, and Coach sessions."
            layout="list"
            className="border-0 bg-transparent p-0 shadow-none"
          />
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
          <EditorialEmpty
            title="No activity logged yet"
            description="Your runs, workouts, and Coach Assist sets will timeline here automatically after you finish."
            media={
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src="/illustrations/history-empty.svg"
                alt=""
                className="h-[7rem] w-[7rem] opacity-90"
              />
            }
            secondary={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => {
                    onNavigate?.("run")
                    onBack()
                  }}
                >
                  Track a run
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-primary/35 bg-background/80"
                  onClick={() => {
                    onNavigate?.("exercises")
                    onBack()
                  }}
                >
                  Browse workouts
                </Button>
              </div>
            }
          />
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
                  <p className="mt-0.5 text-typo-caption text-muted-foreground truncate">{item.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-2xl font-bold tabular-nums leading-none ${style.tint}`}
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {item.primary}
                  </p>
                  <p className="mt-1 text-typo-micro font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    {item.primaryLabel}
                  </p>
                  <p className="mt-0.5 text-typo-eyebrow font-medium text-muted-foreground/80 whitespace-nowrap">
                    {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                  </p>
                </div>
              </>
            )
            const baseRowClasses =
              "motion-card flex w-full items-center gap-3 rounded-lg bg-background p-4 border border-border"
            const motionProps = {
              initial: reduceMotion ? false : ({ opacity: 0, y: 8 } as const),
              animate: { opacity: 1, y: 0 },
              transition: {
                duration: DURATION.slow,
                delay: reduceMotion ? 0 : staggerDelaySec(i, 12),
                ease: EASE.out,
              },
            } as const
            if (item.type === "workout" && item.workout) {
              const w = item.workout
              return (
                <motion.button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => setDetailActivity({ kind: "workout", workout: w })}
                  aria-label={`View workout ${w.title}`}
                  className={`${baseRowClasses} text-left motion-card-interactive transition-transform hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metric-move`}
                  {...motionProps}
                >
                  {innerContent}
                </motion.button>
              )
            }
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
            if (item.type === "coach" && item.coach) {
              const c = item.coach
              const others = coachRows
                .filter((x) => x.exercise === c.exercise && x.id !== c.id)
                .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                .slice(0, 12)
              return (
                <motion.div
                  key={`${item.type}-${item.id}`}
                  className={`${baseRowClasses} p-0 gap-0`}
                  {...motionProps}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setDetailCoach(c)
                      setDetailCompare(null)
                      setCoachRepPick(c.repScores?.length ? c.repScores.length - 1 : null)
                      setCompareRepPick(null)
                    }}
                    aria-label={`View coach session ${c.exercise}`}
                    className={`flex flex-1 min-w-0 items-center gap-3 rounded-2xl px-4 py-4 text-left motion-card-interactive transition-transform hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metric-coach`}
                  >
                    {innerContent}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`More actions for coach session ${c.exercise}`}
                        className="shrink-0 border-l border-border px-4 py-4 text-muted-foreground hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metric-coach"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl border-border bg-card shadow-lg">
                      <DropdownMenuLabel>Compare ({c.exercise})</DropdownMenuLabel>
                      {others.length ? (
                        others.map((o) => (
                          <DropdownMenuItem
                            key={o.id}
                            onClick={() => {
                              setDetailCoach(c)
                              setDetailCompare(o)
                              setCoachRepPick(c.repScores?.length ? c.repScores.length - 1 : null)
                              setCompareRepPick(o.repScores?.length ? o.repScores.length - 1 : null)
                            }}
                          >
                            vs {format(new Date(o.completedAt), "MMM d · p")} · {o.score}%
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">No other sessions for this exercise</div>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
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
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-muted/30">
                  {historyRunSvg ? (
                    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
                      <path
                        d={historyRunSvg}
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                      No GPS trail for this run
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                    <MapPin className="mx-auto h-4 w-4 text-metric-run" />
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {detailRun.distance.toFixed(2)}
                    </p>
                    <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">km</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                    <Timer className="mx-auto h-4 w-4 text-metric-move" />
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {formatDuration(detailRun.duration)}
                    </p>
                    <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">time</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                    <Gauge className="mx-auto h-4 w-4 text-metric-streak" />
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {detailRun.pace || "—"}
                    </p>
                    <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">/km</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-metric-hr" />
                      <span className="text-typo-eyebrow font-bold uppercase tracking-wider text-muted-foreground">Calories</span>
                    </div>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {Math.round(detailRun.calories)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-metric-spo2" />
                      <span className="text-typo-eyebrow font-bold uppercase tracking-wider text-muted-foreground">Samples</span>
                    </div>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {detailRun.path?.length ?? 0}
                    </p>
                  </div>
                </div>
                {historyRunSplits.length > 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                    <RunSplitBars splits={historyRunSplits} tone="card" />
                  </div>
                ) : null}
                <RunVersusShareCard anchor={detailRun} opponentCandidates={runCandidates} locale={locale} />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-xl border-primary/30"
                    onClick={() => void shareHistoryRun(detailRun)}
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                  {detailRun.path?.length ? (
                    <Button
                      type="button"
                      className="flex-1 rounded-xl"
                      onClick={() => {
                        downloadBlob(
                          `run-${detailRun.id}.gpx`,
                          runToGpx(detailRun, { appName: siteConfig.appName }),
                          "application/gpx+xml",
                        )
                        toast.success("GPX exported")
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Export GPX
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={detailCoach != null}
        onOpenChange={(o) => {
          if (!o) {
            setDetailCoach(null)
            setDetailCompare(null)
            setCoachRepPick(null)
            setCompareRepPick(null)
          }
        }}
      >
        <SheetContent side="bottom" className="max-h-[88vh] rounded-t-3xl border-t border-border">
          {detailCoach && (
            <>
              <SheetHeader className="border-b border-border/60 pb-3 text-left">
                <SheetTitle style={{ fontFamily: "var(--font-heading)" }}>Coach session</SheetTitle>
                <SheetDescription className="text-xs">
                  {detailCoach.exercise} · {format(new Date(detailCoach.completedAt), "EEEE, MMM d · p")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                    <Target className="mx-auto h-4 w-4 text-metric-coach" />
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {detailCoach.reps}
                    </p>
                    <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">reps</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                    <Gauge className="mx-auto h-4 w-4 text-metric-streak" />
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {detailCoach.score}
                    </p>
                    <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">% form</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                    <Timer className="mx-auto h-4 w-4 text-metric-move" />
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {detailCoach.repScores?.length
                        ? Math.round(detailCoach.repScores.reduce((a, b) => a + b, 0) / detailCoach.repScores.length)
                        : "—"}
                    </p>
                    <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">avg rep</p>
                  </div>
                </div>
                {(() => {
                  const prev = coachRows
                    .filter(
                      (r) =>
                        r.exercise === detailCoach.exercise &&
                        r.id !== detailCoach.id &&
                        new Date(r.completedAt).getTime() < new Date(detailCoach.completedAt).getTime()
                    )
                    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
                  const canCompare = prev != null && !detailCompare
                  return (
                    <div className="flex flex-wrap gap-2">
                      {canCompare && (
                        <button
                          type="button"
                          onClick={() => {
                            setDetailCompare(prev)
                            setCompareRepPick(prev.repScores?.length ? prev.repScores.length - 1 : null)
                          }}
                          className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground active:scale-[0.98]"
                        >
                          Compare with previous ({format(new Date(prev.completedAt), "MMM d")})
                        </button>
                      )}
                      {detailCompare && (
                        <button
                          type="button"
                          onClick={() => {
                            setDetailCompare(null)
                            setCompareRepPick(null)
                          }}
                          className="rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground"
                        >
                          Show this session only
                        </button>
                      )}
                    </div>
                  )
                })()}
                {detailCoach.repScores && detailCoach.repScores.length > 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="mb-2 text-typo-eyebrow font-bold uppercase tracking-wider text-muted-foreground">This session</p>
                    <CoachRepTimeline
                      repScores={detailCoach.repScores}
                      selectedRep={coachRepPick}
                      onRepSelect={(i) => setCoachRepPick(i)}
                      label="Rep playback"
                    />
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">No per-rep scores stored for this session.</p>
                )}
                {detailCompare ? <CompareSessionsPanel current={detailCoach} baseline={detailCompare} /> : null}
                {detailCompare && detailCompare.repScores && detailCompare.repScores.length > 0 ? (
                  <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <p className="mb-2 text-typo-eyebrow font-bold uppercase tracking-wider text-muted-foreground">
                      Baseline · {format(new Date(detailCompare.completedAt), "MMM d · p")}
                    </p>
                    <CoachRepTimeline
                      repScores={detailCompare.repScores}
                      selectedRep={compareRepPick}
                      onRepSelect={(i) => setCompareRepPick(i)}
                      label="Rep playback"
                    />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ActivityDetailSheet
        open={detailActivity != null}
        onOpenChange={(o) => !o && setDetailActivity(null)}
        activity={detailActivity}
      />
    </div>
  )
}
