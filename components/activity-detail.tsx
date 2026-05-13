"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { Activity, MapPin, Timer, Gauge, Flame, Download, Share2, TrendingUp } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import type { CoachRecord, RunRecord, WorkoutRecord } from "@/lib/store"
import { downloadBlob, runToGpx } from "@/lib/export"
import { siteConfig } from "@/lib/data"
import { toast } from "sonner"
import { pathToSvgD } from "@/lib/run-path-svg"
import { RunSplitBars } from "@/components/run-finish-recap"
import { estimateKmSplitsFromRecord } from "@/lib/run-splits-estimate"
import { composeShareCard } from "@/lib/share-card"
import { SessionDnaCard } from "@/components/session-dna-card"
import { CoachRepTimeline } from "@/components/coach-rep-timeline"
import { effectiveRepCount, isVerifiedMovement } from "@/lib/competition"
import { useLocale } from "@/components/locale-provider"

export type ActivityDetailPayload =
  | { kind: "workout"; workout: WorkoutRecord }
  | { kind: "run"; run: RunRecord }
  | { kind: "coach"; coach: CoachRecord }
  | { kind: "story"; run: RunRecord; coach: CoachRecord }

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`
  return `${m}:${sec.toString().padStart(2, "0")}`
}

export function ActivityDetailSheet({
  open,
  onOpenChange,
  activity,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: ActivityDetailPayload | null
}) {
  const { t, locale } = useLocale()
  const splits = useMemo(() => {
    if (!activity || activity.kind !== "run") return []
    return estimateKmSplitsFromRecord(activity.run)
  }, [activity])

  const svgD = useMemo(() => {
    if (!activity || (activity.kind !== "run" && activity.kind !== "story")) return ""
    return pathToSvgD(activity.run.path)
  }, [activity])

  async function shareRunCard(run: RunRecord) {
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
      /* dismiss */
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t("run.share.copied"))
    } catch {
      toast.error(t("run.share.failed"))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] rounded-t-3xl border-t border-border">
        {activity?.kind === "workout" && (
          <>
            <SheetHeader className="border-b border-border/60 pb-3 text-left">
              <SheetTitle style={{ fontFamily: "var(--font-heading)" }} className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-metric-move" />
                Workout
              </SheetTitle>
              <SheetDescription className="text-xs">
                {activity.workout.title} · {format(new Date(activity.workout.completedAt), "EEEE, MMM d · p")}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                  <Timer className="mx-auto h-4 w-4 text-metric-move" />
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                    {formatDuration(activity.workout.duration)}
                  </p>
                  <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">Duration</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                  <Flame className="mx-auto h-4 w-4 text-metric-hr" />
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                    {Math.round(activity.workout.calories)}
                  </p>
                  <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">Calories</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {activity.workout.exerciseCount} exercises · {activity.workout.category}
              </p>
            </div>
          </>
        )}

        {activity?.kind === "run" && (
          <>
            <SheetHeader className="border-b border-border/60 pb-3 text-left">
              <SheetTitle style={{ fontFamily: "var(--font-heading)" }}>{t("activity.runDetailTitle")}</SheetTitle>
              <SheetDescription className="text-xs">
                {format(new Date(activity.run.completedAt), "EEEE, MMM d · p")}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-3">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border bg-muted/30">
                {svgD ? (
                  <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
                    <path
                      d={svgD}
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                    {t("activity.noGpsTrail")}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                  <MapPin className="mx-auto h-4 w-4 text-metric-run" />
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                    {activity.run.distance.toFixed(2)}
                  </p>
                  <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">km</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                  <Timer className="mx-auto h-4 w-4 text-metric-move" />
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                    {formatDuration(activity.run.duration)}
                  </p>
                  <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">time</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)]">
                  <Gauge className="mx-auto h-4 w-4 text-metric-streak" />
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                    {activity.run.pace || "—"}
                  </p>
                  <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">/km</p>
                </div>
              </div>
              {splits.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <RunSplitBars splits={splits} tone="card" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="flex-1 rounded-xl" onClick={() => void shareRunCard(activity.run)}>
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                {activity.run.path?.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => {
                      downloadBlob(
                        `run-${activity.run.id}.gpx`,
                        runToGpx(activity.run, { appName: siteConfig.appName }),
                        "application/gpx+xml",
                      )
                      toast.success("GPX exported")
                    }}
                  >
                    <Download className="h-4 w-4" />
                    GPX
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {activity?.kind === "coach" && (
          <>
            <SheetHeader className="border-b border-border/60 pb-3 text-left">
              <SheetTitle style={{ fontFamily: "var(--font-heading)" }}>Coach session</SheetTitle>
              <SheetDescription className="text-xs">
                {activity.coach.exercise} · {format(new Date(activity.coach.completedAt), "EEEE, MMM d · p")}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-3">
              <SessionDnaCard
                exercise={activity.coach.exercise}
                reps={activity.coach.reps}
                score={activity.coach.score}
                repScores={activity.coach.repScores ?? []}
                effectiveReps={
                  activity.coach.effectiveReps ??
                  effectiveRepCount(activity.coach.reps, activity.coach.repScores ?? [], activity.coach.score)
                }
                verifiedMovement={activity.coach.verifiedMovement ?? isVerifiedMovement(activity.coach.repScores ?? [], activity.coach.score)}
                faceVerifiedSession={activity.coach.faceVerifiedSession ?? false}
                ringSize={104}
                className="w-full border-primary/25"
              />
              {activity.coach.repScores && activity.coach.repScores.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <CoachRepTimeline repScores={activity.coach.repScores} selectedRep={null} label="Rep quality" />
                </div>
              )}
            </div>
          </>
        )}

        {activity?.kind === "story" && (
          <>
            <SheetHeader className="border-b border-border/60 pb-3 text-left">
              <SheetTitle style={{ fontFamily: "var(--font-heading)" }} className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Run + Coach day
              </SheetTitle>
              <SheetDescription className="text-xs">
                {format(
                  new Date(activity.run.completedAt) > new Date(activity.coach.completedAt) ? activity.run.completedAt : activity.coach.completedAt,
                  "EEEE, MMM d",
                )}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-3">
              <div className="rounded-2xl border border-metric-run/30 bg-metric-run/5 p-4">
                <p className="text-typo-eyebrow font-bold uppercase tracking-wider text-metric-run">Run</p>
                <p className="mt-1 text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                  {activity.run.distance.toFixed(2)} km
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDuration(activity.run.duration)} · {activity.run.pace}/km
                </p>
              </div>
              <div className="rounded-2xl border border-metric-coach/30 bg-metric-coach/5 p-4">
                <p className="text-typo-eyebrow font-bold uppercase tracking-wider text-metric-coach">Coach</p>
                <p className="mt-1 text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                  {activity.coach.exercise}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activity.coach.reps} reps · {activity.coach.score}% form
                </p>
              </div>
              <Button type="button" className="w-full rounded-xl" variant="outline" onClick={() => void shareRunCard(activity.run)}>
                <Share2 className="h-4 w-4" />
                Share run card
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
